import test from 'node:test'
import assert from 'node:assert/strict'
import { planCompactSchema } from '../server/schema-v3.js'
const newProject = 'PPPPPPPPPPPPPPPPPPPP', newCategory = 'CCCCCCCCCCCCCCCCCCCC'
function fixture() {
  return {
    users: [{ id: 'member', path: 'users/member', data: { id: 'member', name: 'Pessoa', email: 'pessoa@example.com', role: 'user', active: true, createdAt: 'old', createdBy: 'admin' } }],
    projects: [{ id: 'main', path: 'renovations/main', data: { id: 'main', name: 'Casa', schemaVersion: 2, budgetCents: 80000, memberIds: ['member'], members: [{ id: 'member', name: 'Pessoa' }], deleted: false, updatedAt: 'old', updatedBy: 'admin' } }],
    categories: [{ id: 'main__material', path: 'categories/main__material', data: { categoryId: 'material', name: 'Material', color: '#157154', renovationId: 'main', active: true, createdAt: 'old', createdBy: 'admin', updatedAt: 'old', updatedBy: 'admin' } }],
    expenses: [{ id: 'expense', renovationId: 'main', path: 'renovations/main/expenses/expense', data: { categoryId: 'material', amountCents: 12345, installments: 6, paidInstallments: 2, description: 'Antes', createdAt: 'old' } }],
  }
}
const allocate = collection => collection === 'renovations' ? newProject : newCategory
export function applyPlan(input, actions) {
  const keyFor = path => path.includes('/expenses/') ? 'expenses' : path.startsWith('renovations/') ? 'projects' : path.startsWith('categories/') ? 'categories' : 'users'
  for (const action of actions) {
    const key = keyFor(action.path), index = input[key].findIndex(record => record.path === action.path)
    if (action.type === 'delete') input[key].splice(index, 1)
    else if (action.type === 'set') input[key][index].data = action.data
    else input[key].push({ id: action.path.split('/').at(-1), path: action.path, data: action.data, ...(key === 'expenses' ? { renovationId: action.path.split('/')[1] } : {}) })
  }
}
test('IDs automáticos e campos mínimos preservam o orçamento, membros e valores das despesas', () => {
  const input = fixture(), before = structuredClone(input), plan = planCompactSchema(input, allocate)
  assert.deepEqual(input, before)
  const category = plan.actions.find(action => action.path === `categories/${newCategory}` && action.type === 'create').data
  assert.deepEqual(category, { ID: newCategory, name: 'Material', color: '#157154', active: true, renovationId: newProject })
  const project = plan.actions.find(action => action.path === `renovations/${newProject}` && action.type === 'create').data
  assert.equal(project.id, newProject); assert.equal(project.memberIds, undefined); assert.equal(project.updatedAt, undefined); assert.equal(project.updatedBy, undefined)
  assert.equal(project.budgetCents, 80000); assert.deepEqual(project.members, before.projects[0].data.members)
  const expense = plan.actions.find(action => action.path === `renovations/${newProject}/expenses/expense` && action.type === 'create').data
  assert.deepEqual(expense, { ...before.expenses[0].data, categoryId: newCategory })
  const user = plan.actions.find(action => action.path === 'users/member').data
  assert.equal(user.createdAt, undefined); assert.equal(user.createdBy, undefined); assert.equal(user.active, true)
  applyPlan(input, plan.actions)
  assert.deepEqual(planCompactSchema(input, () => { throw new Error('Não deve gerar novos IDs') }).actions, [])
})
test('categorias, despesas e membros inconsistentes impedem toda a migração', () => {
  const input = fixture(); input.expenses[0].data.categoryId = 'missing'
  assert.throws(() => planCompactSchema(input, allocate), /Despesa sem categoria/)
  input.expenses = []; input.projects[0].data.members.push({ id: 'unknown', name: 'Pessoa' })
  assert.throws(() => planCompactSchema(input, allocate), /Membro indisponível/)
})
test('ID já automático de reforma é preservado, incluindo referências a ela', () => {
  const input = fixture()
  input.projects[0] = { id: newProject, path: `renovations/${newProject}`, data: { ...input.projects[0].data, id: newProject } }
  input.categories[0].data.renovationId = newProject; input.expenses[0].renovationId = newProject; input.expenses[0].path = `renovations/${newProject}/expenses/expense`
  const plan = planCompactSchema(input, allocate)
  assert.equal(plan.projectIds[newProject], newProject)
  assert.equal(plan.actions.some(action => action.type === 'delete' && action.path === `renovations/${newProject}`), false)
})
