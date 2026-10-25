import test from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { planCompactSchema } from '../server/schema-v3.js'
import { applySchemaActions } from '../server/schema-migration.js'
test('emulador move IDs e despesas e remove campos atomicamente, sem deixar subcoleções órfãs', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Execute via emulators:exec.')
  const app = initializeApp({ projectId: 'demo-tracking-v3' }, `v3-${Date.now()}`), db = getFirestore(app)
  const records = snapshot => snapshot.docs.map(doc => ({ id: doc.id, path: doc.ref.path, data: doc.data(), updateTime: doc.updateTime }))
  async function load() {
    const [users, projects, categories] = await Promise.all(['users', 'renovations', 'categories'].map(path => db.collection(path).get())), expenses = []
    for (const project of projects.docs) expenses.push(...records(await project.ref.collection('expenses').get()).map(record => ({ ...record, renovationId: project.id })))
    return { users: records(users), projects: records(projects), categories: records(categories), expenses }
  }
  try {
    await db.doc('users/user').set({ id: 'user', name: 'Pessoa', email: 'pessoa@example.com', role: 'user', active: true, createdAt: new Date(), createdBy: 'admin' })
    await db.doc('renovations/main').set({ id: 'main', schemaVersion: 2, name: 'Casa', budgetCents: 80000, members: [{ id: 'user', name: 'Pessoa' }], memberIds: ['user'], deleted: false, updatedAt: new Date(), updatedBy: 'user' })
    await db.doc('categories/main__material').set({ name: 'Material', categoryId: 'material', renovationId: 'main', color: '#157154', active: true, createdAt: new Date(), createdBy: 'user' })
    const expense = { amountCents: 12345, categoryId: 'material', installments: 6, paidInstallments: 2 }
    await db.doc('renovations/main/expenses/old').set(expense)
    const input = await load(), plan = planCompactSchema(input, collection => db.collection(collection).doc().id)
    const paths = ['users', 'renovations', 'categories', 'renovations/main/expenses']
    await db.doc('renovations/main/expenses/concurrent').set(expense)
    await assert.rejects(applySchemaActions(db, plan.actions, Object.values(input).flat(), paths), /mudaram/)
    assert.equal((await db.doc('renovations/main').get()).exists, true)
    await db.doc('renovations/main/expenses/concurrent').delete()
    await applySchemaActions(db, plan.actions, Object.values(input).flat(), paths)
    const projectId = plan.projectIds.main, categoryId = plan.categoryIds.main__material
    assert.equal((await db.doc('renovations/main').get()).exists, false)
    assert.equal((await db.doc('renovations/main/expenses/old').get()).exists, false)
    assert.deepEqual(await db.doc('renovations/main').listCollections(), [])
    assert.equal((await db.doc('categories/main__material').get()).exists, false)
    assert.deepEqual((await db.doc(`renovations/${projectId}/expenses/old`).get()).data(), { ...expense, categoryId })
    const project = (await db.doc(`renovations/${projectId}`).get()).data()
    assert.equal(project.id, projectId); assert.equal(project.memberIds, undefined); assert.equal(project.updatedAt, undefined)
    assert.equal((await db.doc('users/user').get()).data().createdAt, undefined)
    assert.deepEqual(planCompactSchema(await load(), () => { throw new Error('Não deve gerar IDs novamente') }).actions, [])
  } finally { for (const path of ['users', 'categories', 'renovations']) await db.recursiveDelete(db.collection(path)); await deleteApp(app) }
})
