import test, { before, after, beforeEach } from 'node:test'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, serverTimestamp, writeBatch, query, where } from 'firebase/firestore'
let env
const first = 'AAAAAAAAAAAAAAAAAAAA', second = 'BBBBBBBBBBBBBBBBBBBB', material = 'CCCCCCCCCCCCCCCCCCCC', otherCategory = 'DDDDDDDDDDDDDDDDDDDD'
const members = [{ id: 'member', name: 'Pessoa' }, { id: 'admin', name: 'Admin' }]
const dbFor = (uid, role) => env.authenticatedContext(uid, role ? { role } : {}).firestore()
const category = (id, renovationId) => ({ ID: id, name: 'Material', color: '#157154', active: true, renovationId })
const project = (id, uid = 'admin') => ({ id, schemaVersion: 3, name: 'Apartamento', budgetCents: 0, deleted: false, members: [{ id: uid, name: uid === 'admin' ? 'Admin' : 'Pessoa' }] })
const expense = () => ({ amountCents: 10000, date: '2026-10-24', categoryId: material, paymentMethod: 'credit', installments: 3, paidInstallments: 1, description: '', createdBy: 'member', updatedBy: 'member', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-tracking-obra', firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 } }) })
after(async () => { await env?.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    await setDoc(doc(db, `renovations/${first}`), { ...project(first), members })
    await setDoc(doc(db, 'users/member'), { id: 'member', name: 'Pessoa', email: 'pessoa@example.com', role: 'user', active: true })
    await setDoc(doc(db, 'users/admin'), { id: 'admin', name: 'Admin', email: 'admin@example.com', role: 'admin', active: true })
    await setDoc(doc(db, `categories/${material}`), category(material, first))
  })
})
test('acesso exige autorização, vínculo com ID correto e perfil próprio é privado', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `renovations/${first}`)))
  await assertFails(getDoc(doc(dbFor('outsider'), `renovations/${first}`)))
  await assertSucceeds(getDoc(doc(dbFor('outsider'), 'users/outsider')))
  await assertFails(getDoc(doc(dbFor('member'), 'users/admin')))
  await assertFails(getDocs(collection(dbFor('member'), 'users')))
  await assertSucceeds(getDocs(collection(dbFor('admin', 'admin'), 'users')))
  await assertFails(updateDoc(doc(dbFor('member'), 'users/member'), { role: 'admin' }))
})
test('consulta usa somente members e bloqueia consulta ampla e nome com outro ID', async () => {
  const db = dbFor('member')
  await assertFails(getDocs(collection(db, 'renovations')))
  await assertSucceeds(getDocs(query(collection(db, 'renovations'), where('deleted', '==', false), where('members', 'array-contains', members[0]))))
  await assertFails(getDocs(query(collection(db, 'renovations'), where('deleted', '==', false), where('members', 'array-contains', { id: 'admin', name: 'Admin' }))))
  await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'users/same-name'), { id: 'same-name', name: 'Pessoa', email: 'outro@example.com', role: 'user', active: true }))
  await assertFails(getDoc(doc(dbFor('same-name'), `renovations/${first}`)))
})
test('membro edita orçamento sem metadados e registra despesa com categoria auto ID', async () => {
  const db = dbFor('member')
  await assertSucceeds(updateDoc(doc(db, `renovations/${first}`), { budgetCents: 200000 }))
  await assertSucceeds(setDoc(doc(db, `renovations/${first}/expenses/one`), expense()))
  await assertFails(updateDoc(doc(db, `renovations/${first}`), { updatedAt: serverTimestamp() }))
  await assertFails(updateDoc(doc(db, `renovations/${first}`), { memberIds: ['member'] }))
  await assertFails(updateDoc(doc(db, `renovations/${first}`), { members: [{ id: 'member', name: 'Admin' }] }))
})
test('só admin cria reforma e categorias juntas, IDs e nomes devem corresponder', async () => {
  await assertFails(setDoc(doc(dbFor('member'), `renovations/${second}`), project(second, 'member')))
  await assertFails(setDoc(doc(dbFor('admin', 'user'), `renovations/${second}`), project(second)))
  await assertFails(setDoc(doc(dbFor('outsider', 'admin'), `renovations/${second}`), project(second)))
  const db = dbFor('admin', 'admin'), batch = writeBatch(db)
  batch.set(doc(db, `renovations/${second}`), project(second))
  batch.set(doc(db, `categories/${otherCategory}`), category(otherCategory, second))
  await assertSucceeds(batch.commit())
  await assertFails(setDoc(doc(db, 'renovations/main'), project('main')))
  await assertFails(setDoc(doc(db, 'renovations/EEEEEEEEEEEEEEEEEEEE'), { ...project('EEEEEEEEEEEEEEEEEEEE'), id: second }))
  await assertFails(setDoc(doc(db, 'renovations/FFFFFFFFFFFFFFFFFFFF'), { ...project('FFFFFFFFFFFFFFFFFFFF'), members: [{ id: 'admin', name: 'Falso' }] }))
})
test('categorias têm apenas campos solicitados e mantêm o vínculo da reforma', async () => {
  const db = dbFor('member')
  await assertSucceeds(getDocs(query(collection(db, 'categories'), where('renovationId', '==', first))))
  await assertFails(getDocs(collection(db, 'categories')))
  await assertSucceeds(setDoc(doc(db, `categories/${otherCategory}`), category(otherCategory, first)))
  await assertSucceeds(updateDoc(doc(db, `categories/${otherCategory}`), { active: false }))
  await assertFails(updateDoc(doc(db, `categories/${otherCategory}`), { renovationId: second }))
  await assertFails(setDoc(doc(db, 'categories/EEEEEEEEEEEEEEEEEEEE'), { ...category('EEEEEEEEEEEEEEEEEEEE', first), categoryId: 'material' }))
  await assertFails(setDoc(doc(db, 'categories/FFFFFFFFFFFFFFFFFFFF'), { ...category('FFFFFFFFFFFFFFFFFFFF', first), createdAt: serverTimestamp() }))
  await assertFails(setDoc(doc(db, 'categories/GGGGGGGGGGGGGGGGGGGG'), category(otherCategory, first)))
})
test('categoria de outra reforma e categoria inativa não aceitam novas despesas', async () => {
  const db = dbFor('member')
  await assertSucceeds(setDoc(doc(db, `renovations/${first}/expenses/one`), expense()))
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), `renovations/${second}`), { ...project(second), members })
    await updateDoc(doc(context.firestore(), `categories/${material}`), { active: false })
  })
  await assertFails(setDoc(doc(db, `renovations/${first}/expenses/two`), expense()))
  await assertSucceeds(updateDoc(doc(db, `renovations/${first}/expenses/one`), { paidInstallments: 2, updatedAt: serverTimestamp(), updatedBy: 'member' }))
  await assertFails(setDoc(doc(db, `renovations/${second}/expenses/wrong`), expense()))
})
test('despesa rejeita parcelas, valor, data e autor inválidos', async () => {
  const db = dbFor('member')
  for (const patch of [{ paidInstallments: 4 }, { amountCents: -1 }, { createdBy: 'admin' }, { date: '2026-02-31' }, { paymentMethod: 'pix', installments: 3 }, { categoryId: 'material' }]) await assertFails(setDoc(doc(db, `renovations/${first}/expenses/invalid`), { ...expense(), ...patch }))
})
test('renomear membro atomicamente mantém acesso e a nova consulta por members', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore(), batch = writeBatch(db)
    batch.update(doc(db, 'users/member'), { name: 'Novo nome' })
    batch.update(doc(db, `renovations/${first}`), { members: [{ id: 'member', name: 'Novo nome' }, members[1]] })
    await batch.commit()
  })
  await assertSucceeds(getDocs(query(collection(dbFor('member'), 'renovations'), where('deleted', '==', false), where('members', 'array-contains', { id: 'member', name: 'Novo nome' }))))
})
test('remover vínculo ou excluir reforma revoga despesas e categorias', async () => {
  await env.withSecurityRulesDisabled(async context => updateDoc(doc(context.firestore(), `renovations/${first}`), { members: [members[1]] }))
  await assertFails(getDocs(collection(dbFor('member'), `renovations/${first}/expenses`)))
  await assertFails(getDoc(doc(dbFor('member'), `categories/${material}`)))
  await env.withSecurityRulesDisabled(async context => updateDoc(doc(context.firestore(), `renovations/${first}`), { deleted: true, members: [] }))
  await assertFails(getDocs(collection(dbFor('admin', 'admin'), `renovations/${first}/expenses`)))
  await assertSucceeds(getDoc(doc(dbFor('admin', 'admin'), 'users/admin')))
})
