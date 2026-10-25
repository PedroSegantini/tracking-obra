// Uso excepcional: autorizar uma conta já existente que entrou pelo Google antes do cadastro.
import { adminServices } from '../server/firebase-admin.js'
const email = process.argv[2]
const role = process.argv[3] || 'user'
const renovationId = process.argv[4]
if (renovationId && !/^[a-zA-Z0-9_-]{1,128}$/.test(renovationId)) throw new Error('Identificador de reforma inválido.')
if (!email || !['user', 'admin'].includes(role)) throw new Error('Uso: node --env-file=.env.admin scripts/authorize-member.mjs EMAIL [user|admin] [ID_REFORMA]')
const { auth, db } = adminServices(), user = await auth.getUserByEmail(email)
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role })
await db.doc(`renovations/main/members/${user.uid}`).set({ name: user.displayName || email.split('@')[0], email: user.email, role, active: true, createdAt: new Date(), createdBy: 'local-operator' }, { merge: true })
if (renovationId) {
  await db.runTransaction(async tx => {
    const ref = db.doc(`renovations/${renovationId}`), project = await tx.get(ref)
    if (!project.exists || project.data().deleted) throw new Error('Reforma não encontrada.')
    tx.update(ref, { memberIds: [...new Set([...(project.data().memberIds || []), user.uid])] })
  })
}
console.log('Conta autorizada. Atrele-a a uma reforma na administração se necessário e peça novo login.')
