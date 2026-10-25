// Executar uma vez antes de publicar as regras de acesso individual por reforma.
import { adminServices } from '../server/firebase-admin.js'
const { db } = adminServices()
const members = await db.collection('renovations/main/members').get()
const ids = members.docs.filter(doc => doc.data().active === true).map(doc => doc.id)
if (ids.length > 300) throw new Error('Mais de 300 membros: revise os vínculos antes de migrar.')
const projects = await db.collection('renovations').get()
let count = 0, operations = 0, batch = db.batch()
for (const project of projects.docs) {
  const data = project.data(), update = {}
  if (!Array.isArray(data.memberIds)) update.memberIds = data.deleted ? [] : ids
  if (typeof data.deleted !== 'boolean') update.deleted = false
  if (!Object.keys(update).length) continue
  batch.update(project.ref, update); count++; operations++
  if (operations === 400) { await batch.commit(); batch = db.batch(); operations = 0 }
}
if (operations) await batch.commit()
console.log(`${count} reformas atualizadas. Vínculos explícitos existentes foram preservados.`)
