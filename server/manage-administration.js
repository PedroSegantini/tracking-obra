import { requireAdmin } from './create-user.js'
import { validId, validateMemberEdit, validateRenovationEdit, protectOwnAccount } from '../src/lib/admin-validation.js'
export function adminError(status, message) { const error = new Error(message); error.status = status; return error }
const memberRef = (db, uid) => db.doc(`users/${uid}`)
async function actorInTransaction(tx, db, actor) {
  const snapshot = await tx.get(memberRef(db, actor.uid))
  requireAdmin(actor, snapshot.exists ? snapshot.data() : null)
}
function activeProject(snapshot) {
  if (!snapshot.exists || snapshot.data().deleted === true) throw adminError(404, 'Reforma não encontrada.')
  return snapshot.data()
}
export async function editAccount({ auth, db, actor, uid, input }) {
  validId(uid)
  let data
  try { data = validateMemberEdit(input); protectOwnAccount(actor.uid, uid, 'edit', data.role) }
  catch (error) { throw adminError(400, error.message) }
  const ref = memberRef(db, uid), operationId = crypto.randomUUID()
  let previous
  await db.runTransaction(async tx => {
    await actorInTransaction(tx, db, actor)
    previous = await tx.get(ref)
    if (!previous.exists || previous.data().active !== true) throw adminError(404, 'Conta não encontrada.')
    if (previous.data().editingLock && previous.data().editingUntil > Date.now()) throw adminError(409, 'Esta conta está sendo editada. Aguarde e tente novamente.')
    tx.update(ref, { editingLock: operationId, editingUntil: Date.now() + 300000 })
  })
  let previousAuth
  let emailChanged = false
  const roleChanged = previous.data().role !== data.role
  let authUpdated = false, claimsUpdated = false
  try {
    previousAuth = await auth.getUser(uid)
    emailChanged = previousAuth.email !== data.email
    await auth.updateUser(uid, { displayName: data.name, email: data.email, ...(emailChanged ? { emailVerified: false } : {}) }); authUpdated = true
    await auth.setCustomUserClaims(uid, { ...previousAuth.customClaims, role: data.role }); claimsUpdated = true
    await db.runTransaction(async tx => {
      await actorInTransaction(tx, db, actor)
      const target = await tx.get(ref)
      const projects = data.name !== previous.data().name ? await tx.get(db.collection('renovations').where('members', 'array-contains', { id: uid, name: previous.data().name })) : { docs: [], size: 0 }
      if (projects.size > 400) throw adminError(409, 'Há muitas reformas para renomear esta conta. Remova os vínculos em etapas.')
      if (!target.exists || target.data().active !== true) throw adminError(404, 'Conta não encontrada.')
      // Evita sobrescrever edição administrativa concorrente com um estado antigo.
      if (target.data().editingLock !== operationId || target.data().email !== previous.data().email || target.data().role !== previous.data().role || target.data().name !== previous.data().name) throw adminError(409, 'A conta foi alterada por outro administrador. Reabra a edição.')
      projects.docs.forEach(project => tx.update(project.ref, { members: (project.data().members || []).map(member => member.id === uid ? { id: uid, name: data.name } : member) }))
      tx.update(ref, { ...data, editingLock: null, editingUntil: 0, updatedAt: new Date(), updatedBy: actor.uid })
    })
  } catch (error) {
    // Authentication e Firestore não compartilham transação: desfazer alterações externas quando possível.
    try {
      if (claimsUpdated) await auth.setCustomUserClaims(uid, previousAuth.customClaims || {})
      if (authUpdated) await auth.updateUser(uid, { displayName: previousAuth.displayName || '', email: previousAuth.email, emailVerified: previousAuth.emailVerified })
    } catch { throw adminError(500, 'A atualização ficou incompleta. Revise esta conta no console Firebase antes de tentar novamente.') }
    throw error
  } finally {
    try {
      await db.runTransaction(async tx => {
        const current = await tx.get(ref)
        if (current.exists && current.data().editingLock === operationId) tx.update(ref, { editingLock: null, editingUntil: 0 })
      })
    } catch { /* Se necessário, o bloqueio de edição expira em cinco minutos. */ }
  }
  let sessionsRevoked = true
  if (roleChanged || emailChanged) {
    try { await auth.revokeRefreshTokens(uid) } catch { sessionsRevoked = false }
  }
  return { updated: true, reauthenticate: uid === actor.uid && emailChanged, sessionsRevoked }
}
export async function deleteAccount({ auth, db, actor, uid }) {
  validId(uid)
  try { protectOwnAccount(actor.uid, uid, 'delete') } catch (error) { throw adminError(400, error.message) }
  const ref = memberRef(db, uid)
  await db.runTransaction(async tx => {
    await actorInTransaction(tx, db, actor)
    const target = await tx.get(ref)
    if (!target.exists) throw adminError(404, 'Conta não encontrada.')
    if (target.data().editingLock && target.data().editingUntil > Date.now()) throw adminError(409, 'Esta conta está sendo editada. Aguarde e tente novamente.')
    const projects = await tx.get(db.collection('renovations').where('members', 'array-contains', { id: uid, name: target.data().name }))
    if (projects.size > 400) throw adminError(409, 'Há muitas reformas para esta operação. Remova os vínculos em etapas.')
    tx.update(ref, { active: false, deleting: true, updatedAt: new Date(), updatedBy: actor.uid })
    projects.docs.forEach(project => tx.update(project.ref, { members: (project.data().members || []).filter(member => member.id !== uid) }))
  })
  // O vínculo inativo já bloqueia os dados, inclusive para tokens ainda em memória.
  try { await auth.deleteUser(uid) }
  catch (error) {
    if (error.code !== 'auth/user-not-found') throw adminError(503, 'O acesso foi bloqueado, mas a exclusão no Firebase ficou pendente. Tente remover esta conta novamente.')
  }
  await ref.update({ deleting: false, deleted: true, deletedAt: new Date() })
  return { removed: true }
}
export async function linkMember({ db, actor, uid, renovationId }) {
  validId(uid); validId(renovationId)
  const ref = db.doc(`renovations/${renovationId}`)
  await db.runTransaction(async tx => {
    await actorInTransaction(tx, db, actor)
    const member = await tx.get(memberRef(db, uid)), project = await tx.get(ref)
    if (!member.exists || member.data().active !== true) throw adminError(404, 'Membro não encontrado.')
    const data = activeProject(project), ids = (data.members || []).map(member => member.id)
    if (!ids.includes(uid) && ids.length >= 300) throw adminError(400, 'Esta reforma já atingiu o limite de 300 membros.')
    const named = (data.members || []).filter(item => item.id !== uid)
    named.push({ id: uid, name: member.data().name })
    tx.update(ref, { members: named })
  })
  return { linked: true }
}
export async function editRenovation({ db, actor, renovationId, input }) {
  validId(renovationId)
  let data
  try { data = validateRenovationEdit(input) } catch (error) { throw adminError(400, error.message) }
  const ref = db.doc(`renovations/${renovationId}`)
  await db.runTransaction(async tx => {
    await actorInTransaction(tx, db, actor)
    activeProject(await tx.get(ref))
    const members = await Promise.all(data.members.map(({ id }) => tx.get(memberRef(db, id))))
    if (members.some(snapshot => !snapshot.exists || snapshot.data().active !== true)) throw adminError(400, 'Um membro não está mais disponível. Reabra a edição.')
    tx.update(ref, { name: data.name, members: members.map((snapshot, index) => ({ id: data.members[index].id, name: snapshot.data().name })) })
  })
  return { updated: true }
}
export async function deleteRenovation({ db, actor, renovationId }) {
  validId(renovationId)
  await db.runTransaction(async tx => {
    await actorInTransaction(tx, db, actor)
    const ref = db.doc(`renovations/${renovationId}`), project = await tx.get(ref)
    if (!project.exists) throw adminError(404, 'Reforma não encontrada.')
    tx.update(ref, { deleted: true, members: [], deletedAt: new Date(), deletedBy: actor.uid })
  })
  return { removed: true }
}
export async function manageAdministration({ auth, db, actor, body }) {
  const common = { auth, db, actor }
  switch (body.action) {
    case 'edit-account': return editAccount({ ...common, uid: body.uid, input: body })
    case 'delete-account': return deleteAccount({ ...common, uid: body.uid })
    case 'link-member': return linkMember({ ...common, uid: body.uid, renovationId: body.renovationId })
    case 'edit-renovation': return editRenovation({ ...common, renovationId: body.renovationId, input: body })
    case 'delete-renovation': return deleteRenovation({ ...common, renovationId: body.renovationId })
    default: throw adminError(400, 'Operação inválida.')
  }
}
