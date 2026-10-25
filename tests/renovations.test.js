import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
let vite, app, cache
const memory = new Map()
const originalStorage = globalThis.localStorage
const originalMode = process.env.VITE_APP_MODE
before(async () => {
  process.env.VITE_APP_MODE = 'demo'
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
  cache = await mkdtemp(join(tmpdir(), 'obra-tests-'))
  vite = await createServer({ root: resolve('.'), configFile: false, cacheDir: cache, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } })
  app = await vite.ssrLoadModule('/src/store.js')
  assert.equal(app.store.demo, true)
})
after(async () => { await vite?.close(); if (cache) await rm(cache, { recursive: true, force: true }); globalThis.localStorage = originalStorage; if (originalMode === undefined) delete process.env.VITE_APP_MODE; else process.env.VITE_APP_MODE = originalMode })
beforeEach(async () => { await app.logout(); memory.clear(); app.loginDemo() })
test('nova reforma inicia vazia e troca mantém orçamento, categorias e despesas separados', async () => {
  const originalCount = app.store.expenses.length
  await app.saveBudget(120000)
  await app.addCategory('Pintura', '#157154')
  await app.createRenovation('Apartamento')
  const id = app.store.selectedRenovationId
  assert.notEqual(id, 'main'); assert.equal(app.store.budgetCents, 0); assert.equal(app.store.expenses.length, 0)
  assert.equal(app.store.categories.some(c => c.id === 'pintura'), false)
  await app.saveBudget(900000)
  await app.saveExpense({ amountCents: 75000, date: '2026-10-24', categoryId: 'material', paymentMethod: 'pix', installments: 1, paidInstallments: 1, description: 'Nova obra' })
  app.selectRenovation('main')
  assert.equal(app.store.budgetCents, 120000); assert.equal(app.store.expenses.length, originalCount); assert.equal(app.store.categories.some(c => c.id === 'pintura'), true)
  app.selectRenovation(id)
  assert.equal(app.store.budgetCents, 900000); assert.equal(app.store.expenses.length, 1); assert.equal(app.store.expenses[0].description, 'Nova obra')
  await app.logout(); app.loginDemo()
  assert.equal(app.store.selectedRenovationId, id); assert.equal(app.store.expenses.length, 1)
})
test('usuário comum seleciona reforma mas não cria e nomes inválidos são rejeitados', async () => {
  await assert.rejects(app.createRenovation(' '), /nome/)
  await assert.rejects(app.createRenovation('a'.repeat(81)), /nome/)
  await app.createRenovation('Segunda obra')
  app.store.member.role = 'user'
  await assert.rejects(app.createRenovation('Terceira'), /administradores/)
  assert.equal(app.store.renovations.length, 2)
  app.selectRenovation('main'); assert.equal(app.store.selectedRenovationId, 'main')
})
test('migração preserva dados locais do formato anterior', async () => {
  await app.logout(); memory.clear()
  const expense = { id: 'legacy', amountCents: 25000, date: '2026-10-24', categoryId: 'material', paymentMethod: 'pix', installments: 1, paidInstallments: 1, description: 'Antes da atualização' }
  memory.set('tracking-obra-demo-v1', JSON.stringify({ budgetCents: 45600, expenses: [expense], categories: [{ id: 'material', name: 'Material', color: '#157154', active: true }] }))
  app.loginDemo()
  assert.equal(app.store.budgetCents, 45600); assert.equal(app.store.expenses[0].id, 'legacy')
  await app.createRenovation('Nova')
  app.selectRenovation('main')
  assert.equal(app.store.budgetCents, 45600); assert.equal(app.store.expenses[0].description, 'Antes da atualização')
})
