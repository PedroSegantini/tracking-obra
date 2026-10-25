import { validatePasswordChange } from '../src/lib/account-security.js'
import { sendPasswordChangedEmail } from './password-email.js'
function fail(status, message) { const error = new Error(message); error.status = status; return error }
async function firebaseRequest(operation, body, apiKey, fetchImpl) {
  let response, data
  try {
    response = await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000), cache: 'no-store' })
    data = await response.json()
  } catch {
    throw fail(503, operation === 'update' ? 'Não foi possível confirmar a alteração. Tente entrar com a nova senha antes de repetir.' : 'Não foi possível verificar a senha atual. Tente novamente.')
  }
  if (!response.ok) {
    const code = String(data.error?.message || '').split(' : ')[0]
    if (['INVALID_LOGIN_CREDENTIALS', 'INVALID_PASSWORD', 'EMAIL_NOT_FOUND'].includes(code)) throw fail(400, 'Senha atual incorreta.')
    if (code === 'TOO_MANY_ATTEMPTS_TRY_LATER') throw fail(429, 'Muitas tentativas. Aguarde alguns minutos.')
    if (['WEAK_PASSWORD', 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS'].includes(code)) throw fail(400, 'A nova senha não atende à política de segurança configurada no Firebase.')
    if (['TOKEN_EXPIRED', 'INVALID_ID_TOKEN', 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN', 'USER_DISABLED'].includes(code)) throw fail(401, 'Sua sessão expirou. Entre novamente.')
    throw fail(503, 'Não foi possível alterar a senha. Confira a configuração de autenticação do servidor.')
  }
  return data
}
export async function changeAccountPassword({ auth, db, uid, input, apiKey, fetchImpl = fetch, sendNotice = sendPasswordChangedEmail, now = () => new Date() }) {
  let credentials
  try { credentials = validatePasswordChange(input) } catch (error) { throw fail(400, error.message) }
  if (!apiKey) throw fail(503, 'O serviço de alteração de senha ainda não foi configurado.')
  const member = await db.doc(`users/${uid}`).get()
  if (!member.exists || member.data().active !== true) throw fail(403, 'Sua conta não está autorizada.')
  const user = await auth.getUser(uid)
  if (user.disabled || !user.email) throw fail(403, 'Sua conta não está autorizada.')
  if (!user.providerData.some(provider => provider.providerId === 'password')) throw fail(400, 'Habilite e-mail e senha em Minha conta antes de alterar a senha.')
  // Destinatário e identidade vêm do Firebase, nunca do corpo enviado pelo navegador.
  const signedIn = await firebaseRequest('signInWithPassword', { email: user.email, password: credentials.currentPassword, returnSecureToken: true }, apiKey, fetchImpl)
  if (signedIn.localId !== uid || !signedIn.idToken) throw fail(403, 'Não foi possível confirmar a identidade da conta.')
  // Usar a API do usuário respeita a política de senha do projeto.
  const updated = await firebaseRequest('update', { idToken: signedIn.idToken, password: credentials.newPassword, returnSecureToken: true }, apiKey, fetchImpl)
  if (updated.localId !== uid) throw fail(503, 'Não foi possível confirmar a alteração. Tente entrar novamente.')
  // Senhas e tokens ficam apenas em memória; não há escrita deles no banco nem nos logs.
  let notification
  try { notification = await sendNotice({ email: user.email, changedAt: now() }) }
  catch { notification = 'failed' }
  return { passwordChanged: true, notification }
}
