import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMoney, paidCents, totals, validateExpense, validDate, categoryId } from '../src/lib/domain.js'
const expense = (overrides = {}) => ({ amountCents: 120000, date: '2026-10-24', categoryId: 'material', paymentMethod: 'credit', installments: 6, paidInstallments: 2, description: '', ...overrides })
test('converte reais brasileiros para centavos sem ponto flutuante', () => {
  assert.equal(parseMoney('1.250,50'), 125050); assert.equal(parseMoney('0,01'), 1); assert.equal(parseMoney('R$ 12,5'), 1250)
  for (const value of ['-2', '1,234', '12.50', '', 'R$ abc', 'Infinity']) assert.throws(() => parseMoney(value))
})
test('total e parcial incluem somente as parcelas quitadas', () => {
  assert.deepEqual(totals([expense(), expense({ amountCents: 100000, paymentMethod: 'pix', installments: 1, paidInstallments: 1 })]), { total: 220000, paid: 140000, outstanding: 80000 })
})
test('última parcela absorve o resto da divisão, sem perder centavos', () => {
  for (const [paid, expected] of [[0, 0], [1, 3333], [2, 6666], [3, 10000]]) assert.equal(paidCents(expense({ amountCents: 10000, installments: 3, paidInstallments: paid })), expected)
})
test('validação rejeita parcelas pagas acima do total e PIX não quitado', () => {
  const categories = [{ id: 'material' }]
  assert.throws(() => validateExpense(expense({ paidInstallments: 7 }), categories))
  assert.throws(() => validateExpense(expense({ paymentMethod: 'pix' }), categories))
  assert.throws(() => validateExpense(expense({ amountCents: 0 }), categories))
  assert.throws(() => validateExpense(expense({ installments: 1.5 }), categories))
  assert.throws(() => validateExpense(expense({ categoryId: 'inexistente' }), categories))
  assert.throws(() => validateExpense(expense({ date: '2026-02-30' }), categories))
})
test('datas respeitam meses, anos bissextos e intervalo', () => {
  assert.equal(validDate('2024-02-29'), true); assert.equal(validDate('2000-02-29'), true)
  for (const d of ['2025-02-29', '2100-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '0000-01-01']) assert.equal(validDate(d), false)
})
test('categoria gera identificador estável sem acentos', () => { assert.equal(categoryId('  Outras Despesas '), 'outras-despesas'); assert.equal(categoryId('Elétrica & Iluminação'), 'eletrica-iluminacao') })
