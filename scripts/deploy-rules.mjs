import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getSecurityRules } from 'firebase-admin/security-rules'
import { adminServices } from '../server/firebase-admin.js'
const args = process.argv.slice(2)
if (args.some(arg => arg !== '--apply')) throw new Error('Use --apply para publicar; sem ele, apenas compara as regras.')
const { auth } = adminServices(), rules = getSecurityRules(auth.app)
const source = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
const previous = await rules.getFirestoreRuleset()
if (previous.source.length === 1 && previous.source[0].content === source) { console.log('As regras publicadas já correspondem ao arquivo local.'); process.exit(0) }
console.log(`Projeto: ${process.env.FIREBASE_PROJECT_ID}. Regras locais diferentes das publicadas.`)
if (!args.includes('--apply')) { console.log('Simulação: nenhuma alteração. Use --apply para publicar.'); process.exit(0) }
await mkdir(resolve('.backups'), { recursive: true, mode: 0o700 })
const path = resolve('.backups', `rules-${Date.now()}.json`)
await writeFile(path, JSON.stringify({ projectId: process.env.FIREBASE_PROJECT_ID, name: previous.name, source: previous.source }, null, 2), { mode: 0o600, flag: 'wx' })
await rules.releaseFirestoreRulesetFromSource(source)
const published = await rules.getFirestoreRuleset()
if (published.source.length !== 1 || published.source[0].content !== source) throw new Error('A publicação não pôde ser confirmada; confira o console Firebase.')
console.log(`Regras publicadas e verificadas. Backup anterior: ${path}`)
