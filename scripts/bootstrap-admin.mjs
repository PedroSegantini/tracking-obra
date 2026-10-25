import { adminServices } from '../server/firebase-admin.js'
import { INITIAL_CATEGORIES, MAX_CENTS } from '../src/lib/domain.js'
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim()
if (!email) throw new Error('Preencha BOOTSTRAP_ADMIN_EMAIL em .env.admin.')
const budgetCents = Number(process.env.INITIAL_BUDGET_CENTS || 0)
if (!Number.isSafeInteger(budgetCents) || budgetCents < 0 || budgetCents > MAX_CENTS) throw new Error('INITIAL_BUDGET_CENTS inválido.')
const { auth, db } = adminServices()
const user = await auth.getUserByEmail(email)
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: 'admin' })
await db.runTransaction(async tx => {
  const renovation = db.doc('renovations/main'), member = db.doc(`renovations/main/members/${user.uid}`)
  const settings = await tx.get(renovation)
  const categories = await Promise.all(INITIAL_CATEGORIES.map(c => tx.get(renovation.collection('categories').doc(c.id))))
  if (!settings.exists) tx.create(renovation, { name: 'Nossa reforma', budgetCents, updatedAt: new Date(), updatedBy: user.uid })
  tx.set(member, { name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || user.displayName || 'Administrador', email: user.email, role: 'admin', active: true, createdBy: user.uid, createdAt: new Date() }, { merge: true })
  INITIAL_CATEGORIES.forEach(({ id, ...c }, i) => { if (!categories[i].exists) tx.create(renovation.collection('categories').doc(id), { ...c, createdAt: new Date(), createdBy: user.uid, updatedAt: new Date(), updatedBy: user.uid }) })
})
console.log('Administrador e estrutura inicial configurados. Saia e entre no aplicativo para atualizar a sessão.')
