import { validateUserInput } from '../src/lib/domain.js'
export function requireAdmin(token, member) {
  if (!token?.uid || token.role !== 'admin' || !member || member.active !== true || member.role !== 'admin') {
    const error = new Error('Apenas administradores ativos podem gerenciar contas e reformas.'); error.status = 403; throw error
  }
}
export async function provisionUser({ auth, db, actorUid, input }) {
  const data = validateUserInput(input)
  const record = await auth.createUser({ email: data.email, password: data.password, displayName: data.name, emailVerified: false, disabled: false })
  try {
    await auth.setCustomUserClaims(record.uid, { role: data.role })
    await db.doc(`renovations/main/members/${record.uid}`).create({ name: data.name, email: data.email, role: data.role, active: true, createdBy: actorUid, createdAt: new Date() })
  } catch (error) {
    // Sem vínculo e cargo completos, não deixar uma conta parcialmente provisionada.
    try { await auth.deleteUser(record.uid) } catch { console.error('Falha ao desfazer provisionamento. Revisar UID:', record.uid) }
    throw error
  }
  return { uid: record.uid, name: data.name, email: data.email, role: data.role }
}
