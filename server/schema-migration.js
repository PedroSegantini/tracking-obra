import { isDeepStrictEqual } from 'node:util'
const validateId = value => /^[a-zA-Z0-9_-]{1,128}$/.test(value)
const fieldsEqual = (a, b) => Object.entries(b).every(([key, value]) => isDeepStrictEqual(a[key], value))
// Pure planning: validation completes before any write to the database.
export function planSchemaMigration({ users, legacyUsers, projects, categories, legacyCategories }) {
  if (projects.some(project => project.data.schemaVersion >= 3)) throw new Error('Banco já migrado para v3. Use migrate-schema.mjs; não execute a migração v2.')
  const actions = [], profiles = new Map(users.map(record => [record.id, record.data]))
  for (const record of legacyUsers) {
    if (!validateId(record.id)) throw new Error('UID legado inválido.')
    if (!profiles.has(record.id)) {
      const data = { ...record.data, id: record.id }
      profiles.set(record.id, data)
      actions.push({ type: 'create', path: `users/${record.id}`, data })
    }
  }
  for (const [id, profile] of profiles) {
    if (typeof profile.name !== 'string' || !profile.name.trim() || typeof profile.email !== 'string' || !['admin', 'user'].includes(profile.role) || typeof profile.active !== 'boolean') throw new Error(`Perfil incompleto em users/${id}. Corrija antes de migrar.`)
    if (profile.id !== id) actions.push({ type: 'update', path: `users/${id}`, data: { id } })
  }
  const existingCategories = new Map(categories.map(record => [record.path, record.data]))
  for (const record of legacyCategories) {
    if (!validateId(record.renovationId) || !/^[a-z0-9-]{1,60}$/.test(record.id)) throw new Error('Identificador de categoria legado inválido.')
    const path = `categories/${record.renovationId}__${record.id}`
    const data = { ...record.data, categoryId: record.id, renovationId: record.renovationId }
    if (existingCategories.has(path)) {
      if (!fieldsEqual(existingCategories.get(path), data)) throw new Error(`Conflito em ${path}. Nenhum dado será sobrescrito.`)
    } else { actions.push({ type: 'create', path, data }); existingCategories.set(path, data) }
  }
  for (const record of projects) {
    if (!validateId(record.id)) throw new Error('Identificador de reforma inválido.')
    const project = record.data
    // Explicit empty memberships remain empty. Legacy pre-membership projects keep prior access.
    const ids = project.deleted ? [] : [...new Set(Array.isArray(project.memberIds) ? project.memberIds : [...profiles].filter(([, user]) => user.active).map(([id]) => id))]
    if (ids.length > 300) throw new Error(`Mais de 300 membros em renovations/${record.id}.`)
    const members = ids.map(id => {
      const user = profiles.get(id)
      if (!user || !user.active) throw new Error(`Vínculo indisponível em renovations/${record.id}. Revise os membros antes de migrar.`)
      return { id, name: user.name }
    })
    const patch = { id: record.id, schemaVersion: 2, deleted: project.deleted === true, memberIds: ids, members }
    if (!fieldsEqual(project, patch)) actions.push({ type: 'update', path: `renovations/${record.id}`, data: patch })
  }
  return actions
}

export function planLegacyCleanup({ users, legacyUsers, categories, legacyCategories, projects }) {
  const actions = [], currentUsers = new Map(users.map(record => [record.id, record.data])), currentCategories = new Map(categories.map(record => [record.path, record.data]))
  if (projects.some(record => record.data.schemaVersion !== 2)) throw new Error('Migração incompleta. Nenhum documento legado será excluído.')
  for (const record of legacyUsers) {
    if (!currentUsers.has(record.id) || !fieldsEqual(currentUsers.get(record.id), record.data)) throw new Error('Perfil divergente ou ainda não copiado. Limpeza interrompida para preservar os dados.')
    actions.push({ type: 'delete', path: record.path })
  }
  for (const record of legacyCategories) {
    const data = { ...record.data, categoryId: record.id, renovationId: record.renovationId }
    if (!fieldsEqual(currentCategories.get(`categories/${record.renovationId}__${record.id}`) || {}, data)) throw new Error('Categoria divergente. Limpeza interrompida para preservar os dados.')
    actions.push({ type: 'delete', path: record.path })
  }
  return actions
}

export async function applySchemaActions(db, actions, snapshots, collectionPaths = []) {
  if (actions.length > 450) throw new Error('Mais de 450 operações: faça uma migração em etapas revisada para este volume.')
  if (!actions.length) return
  await db.runTransaction(async tx => {
    // Guard whole collections too, including empty expense collections, against concurrent inserts.
    const groups = await Promise.all(collectionPaths.map(path => tx.get(db.collection(path))))
    groups.forEach((group, index) => {
      const path = collectionPaths[index]
      const expected = snapshots.filter(record => record.path.slice(0, record.path.lastIndexOf('/')) === path).map(record => record.path).sort()
      const actual = group.docs.map(doc => doc.ref.path).sort()
      if (!isDeepStrictEqual(actual, expected)) throw new Error('Os dados mudaram durante a migração. Nenhuma gravação realizada; execute a simulação novamente.')
    })
    // Detect edits to the sources as well as targets since planning. All reads precede writes.
    const current = await Promise.all(snapshots.map(record => tx.get(db.doc(record.path))))
    current.forEach((snapshot, index) => {
      if (!snapshot.exists || !snapshot.updateTime.isEqual(snapshots[index].updateTime)) throw new Error('Os dados mudaram durante a migração. Nenhuma gravação realizada; execute a simulação novamente.')
    })
    for (const action of actions) {
      const ref = db.doc(action.path)
      if (action.type === 'create') tx.create(ref, action.data)
      else if (action.type === 'update') tx.update(ref, action.data)
      else if (action.type === 'set') tx.set(ref, action.data)
      else tx.delete(ref)
    }
  })
}
