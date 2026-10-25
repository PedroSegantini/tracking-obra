import { adminServices } from '../server/firebase-admin.js'
import { INITIAL_CATEGORIES, MAX_CENTS } from '../src/lib/domain.js'
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim()
if (!email) throw new Error('Preencha BOOTSTRAP_ADMIN_EMAIL em .env.admin.')
const budgetCents = Number(process.env.INITIAL_BUDGET_CENTS || 0)
if (!Number.isSafeInteger(budgetCents) || budgetCents < 0 || budgetCents > MAX_CENTS) throw new Error('INITIAL_BUDGET_CENTS inválido.')
const { auth, db } = adminServices(), user = await auth.getUserByEmail(email)
const profile = db.doc(`users/${user.uid}`), newProject = db.collection('renovations').doc()
const categoryRefs = INITIAL_CATEGORIES.map(() => db.collection('categories').doc())
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: 'admin' })
await db.runTransaction(async tx => {
  const previous = await tx.get(profile), projects = await tx.get(db.collection('renovations'))
  if (projects.docs.some(project => project.data().schemaVersion !== 3)) throw new Error('Execute migrate-schema.mjs antes do bootstrap.')
  const name = previous.exists ? previous.data().name : process.env.BOOTSTRAP_ADMIN_NAME?.trim() || user.displayName || 'Administrador'
  tx.set(profile, { id: user.uid, name, email: user.email, role: 'admin', active: true }, { merge: true })
  // A repeated bootstrap never adds another renovation or resets its budget.
  if (!projects.empty) return
  tx.create(newProject, { id: newProject.id, schemaVersion: 3, name: 'Nossa reforma', members: [{ id: user.uid, name }], deleted: false, budgetCents })
  INITIAL_CATEGORIES.forEach(({ id: unused, ...category }, index) => tx.create(categoryRefs[index], { ...category, ID: categoryRefs[index].id, renovationId: newProject.id }))
})
console.log('Administrador configurado. Saia e entre novamente no aplicativo.')
