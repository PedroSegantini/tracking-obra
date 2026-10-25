import { isDeepStrictEqual } from 'node:util'
const autoId = id => typeof id === 'string' && /^[a-zA-Z0-9]{20}$/.test(id)
const omit = (data, keys) => Object.fromEntries(Object.entries(data).filter(([key]) => !keys.includes(key)))
export function planCompactSchema({ users, projects, categories, expenses }, allocateId) {
  const actions = [], projectIds = new Map(), categoryIds = new Map(), profiles = new Map(users.map(record => [record.id, record.data]))
  const used = new Set([...projects, ...categories].map(record => record.id))
  function allocate(kind) {
    const id = allocateId(kind)
    if (!autoId(id) || used.has(id)) throw new Error('ID automático inválido ou repetido. Nenhuma alteração realizada.')
    used.add(id); return id
  }
  function write(record, path, data) {
    if (record.path === path) {
      if (!isDeepStrictEqual(record.data, data)) actions.push({ type: 'set', path, data })
    } else {
      actions.push({ type: 'create', path, data }, { type: 'delete', path: record.path })
    }
  }
  for (const project of projects) projectIds.set(project.id, autoId(project.id) ? project.id : allocate('renovations'))
  for (const category of categories) categoryIds.set(category.id, autoId(category.id) && category.data.ID === category.id ? category.id : allocate('categories'))
  for (const user of users) {
    if (!user.data.name || !user.data.email || !['admin', 'user'].includes(user.data.role) || typeof user.data.active !== 'boolean') throw new Error('Perfil de usuário incompleto. Revise antes de migrar.')
    write(user, user.path, { ...omit(user.data, ['createdAt', 'createdBy']), id: user.id })
  }
  for (const project of projects) {
    const id = projectIds.get(project.id), data = project.data
    const ids = Array.isArray(data.members) ? data.members.map(member => member.id) : data.memberIds
    if (!Array.isArray(ids) || ids.length > 300 || new Set(ids).size !== ids.length) throw new Error('Lista de membros inválida. Revise antes de migrar.')
    const members = data.deleted ? [] : ids.map(id => {
      const user = profiles.get(id)
      if (!user || !user.active) throw new Error('Membro indisponível. Revise antes de migrar.')
      return { id, name: user.name }
    })
    write(project, `renovations/${id}`, { ...omit(data, ['memberIds', 'updatedAt', 'updatedBy']), id, schemaVersion: 3, members })
  }
  for (const category of categories) {
    const renovationId = projectIds.get(category.data.renovationId)
    if (!renovationId) throw new Error('Categoria sem reforma válida. Nenhuma alteração realizada.')
    const id = categoryIds.get(category.id), { name, color, active } = category.data
    if (typeof name !== 'string' || name.length < 2 || name.length > 60 || !/^#[0-9a-f]{6}$/i.test(color) || typeof active !== 'boolean') throw new Error('Categoria inválida. Revise antes de migrar.')
    write(category, `categories/${id}`, { ID: id, name, color, active, renovationId })
  }
  for (const expense of expenses) {
    const renovationId = projectIds.get(expense.renovationId)
    // v2 stored a category slug in expenses; v3 stores the auto ID of the category document.
    const category = categories.find(category => category.data.renovationId === expense.renovationId && (category.id === expense.data.categoryId || category.data.categoryId === expense.data.categoryId))
    if (!renovationId || !category) throw new Error('Despesa sem categoria ou reforma válida. Nenhuma alteração realizada.')
    write(expense, `renovations/${renovationId}/expenses/${expense.id}`, { ...expense.data, categoryId: categoryIds.get(category.id) })
  }
  return { actions, projectIds: Object.fromEntries(projectIds), categoryIds: Object.fromEntries(categoryIds) }
}
