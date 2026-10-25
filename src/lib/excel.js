import { normalizeName, fingerprint, validateExpense, parseMoney, inputMoney, validDate } from './domain.js'
export const HEADERS = ['ID', 'Data', 'Valor total', 'Categoria', 'Pagamento', 'Parcelas', 'Parcelas pagas', 'Descrição']
const literal = (v) => {
  if (v && typeof v === 'object') throw new Error('Não são aceitas fórmulas, links ou células especiais. Cole somente os valores.')
  return v == null ? '' : String(v).trim()
}
export function parseRows(records, categories, existing = []) {
  const existingIds = new Set(existing.map(e => e.id)); const seen = new Set(existing.map(fingerprint)); const seenIds = new Set()
  return records.map((record, index) => {
    const result = { line: index + 2, error: '', duplicate: false, expense: null }
    try {
      const values = Object.fromEntries(HEADERS.map(k => [k, record[k]]))
      const id = literal(values.ID)
      let date
      if (values.Data instanceof Date) date = values.Data.toISOString().slice(0, 10)
      else { date = literal(values.Data); if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) date = date.split('/').reverse().join('-') }
      if (!validDate(date)) throw new Error('Data inválida; use AAAA-MM-DD ou DD/MM/AAAA.')
      const value = values['Valor total']
      // Valores numéricos do Excel estão em reais, não em centavos.
      let amountCents
      if (typeof value === 'number') {
        if (!Number.isFinite(value) || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw new Error('O valor deve ter no máximo duas casas decimais.')
        amountCents = Math.round(value * 100)
      } else amountCents = parseMoney(literal(value))
      const category = categories.find(c => normalizeName(c.name) === normalizeName(literal(values.Categoria)))
      if (!category) throw new Error('Categoria inexistente. Crie-a nas configurações antes de importar.')
      if (!category.active) throw new Error('A categoria está desativada.')
      const method = normalizeName(literal(values.Pagamento))
      const paymentMethod = ['pix/debito', 'pix', 'debito'].includes(method) ? 'pix' : method === 'credito' ? 'credit' : ''
      const n = literal(values.Parcelas); const paid = literal(values['Parcelas pagas'])
      const installments = paymentMethod === 'pix' && n === '' ? 1 : Number(n)
      const paidInstallments = paymentMethod === 'pix' && paid === '' ? 1 : Number(paid)
      if (paymentMethod === 'credit' && (!n || !paid)) throw new Error('Crédito exige Parcelas e Parcelas pagas, inclusive quando pagas = 0.')
      const expense = { amountCents, date, categoryId: category.id, paymentMethod, installments, paidInstallments, description: literal(values.Descrição) }
      validateExpense(expense, categories)
      const key = fingerprint(expense)
      result.duplicate = (id && (existingIds.has(id) || seenIds.has(id))) || seen.has(key)
      seen.add(key); if (id) seenIds.add(id)
      result.expense = expense
    } catch (error) { result.error = error.message }
    return result
  })
}
async function workbook() {
  const { default: ExcelJS } = await import('exceljs')
  return new ExcelJS.Workbook()
}
export async function readWorkbook(file, categories, existing) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Selecione um arquivo .xlsx.')
  if (file.size > 2 * 1024 * 1024) throw new Error('O arquivo deve ter até 2 MB.')
  const book = await workbook()
  try { await book.xlsx.load(await file.arrayBuffer()) } catch { throw new Error('Não foi possível ler este Excel. Verifique se é um .xlsx válido.') }
  const sheet = book.getWorksheet('Despesas') || book.worksheets[0]
  if (!sheet || sheet.actualRowCount < 2) throw new Error('A planilha não contém despesas.')
  if (sheet.rowCount > 401) throw new Error('O limite é de 400 linhas por importação. Remova também linhas vazias formatadas no final.')
  const header = sheet.getRow(1).values.slice(1).map(literal)
  if (HEADERS.some(h => !header.includes(h))) throw new Error('Colunas inválidas. Use o modelo disponível nesta tela.')
  const records = []
  sheet.eachRow((row, number) => {
    if (number === 1) return
    records.push(Object.fromEntries(HEADERS.map(h => [h, row.getCell(header.indexOf(h) + 1).value])))
  })
  return parseRows(records, categories, existing)
}
export async function createWorkbookBuffer(expenses, categories, template = false) {
  const book = await workbook(); const sheet = book.addWorksheet('Despesas')
  sheet.columns = HEADERS.map((h, i) => ({ header: h, key: h, width: [38, 15, 18, 24, 18, 12, 18, 48][i] }))
  const rows = template ? [{ id: '', date: '2026-10-01', amountCents: 120000, categoryId: categories.find(c => c.active)?.id, paymentMethod: 'credit', installments: 6, paidInstallments: 0, description: 'EXEMPLO — substitua ou apague esta linha antes de importar' }] : expenses
  rows.forEach(e => sheet.addRow({ ID: e.id || '', Data: e.date, 'Valor total': e.amountCents / 100, Categoria: categories.find(c => c.id === e.categoryId)?.name || '', Pagamento: e.paymentMethod === 'pix' ? 'PIX/Débito' : 'Crédito', Parcelas: e.installments, 'Parcelas pagas': e.paidInstallments, Descrição: e.description || '' }))
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF125C43' } }
  sheet.getColumn(3).numFmt = '#,##0.00'; sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = 'A1:H1'
  const notes = book.addWorksheet('Instruções')
  notes.getColumn(1).width = 105
  ;['Use a aba Despesas. Máximo 400 linhas por arquivo e 2 MB.', 'Datas: AAAA-MM-DD ou DD/MM/AAAA. Valores em reais com no máximo duas casas.', 'Categorias devem existir e estar ativas no sistema.', 'Pagamento: PIX/Débito ou Crédito. Crédito exige parcelas totais e pagas.', 'PIX/Débito: parcelas = 1 e pagas = 1. Não são aceitas fórmulas.', 'Importação adiciona registros: não atualiza despesas existentes.', 'ID e conteúdo ajudam a identificar duplicidades. Duplicidades são ignoradas.', 'No modelo, substitua ou apague a linha EXEMPLO antes de importar.'].forEach(line => notes.addRow([line]))
  return book.xlsx.writeBuffer()
}
export async function downloadWorkbook(expenses, categories, template = false) {
  const buffer = await createWorkbookBuffer(expenses, categories, template)
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a'); link.href = url; link.download = template ? 'modelo-tracking-obra.xlsx' : `despesas-obra-${new Date().toISOString().slice(0, 10)}.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
