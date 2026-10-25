import test from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { planSchemaMigration, planLegacyCleanup, applySchemaActions } from '../server/schema-migration.js'
const projectId = 'demo-tracking-schema'
test('migração real no emulador é atômica, repetível e preserva despesas', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Execute apenas via emulators:exec.')
  const app = initializeApp({ projectId }, `migration-${Date.now()}`), db = getFirestore(app)
  const records = snapshot => snapshot.docs.map(doc => ({ id: doc.id, path: doc.ref.path, data: doc.data(), updateTime: doc.updateTime }))
  async function load() {
    const [users, legacyUsers, projects, categories, legacyCategories] = await Promise.all(['users', 'renovations/main/members', 'renovations', 'categories', 'renovations/main/categories'].map(path => db.collection(path).get()))
    return { users: records(users), legacyUsers: records(legacyUsers), projects: records(projects), categories: records(categories), legacyCategories: records(legacyCategories).map(record => ({ ...record, renovationId: 'main' })) }
  }
  try {
    await db.doc('renovations/main/members/member').set({ name: 'Pessoa', email: 'pessoa@example.com', role: 'user', active: true })
    await db.doc('renovations/main').set({ name: 'Casa', memberIds: ['member'], deleted: false, budgetCents: 100000 })
    await db.doc('renovations/main/categories/material').set({ name: 'Material', color: '#157154', active: true })
    await db.doc('renovations/main/expenses/kept').set({ amountCents: 12345, paidInstallments: 2, installments: 6 })
    let input = await load(), actions = planSchemaMigration(input)
    // A concurrent edit to a source must abort the entire move.
    await db.doc('renovations/main/members/member').update({ name: 'Nome atualizado' })
    await assert.rejects(applySchemaActions(db, actions, Object.values(input).flat()), /mudaram/)
    assert.equal((await db.doc('users/member').get()).exists, false)
    input = await load(); actions = planSchemaMigration(input)
    await applySchemaActions(db, actions, Object.values(input).flat())
    assert.equal((await db.doc('users/member').get()).data().name, 'Nome atualizado')
    assert.deepEqual((await db.doc('renovations/main').get()).data().members, [{ id: 'member', name: 'Nome atualizado' }])
    input = await load(); assert.deepEqual(planSchemaMigration(input), [])
    await applySchemaActions(db, planLegacyCleanup(input), Object.values(input).flat())
    assert.equal((await db.collection('renovations/main/categories').get()).empty, true)
    assert.equal((await db.collection('renovations/main/members').get()).empty, true)
    assert.deepEqual((await db.doc('renovations/main/expenses/kept').get()).data(), { amountCents: 12345, paidInstallments: 2, installments: 6 })
    assert.equal((await db.doc('categories/main__material').get()).data().renovationId, 'main')
  } finally { await db.recursiveDelete(db.collection('renovations')); await db.recursiveDelete(db.collection('users')); await db.recursiveDelete(db.collection('categories')); await deleteApp(app) }
})
