import { adminServices } from '../server/firebase-admin.js'
const email = process.argv[2], role = process.argv[3] || 'user', renovationId = process.argv[4]
if (renovationId && !/^[a-zA-Z0-9_-]{1,128}$/.test(renovationId)) throw new Error('Identificador de reforma inválido.')
if (!email || !['user', 'admin'].includes(role)) throw new Error('Uso: node --env-file=.env.admin scripts/authorize-member.mjs EMAIL [user|admin] [ID_REFORMA]')
const { auth, db } = adminServices(), user = await auth.getUserByEmail(email)
const name = user.displayName || email.split('@')[0]
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role })
await db.runTransaction(async tx => {
  const profile = db.doc(`users/${user.uid}`), previous = await tx.get(profile)
  // Preserva o nome já configurado e mantém snapshots dos vínculos consistentes.
  const displayName = previous.exists ? previous.data().name : name
  const projectRef = renovationId ? db.doc(`renovations/${renovationId}`) : null
  const project = projectRef ? await tx.get(projectRef) : null
  if (project && (!project.exists || project.data().deleted || project.data().schemaVersion !== 3)) throw new Error('Reforma não encontrada ou ainda não migrada.')
  if (project) {
    const members = [...(project.data().members || []).filter(member => member.id !== user.uid), { id: user.uid, name: displayName }]
    if (members.length > 300) throw new Error('Limite de 300 membros por reforma.')
    tx.update(projectRef, { members })
  }
  tx.set(profile, { id: user.uid, name: displayName, email: user.email, role, active: true }, { merge: true })
})
console.log('Conta autorizada. Atrele-a a uma reforma se necessário e peça novo login.')
