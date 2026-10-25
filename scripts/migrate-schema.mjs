import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { adminServices } from '../server/firebase-admin.js'
import { applySchemaActions } from '../server/schema-migration.js'
import { planCompactSchema } from '../server/schema-v3.js'
const args = process.argv.slice(2)
if (args.some(arg => arg !== '--apply')) throw new Error('Use --apply para executar. Sem ele, apenas simula. A migração v3 move e limpa os documentos atomicamente.')
const { db } = adminServices()
const records = snapshot => snapshot.docs.map(doc => ({ id: doc.id, path: doc.ref.path, data: doc.data(), updateTime: doc.updateTime }))
const [userSnapshot, projectSnapshot, categorySnapshot] = await Promise.all(['users', 'renovations', 'categories'].map(path => db.collection(path).get()))
const users = records(userSnapshot), projects = records(projectSnapshot), categories = records(categorySnapshot), expenses = []
for (const project of projectSnapshot.docs) {
  const collections = await project.ref.listCollections()
  if (collections.some(collection => collection.id !== 'expenses')) throw new Error('Subcoleções antigas encontradas. Execute primeiro migrate-schema-v2.mjs e sua limpeza.')
  expenses.push(...records(await project.ref.collection('expenses').get()).map(record => ({ ...record, renovationId: project.id })))
}
const input = { users, projects, categories, expenses }, plan = planCompactSchema(input, collection => db.collection(collection).doc().id)
console.log(`Projeto: ${process.env.FIREBASE_PROJECT_ID}. ${plan.actions.length} operações; ${projects.length} reformas, ${categories.length} categorias, ${expenses.length} despesas.`)
if (!args.includes('--apply')) { console.log('Simulação: nenhuma gravação realizada. Use --apply para executar.'); process.exit(0) }
if (!plan.actions.length) { console.log('Estrutura já atualizada.'); process.exit(0) }
function encode(value) {
  if (value === null || typeof value !== 'object') return value
  if (typeof value.toDate === 'function' && typeof value.seconds === 'number') return { __type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds }
  if (Array.isArray(value)) return value.map(encode)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]))
}
await mkdir(resolve('.backups'), { recursive: true, mode: 0o700 })
const path = resolve('.backups', `schema-v3-${Date.now()}.json`)
await writeFile(path, JSON.stringify(encode({ projectId: process.env.FIREBASE_PROJECT_ID, createdAt: new Date().toISOString(), input, plan }), null, 2), { mode: 0o600, flag: 'wx' })
console.log(`Backup de documentos e mapa de IDs salvo em ${path}.`)
await applySchemaActions(db, plan.actions, [...users, ...projects, ...categories, ...expenses], ['users', 'renovations', 'categories', ...projects.map(project => `renovations/${project.id}/expenses`)])
console.log('Migração v3 concluída atomicamente. Identidades do Authentication preservadas.')
