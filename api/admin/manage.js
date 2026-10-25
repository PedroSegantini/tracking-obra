import { adminServices } from '../../server/firebase-admin.js'
import { requireAdmin } from '../../server/create-user.js'
import { manageAdministration } from '../../server/manage-administration.js'
export function createManagementHandler({ services = adminServices, manage = manageAdministration } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método não permitido.' }) }
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
    if (!bearer) return res.status(401).json({ error: 'Entre na sua conta.' })
    if (!req.headers['content-type']?.includes('application/json')) return res.status(415).json({ error: 'Envie JSON.' })
    let body
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; if (!body || JSON.stringify(body).length > 45000) throw new Error() }
    catch { return res.status(400).json({ error: 'Dados inválidos.' }) }
    try {
      const { auth, db } = services()
      let actor
      try { actor = await auth.verifyIdToken(bearer, true) } catch { return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' }) }
      const member = await db.doc(`renovations/main/members/${actor.uid}`).get()
      requireAdmin(actor, member.exists ? member.data() : null)
      const result = await manage({ auth, db, actor, body })
      return res.status(200).json(result)
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message })
      if (error.code === 'auth/email-already-exists') return res.status(409).json({ error: 'Este e-mail já pertence a outra conta.' })
      if (error.code === 'auth/user-not-found') return res.status(404).json({ error: 'Conta não encontrada no Firebase.' })
      if (error.code === 'auth/invalid-email') return res.status(400).json({ error: 'E-mail inválido.' })
      return res.status(500).json({ error: 'Não foi possível concluir. Confira a configuração do servidor e tente novamente.' })
    }
  }
}
export default createManagementHandler()
