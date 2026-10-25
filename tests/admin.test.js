import test from 'node:test'
import assert from 'node:assert/strict'
import { validateUserInput } from '../src/lib/domain.js'
import { requireAdmin, provisionUser } from '../server/create-user.js'
const input = { name: 'Família', email: 'MEMBRO@example.com', password: 'Senha-long@123' }
test('cargo padrão é user e campos são validados', () => {
  assert.equal(validateUserInput(input).role, 'user'); assert.equal(validateUserInput(input).email, 'membro@example.com')
  assert.throws(() => validateUserInput({ ...input, role: 'owner' })); assert.throws(() => validateUserInput({ ...input, password: '123' }))
})
test('admin exige token e vínculo ativo, sem confiar no navegador', () => {
  assert.throws(() => requireAdmin({ uid: 'u', role: 'user' }, { role: 'admin', active: true }))
  assert.throws(() => requireAdmin({ uid: 'u', role: 'admin' }, { role: 'admin', active: false }))
  assert.throws(() => requireAdmin({ uid: 'u', role: 'admin' }, null))
  assert.doesNotThrow(() => requireAdmin({ uid: 'u', role: 'admin' }, { role: 'admin', active: true }))
})
test('cria conta e membro sem persistir senha no Firestore', async () => {
  let stored, claims
  const auth = { createUser: async () => ({ uid: 'novo' }), setCustomUserClaims: async (uid, value) => { claims = value }, deleteUser: async () => {} }
  const db = { doc: () => ({ create: async value => { stored = value } }) }
  const result = await provisionUser({ auth, db, actorUid: 'admin', input })
  assert.equal(stored.createdBy, 'admin'); assert.equal(stored.role, 'user'); assert.equal(stored.password, undefined); assert.equal(result.password, undefined); assert.deepEqual(claims, { role: 'user' })
})
test('desfaz conta criada se o vínculo falhar', async () => {
  let deleted
  const auth = { createUser: async () => ({ uid: 'novo' }), setCustomUserClaims: async () => {}, deleteUser: async uid => { deleted = uid } }
  const db = { doc: () => ({ create: async () => { throw new Error('write failed') } }) }
  await assert.rejects(provisionUser({ auth, db, actorUid: 'admin', input }), /write failed/); assert.equal(deleted, 'novo')
})

test('endpoint exige POST, token e JSON antes de acessar o servidor', async () => {
  const { default: handler } = await import('../api/admin/users.js')
  function response() { return { code: 0, data: null, setHeader() {}, status(code) { this.code = code; return this }, json(data) { this.data = data; return this } } }
  const get = response(); await handler({ method: 'GET', headers: {} }, get); assert.equal(get.code, 405)
  const noToken = response(); await handler({ method: 'POST', headers: {} }, noToken); assert.equal(noToken.code, 401)
  const noJson = response(); await handler({ method: 'POST', headers: { authorization: 'Bearer test' } }, noJson); assert.equal(noJson.code, 415)
})
