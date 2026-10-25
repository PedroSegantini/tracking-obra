import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRows, createWorkbookBuffer, readWorkbook } from '../src/lib/excel.js'
const categories = [{ id: 'material', name: 'Material', active: true }, { id: 'antiga', name: 'Antiga', active: false }]
const row = (patch = {}) => ({ ID: '', Data: '2026-10-24', 'Valor total': 1200, Categoria: 'Material', Pagamento: 'Crédito', Parcelas: 6, 'Parcelas pagas': 2, Descrição: 'Pisos', ...patch })
test('importação interpreta reais numéricos, datas brasileiras e texto decimal', () => {
  const parsed = parseRows([row(), row({ Data: '23/10/2026', 'Valor total': '1.200,50', Descrição: 'Outra compra' })], categories)
  assert.equal(parsed[0].expense.amountCents, 120000); assert.equal(parsed[1].expense.amountCents, 120050); assert.equal(parsed[1].expense.date, '2026-10-23')
})
test('detecta duplicidades no arquivo, na base e por ID', () => {
  const original = parseRows([row()], categories)[0].expense
  assert.equal(parseRows([row(), row()], categories)[1].duplicate, true)
  assert.equal(parseRows([row()], categories, [{ ...original, id: '123' }])[0].duplicate, true)
  assert.equal(parseRows([row({ ID: '123', Descrição: 'Alteração' })], categories, [{ ...original, id: '123' }])[0].duplicate, true)
})
test('rejeita fórmulas, categorias inativas e parcelas incoerentes', () => {
  for (const patch of [{ Descrição: { formula: '1+1' } }, { Categoria: 'Antiga' }, { Categoria: 'Não existe' }, { 'Parcelas pagas': 7 }, { Data: '2026-02-31' }, { 'Valor total': 1.001 }, { Parcelas: '' }]) assert.ok(parseRows([row(patch)], categories)[0].error)
})
test('PIX sem campos de parcelas é importado como pago integralmente', () => { const parsed = parseRows([row({ Pagamento: 'PIX/Débito', Parcelas: '', 'Parcelas pagas': '' })], categories)[0]; assert.equal(parsed.error, ''); assert.equal(parsed.expense.paidInstallments, 1) })

test('arquivo Excel real faz ida e volta preservando centavos e parcelas', async () => {
  const expense = parseRows([row({ 'Valor total': 100.01 })], categories)[0].expense
  const buffer = await createWorkbookBuffer([{ ...expense, id: 'roundtrip' }], categories)
  const file = { name: 'despesas.xlsx', size: buffer.byteLength, arrayBuffer: async () => buffer }
  const result = await readWorkbook(file, categories, [])
  assert.equal(result[0].error, ''); assert.deepEqual(result[0].expense, expense)
})
