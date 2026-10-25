import { adminServices } from '../../server/firebase-admin.js'
import { requireAdmin, provisionUser } from '../../server/create-user.js'
import { validateUserInput } from '../../src/lib/domain.js'
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método não permitido.' }) }
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
  if (!bearer) return res.status(401).json({ error: 'É necessário entrar na sua conta.' })
  if (!req.headers['content-type']?.includes('application/json')) return res.status(415).json({ error: 'Envie JSON.' })
  try {
    const { auth, db } = adminServices()
    let token
    try { token = await auth.verifyIdToken(bearer, true) } catch { return res.status(401).json({ error: 'Sessão inválida ou expirada. Entre novamente.' }) }
    const member = await db.doc(`users/${token.uid}`).get()
    requireAdmin(token, member.exists ? member.data() : null)
    let body
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      if (JSON.stringify(body ?? {}).length > 4096) throw new Error('Dados acima do limite.')
      body = validateUserInput(body)
    } catch (error) { return res.status(400).json({ error: error.message || 'Dados inválidos.' }) }
    const user = await provisionUser({ auth, db, actorUid: token.uid, input: body })
    return res.status(201).json({ user })
  } catch (error) {
    if (error.status === 403) return res.status(403).json({ error: error.message })
    if (error.code === 'auth/email-already-exists') return res.status(409).json({ error: 'Este e-mail já possui uma conta. Se foi criado pelo Google antes de ser autorizado, vincule o UID existente pelo procedimento do guia.' })
    if (['auth/invalid-password', 'auth/invalid-email'].includes(error.code)) return res.status(400).json({ error: 'E-mail ou senha inválidos.' })
    // Nunca registrar corpo, senha, token ou chave privada.
    console.error('Falha no provisionamento de usuário:', error.code || 'server-error')
    return res.status(500).json({ error: 'Não foi possível criar a conta. Confira a configuração do servidor.' })
  }
}
