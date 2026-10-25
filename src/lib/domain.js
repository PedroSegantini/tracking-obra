export const MAX_CENTS = 1_000_000_000_00
export const INITIAL_CATEGORIES = [
  { id: 'pedreiro', name: 'Pedreiro', color: '#157154', active: true },
  { id: 'material', name: 'Material', color: '#c08b38', active: true },
  { id: 'outras-despesas', name: 'Outras despesas', color: '#6686b1', active: true },
]
export const COLORS = ['#157154', '#c08b38', '#6686b1', '#a978a4', '#c67459', '#51999b']
export const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
export function parseMoney(value) {
  // Campo textual brasileiro: vírgula decimal; ponto somente como milhar.
  const text = String(value ?? '').trim().replace(/^R\$\s*/, '')
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) throw new Error('Informe um valor como 1.250,50, sem sinais ou letras.')
  const [whole, decimals = ''] = text.replaceAll('.', '').split(',')
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) throw new Error('Valor acima do limite permitido.')
  return cents
}
export const inputMoney = (cents = 0, grouped = false) => grouped
  ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
  : (cents / 100).toFixed(2).replace('.', ',')
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2199-12-31'
}
export const dateLabel = (s) => validDate(s) ? s.split('-').reverse().join('/') : '—'
export const normalizeName = (s) => String(s).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ')
export const categoryId = (s) => normalizeName(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
export function validateExpense(e, categories) {
  if (!Number.isSafeInteger(e.amountCents) || e.amountCents <= 0 || e.amountCents > MAX_CENTS) throw new Error('O valor deve ser maior que zero e estar dentro do limite.')
  if (!validDate(e.date)) throw new Error('Data inválida.')
  if (!categories.some(c => c.id === e.categoryId)) throw new Error('Selecione uma categoria válida.')
  if (!['pix', 'credit'].includes(e.paymentMethod)) throw new Error('Forma de pagamento inválida.')
  if (!Number.isInteger(e.installments) || e.installments < 1 || e.installments > 600) throw new Error('Informe de 1 a 600 parcelas.')
  if (!Number.isInteger(e.paidInstallments) || e.paidInstallments < 0 || e.paidInstallments > e.installments) throw new Error('As parcelas pagas devem estar entre zero e o total de parcelas.')
  if (e.paymentMethod === 'pix' && (e.installments !== 1 || e.paidInstallments !== 1)) throw new Error('PIX/Débito deve ser considerado integralmente pago.')
  if (typeof e.description !== 'string' || e.description.length > 500) throw new Error('A descrição deve ter até 500 caracteres.')
  return e
}
export function paidCents(e) {
  if (e.paymentMethod === 'pix') return e.amountCents
  const base = Math.floor(e.amountCents / e.installments)
  return e.paidInstallments === e.installments ? e.amountCents : base * e.paidInstallments
}
export const consideredCents = (e, mode) => mode === 'partial' ? paidCents(e) : e.amountCents
export function totals(expenses) {
  const total = expenses.reduce((n, e) => n + e.amountCents, 0)
  const paid = expenses.reduce((n, e) => n + paidCents(e), 0)
  return { total, paid, outstanding: total - paid }
}
export function fingerprint(e) {
  return [e.date, e.amountCents, e.categoryId, e.paymentMethod, e.installments, e.paidInstallments, normalizeName(e.description)].join('|')
}
export function validateUserInput(body) {
  const { name, email, password, role = 'user' } = body ?? {}
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) throw new Error('O nome deve ter de 2 a 80 caracteres.')
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.')
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw new Error('A senha deve ter de 10 a 128 caracteres.')
  if (!['admin', 'user'].includes(role)) throw new Error('Cargo inválido.')
  return { name: name.trim(), email: email.trim().toLowerCase(), password, role }
}

export function validateRenovationName(value) {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 80) throw new Error('O nome da reforma deve ter de 2 a 80 caracteres.')
  return value.trim()
}
