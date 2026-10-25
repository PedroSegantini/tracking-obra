import test from 'node:test'
import assert from 'node:assert/strict'
import { planSchemaMigration, planLegacyCleanup } from '../server/schema-migration.js'
function fixture() {
  return {
    users: [], categories: [],
    legacyUsers: [{ id: 'admin', path: 'renovations/main/members/admin', data: { name: 'Pedro', email: 'pedro@example.com', role: 'admin', active: true } }, { id: 'other', path: 'renovations/main/members/other', data: { name: 'Pedro', email: 'other@example.com', role: 'user', active: true } }],
    projects: [{ id: 'main', path: 'renovations/main', data: { name: 'Casa', budgetCents: 8000000, deleted: false, memberIds: ['admin'] } }],
    legacyCategories: [{ id: 'material', renovationId: 'main', path: 'renovations/main/categories/material', data: { name: 'Material', active: true, color: '#157154' } }],
  }
}
function apply(input, actions) {
  const collections = { users: input.users, categories: input.categories, renovations: input.projects }
  for (const action of actions) {
    const records = collections[action.path.split('/')[0]]
    const existing = records.find(record => record.path === action.path)
    if (existing) Object.assign(existing.data, action.data)
    else records.push({ id: action.path.split('/').at(-1), path: action.path, data: action.data })
  }
}
test('migração copia perfis com cargo e autorização e categorias sem tocar em expenses', () => {
  const f = fixture(), original = structuredClone(f), actions = planSchemaMigration(f)
  assert.deepEqual(f, original)
  assert.equal(actions.find(action => action.path === 'users/admin').data.id, 'admin')
  assert.equal(actions.find(action => action.path === 'users/admin').data.role, 'admin')
  assert.deepEqual(actions.find(action => action.path === 'renovations/main').data.members, [{ id: 'admin', name: 'Pedro' }])
  assert.equal(actions.find(action => action.path === 'categories/main__material').data.renovationId, 'main')
  assert.ok(actions.every(action => !action.path.includes('/expenses/') && action.type !== 'delete'))
  apply(f, actions); assert.deepEqual(planSchemaMigration(f), [])
})
test('nomes repetidos não criam vínculos e listas vazias permanecem vazias', () => {
  const f = fixture()
  f.projects.push({ id: 'empty', path: 'renovations/empty', data: { memberIds: [], deleted: false } })
  const actions = planSchemaMigration(f)
  assert.deepEqual(actions.find(action => action.path === 'renovations/main').data.memberIds, ['admin'])
  assert.deepEqual(actions.find(action => action.path === 'renovations/empty').data.members, [])
})
test('conflitos de categoria e membros desconhecidos abortam o planejamento', () => {
  const f = fixture()
  f.categories.push({ id: 'main__material', path: 'categories/main__material', data: { name: 'Outro' } })
  assert.throws(() => planSchemaMigration(f), /Conflito/)
  f.categories = []; f.projects[0].data.memberIds = ['unknown']
  assert.throws(() => planSchemaMigration(f), /Vínculo indisponível/)
})
test('migração preserva alterações nos perfis novos em execuções repetidas', () => {
  const f = fixture(); apply(f, planSchemaMigration(f))
  f.users.find(user => user.id === 'admin').data.name = 'Novo nome'
  const actions = planSchemaMigration(f)
  assert.equal(actions.length, 1); assert.equal(actions[0].path, 'renovations/main')
  assert.equal(actions[0].data.members[0].name, 'Novo nome')
})
test('limpeza exige cópias verificadas, não apaga usuários novos ou despesas', () => {
  const f = fixture()
  assert.throws(() => planLegacyCleanup(f), /Migração incompleta/)
  apply(f, planSchemaMigration(f))
  const actions = planLegacyCleanup(f)
  assert.equal(actions.length, 3)
  assert.ok(actions.every(action => action.type === 'delete' && (action.path.includes('/members/') || action.path.includes('/categories/'))))
  f.categories[0].data.color = '#000000'
  assert.throws(() => planLegacyCleanup(f), /divergente/)
})
