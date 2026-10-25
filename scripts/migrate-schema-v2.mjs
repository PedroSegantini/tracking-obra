import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { adminServices } from '../server/firebase-admin.js'
import { planSchemaMigration, planLegacyCleanup, applySchemaActions } from '../server/schema-migration.js'
const args = process.argv.slice(2)
if (args.some(arg => !['--apply', '--cleanup'].includes(arg))) throw new Error('Use --apply para migrar ou --cleanup --apply para remover cópias antigas. Sem --apply, apenas simula.')
const { db } = adminServices()
const projectId = process.env.FIREBASE_PROJECT_ID
const records = snapshot => snapshot.docs.map(doc => ({ id: doc.id, path: doc.ref.path, data: doc.data(), updateTime: doc.updateTime }))
const [userSnapshot, projectSnapshot, categorySnapshot, legacyUserSnapshot] = await Promise.all([db.collection('users').get(), db.collection('renovations').get(), db.collection('categories').get(), db.collection('renovations/main/members').get()])
const users = records(userSnapshot), projects = records(projectSnapshot), categories = records(categorySnapshot), legacyUsers = records(legacyUserSnapshot), legacyCategories = []
for (const project of projects) {
  legacyCategories.push(...records(await db.collection(`renovations/${project.id}/categories`).get()).map(record => ({ ...record, renovationId: project.id })))
}
const input = { users, projects, categories, legacyUsers, legacyCategories }
const actions = args.includes('--cleanup') ? planLegacyCleanup(input) : planSchemaMigration(input)
console.log(`Projeto: ${projectId}. ${actions.length} operações planejadas (${args.includes('--cleanup') ? 'limpeza' : 'migração'}).`)
if (!args.includes('--apply')) { console.log('Simulação: nenhuma gravação realizada. Feche as sessões antigas e use --apply para executar.'); process.exit(0) }
if (!actions.length) { console.log('Estrutura já atualizada.'); process.exit(0) }
// Full typed backup of touched document families, before the first write. Expenses are never modified.
function encode(value) {
  if (value === null || typeof value !== 'object') return value
  if (typeof value.toDate === 'function' && typeof value.seconds === 'number') return { __type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds }
  if (Array.isArray(value)) return value.map(encode)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]))
}
const directory = resolve('.backups')
await mkdir(directory, { recursive: true, mode: 0o700 })
const backupPath = resolve(directory, `schema-${Date.now()}.json`)
await writeFile(backupPath, JSON.stringify({ version: 1, projectId, createdAt: new Date().toISOString(), input: encode(input), actions: encode(actions) }, null, 2), { mode: 0o600, flag: 'wx' })
console.log(`Backup salvo em ${backupPath}.`)
await applySchemaActions(db, actions, [...users, ...projects, ...categories, ...legacyUsers, ...legacyCategories])
console.log('Operações concluídas atomicamente. Despesas e identidades do Authentication foram preservadas.')
