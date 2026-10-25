// Uso excepcional: autorizar uma conta já existente que entrou pelo Google antes do cadastro.
import { adminServices } from '../server/firebase-admin.js'
const email = process.argv[2]
const role = process.argv[3] || 'user'
if (!email || !['user', 'admin'].includes(role)) throw new Error('Uso: node --env-file=.env.admin scripts/authorize-member.mjs EMAIL [user|admin]')
const { auth, db } = adminServices(), user = await auth.getUserByEmail(email)
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role })
await db.doc(`renovations/main/members/${user.uid}`).set({ name: user.displayName || email.split('@')[0], email: user.email, role, active: true, createdAt: new Date(), createdBy: 'local-operator' }, { merge: true })
console.log('Conta existente autorizada. O usuário deve sair e entrar novamente.')
