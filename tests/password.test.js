import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePasswordChange } from '../src/lib/account-security.js'
import { changeAccountPassword } from '../server/change-password.js'
import { sendPasswordChangedEmail } from '../server/password-email.js'
import { createPasswordHandler } from '../api/account/password.js'
const input = { currentPassword: 'Senha-antiga-123', newPassword: 'Senha-nova-456', confirmPassword: 'Senha-nova-456' }
function setup(patch = {}) {
  const events = [], requests = [], messages = []
  const services = {
    auth: { getUser: async uid => ({ uid, email: 'membro@example.com', disabled: false, providerData: [{ providerId: 'password' }] }) },
    db: { doc: path => { assert.equal(path, 'users/member'); return { get: async () => ({ exists: true, data: () => ({ active: true }) }) } } },
    uid: 'member', input, apiKey: 'fake-key',
    fetchImpl: async (url, options) => { const body = JSON.parse(options.body); requests.push({ url, body }); events.push(url.includes('signInWithPassword') ? 'verify' : 'update'); return { ok: true, json: async () => ({ localId: 'member', idToken: 'temporary-token' }) } },
    sendNotice: async message => { events.push('email'); messages.push(message); return 'sent' },
    now: () => new Date('2026-10-25T15:00:00Z'),
    ...patch,
  }
  return { services, events, requests, messages }
}
test('troca exige senha atual, confirmação igual e nova senha diferente e forte', () => {
  for (const patch of [{ currentPassword: '' }, { newPassword: 'curta', confirmPassword: 'curta' }, { confirmPassword: 'diferente' }, { newPassword: input.currentPassword, confirmPassword: input.currentPassword }]) assert.throws(() => validatePasswordChange({ ...input, ...patch }))
  assert.deepEqual(validatePasswordChange(input), { currentPassword: input.currentPassword, newPassword: input.newPassword })
})
test('confirma senha atual, altera e só então notifica o e-mail cadastrado', async () => {
  const { services, events, requests, messages } = setup({ input: { ...input, email: 'outro@example.com', uid: 'outro' } })
  const result = await changeAccountPassword(services)
  assert.deepEqual(events, ['verify', 'update', 'email'])
  assert.equal(requests[0].body.email, 'membro@example.com'); assert.equal(requests[0].body.password, input.currentPassword)
  assert.equal(requests[1].body.password, input.newPassword); assert.equal(requests[1].body.idToken, 'temporary-token')
  assert.equal(messages[0].email, 'membro@example.com')
  assert.deepEqual(result, { passwordChanged: true, notification: 'sent' })
  assert.ok(!JSON.stringify(result).includes(input.newPassword)); assert.ok(!JSON.stringify(result).includes('temporary-token'))
})
test('senha atual incorreta não altera conta nem envia aviso', async () => {
  let calls = 0
  const { services, messages } = setup({ fetchImpl: async () => { calls++; return { ok: false, json: async () => ({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }) } } })
  await assert.rejects(changeAccountPassword(services), /Senha atual incorreta/)
  assert.equal(calls, 1); assert.equal(messages.length, 0)
})
test('conta sem vínculo e conta somente Google não podem usar a troca com senha atual', async () => {
  const denied = setup({ db: { doc: () => ({ get: async () => ({ exists: false }) }) } })
  await assert.rejects(changeAccountPassword(denied.services), /autorizada/); assert.equal(denied.requests.length, 0)
  const google = setup({ auth: { getUser: async () => ({ email: 'membro@example.com', providerData: [{ providerId: 'google.com' }] }) } })
  await assert.rejects(changeAccountPassword(google.services), /Habilite e-mail/); assert.equal(google.requests.length, 0)
})
test('não aceita uma credencial que pertence a outro UID', async () => {
  const { services, messages } = setup({ fetchImpl: async () => ({ ok: true, json: async () => ({ localId: 'outro', idToken: 'other-token' }) }) })
  await assert.rejects(changeAccountPassword(services), /identidade/); assert.equal(messages.length, 0)
})
test('política de senha do Firebase é respeitada e falha não dispara e-mail', async () => {
  let calls = 0
  const { services, messages } = setup({ fetchImpl: async () => { calls++; return calls === 1 ? { ok: true, json: async () => ({ localId: 'member', idToken: 'token' }) } : { ok: false, json: async () => ({ error: { message: 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS' } }) } } })
  await assert.rejects(changeAccountPassword(services), /política/); assert.equal(messages.length, 0)
})
test('falha de e-mail não desfaz alteração concluída e retorna resultado honesto', async () => {
  const failed = setup({ sendNotice: async () => { throw new Error('smtp failed') } })
  assert.deepEqual(await changeAccountPassword(failed.services), { passwordChanged: true, notification: 'failed' })
  const missing = setup({ sendNotice: async () => 'not-configured' })
  assert.equal((await changeAccountPassword(missing.services)).notification, 'not-configured')
})
test('falha de rede após solicitar troca não confirma sucesso nem envia aviso', async () => {
  let calls = 0
  const { services, messages } = setup({ fetchImpl: async () => { if (++calls === 2) throw new Error('timeout'); return { ok: true, json: async () => ({ localId: 'member', idToken: 'token' }) } } })
  await assert.rejects(changeAccountPassword(services), /confirmar a alteração/); assert.equal(messages.length, 0)
})
test('mailer sem configuração não tenta conectar', async () => {
  const result = await sendPasswordChangedEmail({ email: 'membro@example.com', changedAt: new Date() }, { env: {}, createTransport: () => { throw new Error('não deve conectar') } })
  assert.equal(result, 'not-configured')
})
test('aviso SMTP usa TLS, e-mail fixo, data e orientação ao administrador, sem senhas', async () => {
  let config, mail, closed = false
  const env = { SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'remetente@example.com', SMTP_PASSWORD: 'smtp-secret', SMTP_FROM: 'remetente@example.com', ADMIN_CONTACT_EMAIL: 'admin@example.com' }
  const result = await sendPasswordChangedEmail({ email: 'membro@example.com', changedAt: new Date('2026-10-25T15:00:00Z'), password: 'nunca-incluir' }, { env, createTransport: options => { config = options; return { sendMail: async value => { mail = value; return { accepted: ['membro@example.com'] } }, close: () => { closed = true } } } })
  assert.equal(result, 'sent'); assert.equal(config.requireTLS, true); assert.equal(config.secure, false); assert.equal(config.logger, false)
  assert.equal(mail.to, 'membro@example.com'); assert.equal(mail.replyTo, 'admin@example.com'); assert.match(mail.text, /não realizou esta alteração/); assert.match(mail.text, /administrador/)
  assert.ok(!JSON.stringify(mail).includes('nunca-incluir')); assert.ok(!JSON.stringify(mail).includes('smtp-secret')); assert.equal(closed, true)
})
test('endpoint exige autenticação e usa UID verificado, ignorando UID do corpo', async () => {
  const response = () => ({ code: null, data: null, setHeader() {}, status(code) { this.code = code; return this }, json(value) { this.data = value; return this } })
  let checked = false, received
  const handler = createPasswordHandler({ services: () => ({ auth: { verifyIdToken: async (token, revoked) => { assert.equal(token, 'fake-token'); checked = revoked; return { uid: 'member' } } }, db: {} }), changePassword: async args => { received = args; return { passwordChanged: true, notification: 'sent' } }, getApiKey: () => 'fake-key' })
  const denied = response(); await handler({ method: 'POST', headers: {} }, denied); assert.equal(denied.code, 401)
  const success = response(); await handler({ method: 'POST', headers: { authorization: 'Bearer fake-token', 'content-type': 'application/json' }, body: { ...input, uid: 'attacker' } }, success)
  assert.equal(success.code, 200); assert.equal(checked, true); assert.equal(received.uid, 'member'); assert.equal(success.data.passwordChanged, true)
})
