import { adminServices } from '../../server/firebase-admin.js'
import { changeAccountPassword } from '../../server/change-password.js'
export function createPasswordHandler({ services = adminServices, changePassword = changeAccountPassword, getApiKey = () => process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método não permitido.' }) }
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
    if (!token) return res.status(401).json({ error: 'É necessário entrar na sua conta.' })
    if (!req.headers['content-type']?.includes('application/json')) return res.status(415).json({ error: 'Envie JSON.' })
    let body
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; if (!body || JSON.stringify(body).length > 4096) throw new Error() }
    catch { return res.status(400).json({ error: 'Dados inválidos.' }) }
    try {
      const { auth, db } = services()
      let identity
      try { identity = await auth.verifyIdToken(token, true) } catch { return res.status(401).json({ error: 'Sessão inválida ou expirada. Entre novamente.' }) }
      const result = await changePassword({ auth, db, uid: identity.uid, input: body, apiKey: getApiKey() })
      return res.status(200).json(result)
    } catch (error) {
      // Não registrar corpo, senha, token, resposta do Firebase ou erro SMTP.
      return res.status(error.status || 500).json({ error: error.status ? error.message : 'Não foi possível concluir a operação. Confira a configuração do servidor.' })
    }
  }
}
export default createPasswordHandler()
