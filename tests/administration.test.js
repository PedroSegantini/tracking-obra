import test from 'node:test'
import assert from 'node:assert/strict'
import { editAccount, deleteAccount, linkMember, editRenovation, deleteRenovation } from '../server/manage-administration.js'
import { createManagementHandler } from '../api/admin/manage.js'
const profile = uid => `renovations/main/members/${uid}`
function fixture() {
  const data = new Map(Object.entries({
    [profile('admin')]: { name: 'Admin', email: 'admin@example.com', role: 'admin', active: true },
    [profile('member')]: { name: 'Pessoa', email: 'pessoa@example.com', role: 'user', active: true },
    'renovations/main': { name: 'Casa', budgetCents: 90000, memberIds: ['admin', 'member'], deleted: false },
    'renovations/second': { name: 'Apartamento', budgetCents: 12000, memberIds: ['admin'], deleted: false },
    'renovations/main/expenses/old': { amountCents: 5000, createdBy: 'member' },
  }))
  const clone = value => value === undefined ? undefined : structuredClone(value)
  const snapshot = path => ({ id: path.split('/').at(-1), ref: ref(path), exists: data.has(path), data: () => clone(data.get(path)) })
  function ref(path) { return { path, get: async () => snapshot(path), update: async patch => data.set(path, { ...data.get(path), ...clone(patch) }) } }
  function query(path, filters = []) {
    return { _query: true, where: (field, operator, value) => query(path, [...filters, { field, operator, value }]), get: async () => {
      const docs = [...data.keys()].filter(key => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/')).filter(key => filters.every(({ field, operator, value }) => operator === 'array-contains' ? data.get(key)[field]?.includes(value) : data.get(key)[field] === value)).map(snapshot)
      return { docs, size: docs.length }
    } }
  }
  const db = { doc: ref, collection: path => query(path), runTransaction: async callback => {
    const writes = []
    const result = await callback({ get: async target => { assert.equal(writes.length, 0, 'leitura após escrita na transação'); return target._query ? target.get() : snapshot(target.path) }, update: (target, patch) => writes.push({ path: target.path, patch }) })
    writes.forEach(({ path, patch }) => data.set(path, { ...data.get(path), ...clone(patch) }))
    return result
  } }
  const identities = new Map(['admin', 'member'].map(uid => [uid, { uid, displayName: data.get(profile(uid)).name, email: data.get(profile(uid)).email, emailVerified: true, customClaims: { role: data.get(profile(uid)).role, retained: true } }]))
  const events = []
  const auth = {
    getUser: async uid => { if (!identities.has(uid)) throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' }); return clone(identities.get(uid)) },
    updateUser: async (uid, patch) => { events.push(['update', uid]); identities.set(uid, { ...identities.get(uid), ...clone(patch) }) },
    setCustomUserClaims: async (uid, claims) => { events.push(['claims', uid]); identities.get(uid).customClaims = clone(claims) },
    revokeRefreshTokens: async uid => events.push(['revoke', uid]),
    deleteUser: async uid => { events.push(['delete', uid]); identities.delete(uid) },
  }
  return { data, db, auth, identities, events, actor: { uid: 'admin', role: 'admin' } }
}
test('edição atualiza Authentication, cargo e perfil sem guardar senha', async () => {
  const f = fixture()
  const result = await editAccount({ ...f, uid: 'member', input: { name: 'Novo nome', email: 'novo@example.com', role: 'admin', password: 'ignorar' } })
  assert.equal(f.data.get(profile('member')).name, 'Novo nome'); assert.equal(f.data.get(profile('member')).role, 'admin')
  assert.equal(f.identities.get('member').emailVerified, false); assert.deepEqual(f.identities.get('member').customClaims, { role: 'admin', retained: true })
  assert.equal(f.data.get(profile('member')).password, undefined); assert.equal(f.data.get(profile('member')).editingLock, null)
  assert.equal(result.sessionsRevoked, true); assert.ok(f.events.some(([action]) => action === 'revoke'))
})
test('não permite autoexclusão, autorrebaixamento ou operação por usuário comum', async () => {
  const f = fixture()
  await assert.rejects(deleteAccount({ ...f, uid: 'admin' }), /própria conta/)
  await assert.rejects(editAccount({ ...f, uid: 'admin', input: { name: 'Admin', email: 'admin@example.com', role: 'user' } }), /próprio cargo/)
  await assert.rejects(editAccount({ ...f, actor: { uid: 'member', role: 'user' }, uid: 'member', input: { name: 'Pessoa', email: 'pessoa@example.com', role: 'admin' } }), /administradores/)
  assert.equal(f.events.length, 0)
})
test('conta com edição em andamento não pode ser sobrescrita nem removida', async () => {
  const f = fixture(); Object.assign(f.data.get(profile('member')), { editingLock: 'another', editingUntil: Date.now() + 100000 })
  await assert.rejects(editAccount({ ...f, uid: 'member', input: { name: 'Nome', email: 'nome@example.com', role: 'user' } }), /sendo editada/)
  await assert.rejects(deleteAccount({ ...f, uid: 'member' }), /sendo editada/)
  assert.equal(f.events.length, 0)
})
test('falha nas claims desfaz edição externa e libera bloqueio de edição', async () => {
  const f = fixture(); f.auth.setCustomUserClaims = async () => { throw new Error('claims failed') }
  await assert.rejects(editAccount({ ...f, uid: 'member', input: { name: 'Novo', email: 'novo@example.com', role: 'user' } }), /claims failed/)
  assert.equal(f.identities.get('member').email, 'pessoa@example.com'); assert.equal(f.data.get(profile('member')).name, 'Pessoa'); assert.equal(f.data.get(profile('member')).editingLock, null)
})
test('remover conta bloqueia vínculo, remove login e vínculos, preserva gastos', async () => {
  const f = fixture()
  await deleteAccount({ ...f, uid: 'member' })
  assert.equal(f.identities.has('member'), false); assert.equal(f.data.get(profile('member')).active, false); assert.equal(f.data.get(profile('member')).deleting, false)
  assert.deepEqual(f.data.get('renovations/main').memberIds, ['admin']); assert.equal(f.data.get('renovations/main/expenses/old').amountCents, 5000)
})
test('exclusão incompleta bloqueia acesso e pode ser repetida com segurança', async () => {
  const f = fixture(), originalDelete = f.auth.deleteUser
  f.auth.deleteUser = async () => { throw new Error('network') }
  await assert.rejects(deleteAccount({ ...f, uid: 'member' }), /pendente/)
  assert.equal(f.data.get(profile('member')).active, false); assert.equal(f.data.get(profile('member')).deleting, true)
  f.auth.deleteUser = originalDelete; await deleteAccount({ ...f, uid: 'member' })
  assert.equal(f.data.get(profile('member')).deleting, false)
})
test('atrelar membro é idempotente e não aceita conta desativada', async () => {
  const f = fixture()
  await linkMember({ ...f, uid: 'member', renovationId: 'second' }); await linkMember({ ...f, uid: 'member', renovationId: 'second' })
  assert.deepEqual(f.data.get('renovations/second').memberIds, ['admin', 'member'])
  f.data.get(profile('member')).active = false
  await assert.rejects(linkMember({ ...f, uid: 'member', renovationId: 'second' }), /não encontrado/)
})
test('editar reforma renomeia e gerencia vínculos sem alterar despesas nem orçamento', async () => {
  const f = fixture()
  await editRenovation({ ...f, renovationId: 'main', input: { name: 'Casa renovada', memberIds: ['admin'] } })
  assert.equal(f.data.get('renovations/main').name, 'Casa renovada'); assert.equal(f.data.get('renovations/main').budgetCents, 90000); assert.deepEqual(f.data.get('renovations/main').memberIds, ['admin'])
  assert.equal(f.data.get('renovations/main/expenses/old').createdBy, 'member')
  await assert.rejects(editRenovation({ ...f, renovationId: 'main', input: { name: 'Casa', memberIds: ['inexistente'] } }), /não está mais disponível/)
})
test('excluir reforma preserva histórico e os perfis que ficam no caminho main', async () => {
  const f = fixture()
  await deleteRenovation({ ...f, renovationId: 'main' })
  assert.equal(f.data.get('renovations/main').deleted, true); assert.deepEqual(f.data.get('renovations/main').memberIds, [])
  assert.equal(f.data.get(profile('admin')).active, true); assert.ok(f.data.has('renovations/main/expenses/old'))
  await assert.rejects(linkMember({ ...f, uid: 'member', renovationId: 'main' }), /não encontrada/)
})
test('endpoint exige claim e perfil administrativos e não confia no ator do corpo', async () => {
  const f = fixture(); let called = false
  f.auth.verifyIdToken = async (token, revoked) => { assert.equal(revoked, true); return { uid: 'member', role: 'user' } }
  const response = () => ({ code: null, setHeader() {}, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
  const handler = createManagementHandler({ services: () => f, manage: async () => { called = true } })
  const res = response()
  await handler({ method: 'POST', headers: { authorization: 'Bearer fake', 'content-type': 'application/json' }, body: { action: 'delete-account', actorUid: 'admin', uid: 'admin' } }, res)
  assert.equal(res.code, 403); assert.equal(called, false)
})
