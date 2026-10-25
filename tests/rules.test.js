import test, { before, after, beforeEach } from 'node:test'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
let env
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-tracking-obra', firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 } }) })
after(async () => { await env?.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    await setDoc(doc(db, 'renovations/main'), { name: 'Nossa reforma', budgetCents: 100000 })
    await setDoc(doc(db, 'renovations/main/members/member'), { role: 'user', active: true })
    await setDoc(doc(db, 'renovations/main/members/admin'), { role: 'admin', active: true })
    await setDoc(doc(db, 'renovations/main/categories/material'), { name: 'Material', active: true })
  })
})
const expense = () => ({ amountCents: 10000, date: '2026-10-24', categoryId: 'material', paymentMethod: 'credit', installments: 3, paidInstallments: 1, description: '', createdBy: 'member', updatedBy: 'member', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
test('visitantes e contas não autorizadas não leem a reforma', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'renovations/main')))
  await assertFails(getDoc(doc(env.authenticatedContext('outsider').firestore(), 'renovations/main')))
  await assertSucceeds(getDoc(doc(env.authenticatedContext('outsider').firestore(), 'renovations/main/members/outsider')))
})
test('membro pode alterar orçamento e cadastrar despesa', async () => {
  const db = env.authenticatedContext('member').firestore()
  await assertSucceeds(updateDoc(doc(db, 'renovations/main'), { budgetCents: 200000, updatedBy: 'member', updatedAt: serverTimestamp() }))
  await assertSucceeds(setDoc(doc(db, 'renovations/main/expenses/one'), expense()))
})
test('membro não promove o próprio cargo nem lista membros', async () => {
  const db = env.authenticatedContext('member').firestore()
  await assertFails(updateDoc(doc(db, 'renovations/main/members/member'), { role: 'admin' }))
  await assertFails(getDocs(collection(db, 'renovations/main/members')))
  await assertSucceeds(getDocs(collection(env.authenticatedContext('admin', { role: 'admin' }).firestore(), 'renovations/main/members')))
})
test('banco rejeita parcela inválida, valor negativo, data impossível e autor falso', async () => {
  const db = env.authenticatedContext('member').firestore()
  for (const patch of [{ paidInstallments: 4 }, { amountCents: -1 }, { createdBy: 'admin' }, { date: '2026-02-31' }, { paymentMethod: 'pix', installments: 3 }]) await assertFails(setDoc(doc(db, 'renovations/main/expenses/invalid'), { ...expense(), ...patch }))
})
test('categoria inativa impede nova despesa e autor não pode ser alterado', async () => {
  const db = env.authenticatedContext('member').firestore()
  await assertSucceeds(setDoc(doc(db, 'renovations/main/expenses/one'), expense()))
  await env.withSecurityRulesDisabled(async c => updateDoc(doc(c.firestore(), 'renovations/main/categories/material'), { active: false }))
  await assertFails(setDoc(doc(db, 'renovations/main/expenses/two'), expense()))
  await assertSucceeds(updateDoc(doc(db, 'renovations/main/expenses/one'), { paidInstallments: 2, updatedAt: serverTimestamp(), updatedBy: 'member' }))
  await assertFails(updateDoc(doc(db, 'renovations/main/expenses/one'), { createdBy: 'admin', updatedAt: serverTimestamp(), updatedBy: 'member' }))
})

const project = (uid) => ({ name: 'Apartamento', budgetCents: 0, updatedBy: uid, updatedAt: serverTimestamp() })
test('só administrador com vínculo e claim cria reforma', async () => {
  const member = env.authenticatedContext('member').firestore()
  const fakeAdmin = env.authenticatedContext('admin', { role: 'user' }).firestore()
  const outsider = env.authenticatedContext('outsider', { role: 'admin' }).firestore()
  await assertFails(setDoc(doc(member, 'renovations/second'), project('member')))
  await assertFails(setDoc(doc(fakeAdmin, 'renovations/second'), project('admin')))
  await assertFails(setDoc(doc(outsider, 'renovations/second'), project('outsider')))
  const admin = env.authenticatedContext('admin', { role: 'admin' }).firestore()
  const batch = writeBatch(admin)
  batch.set(doc(admin, 'renovations/second'), project('admin'))
  batch.set(doc(admin, 'renovations/second/categories/pedreiro'), { name: 'Pedreiro', color: '#157154', active: true, createdBy: 'admin', updatedBy: 'admin', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  await assertSucceeds(batch.commit())
})
test('família lista e usa reformas; categoria deve pertencer à reforma selecionada', async () => {
  const admin = env.authenticatedContext('admin', { role: 'admin' }).firestore()
  await assertSucceeds(setDoc(doc(admin, 'renovations/second'), project('admin')))
  const member = env.authenticatedContext('member').firestore()
  await assertSucceeds(getDocs(collection(member, 'renovations')))
  await assertFails(getDocs(collection(env.authenticatedContext('outsider').firestore(), 'renovations')))
  await assertFails(setDoc(doc(member, 'renovations/second/expenses/invalid'), expense()))
  await assertSucceeds(setDoc(doc(member, 'renovations/second/categories/material'), { name: 'Material', color: '#c08b38', active: true, createdBy: 'member', updatedBy: 'member', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }))
  await assertSucceeds(setDoc(doc(member, 'renovations/second/expenses/one'), expense()))
  await assertSucceeds(updateDoc(doc(member, 'renovations/second'), { budgetCents: 500000, updatedBy: 'member', updatedAt: serverTimestamp() }))
  await assertFails(setDoc(doc(member, 'renovations/second/members/member'), { role: 'admin', active: true }))
})
