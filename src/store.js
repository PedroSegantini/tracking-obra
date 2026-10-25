import { reactive } from 'vue'
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, GoogleAuthProvider, sendPasswordResetEmail, linkWithPopup, linkWithCredential, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, runTransaction, query, where } from 'firebase/firestore'
import { auth, db, isDemo, configError } from './lib/firebase'
import { INITIAL_CATEGORIES, today, validateExpense, categoryId, normalizeName, MAX_CENTS, validateRenovationName } from './lib/domain'
import { errorMessage } from './lib/errors'
import { validId, validateMemberEdit, validateRenovationEdit, protectOwnAccount } from './lib/admin-validation'

export const store = reactive({ ready: false, user: null, member: null, budgetCents: 0, renovationName: 'Nossa reforma', selectedRenovationId: 'main', renovations: [], categories: [], expenses: [], members: [], loadingData: true, syncError: '', demo: isDemo, configError, toasts: [], expenseModal: false, editing: null })
let stops = [], dataStops = [], generation = 0, dataGeneration = 0, demoProjects = {}
const DEMO_KEY = 'tracking-obra-demo-v1'
export function notify(message, type = 'success') {
  const id = crypto.randomUUID()
  store.toasts.push({ id, message, type })
  setTimeout(() => { store.toasts = store.toasts.filter(t => t.id !== id) }, 6500)
}
export async function attempt(action) {
  try { return await action() } catch (error) { notify(errorMessage(error), 'error'); return undefined }
}
function captureDemoProject() {
  if (!store.selectedRenovationId || !demoProjects[store.selectedRenovationId]) return
  demoProjects[store.selectedRenovationId] = { ...demoProjects[store.selectedRenovationId], id: store.selectedRenovationId, name: store.renovationName, budgetCents: store.budgetCents, categories: JSON.parse(JSON.stringify(store.categories)), expenses: JSON.parse(JSON.stringify(store.expenses)) }
}
function persistDemo() {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify({ projects: demoProjects, members: store.members })) }
  catch { throw new Error('Não foi possível salvar os dados locais no navegador. Verifique o espaço disponível.') }
}
function saveDemo() {
  captureDemoProject()
  syncDemoRenovations()
  persistDemo()
}
function syncDemoRenovations() {
  store.renovations = Object.values(demoProjects).filter(project => !project.deleted && (store.member?.role === 'admin' || project.memberIds.includes(store.user.uid))).map(({ id, name, memberIds }) => ({ id, name, memberIds: [...memberIds] }))
  if (store.selectedRenovationId && !store.renovations.some(project => project.id === store.selectedRenovationId)) {
    const next = store.renovations[0]
    if (next) selectRenovation(next.id)
    else { clearProjectData(); store.selectedRenovationId = ''; store.renovationName = 'Reformas'; store.loadingData = false }
  }
}
function preferenceKey() { return `obra-renovation-${store.user?.uid || 'demo-admin'}` }
function preferredRenovation() { try { return localStorage.getItem(preferenceKey()) || 'main' } catch { return 'main' } }
function loadDemo() {
  let saved
  try { saved = JSON.parse(localStorage.getItem(DEMO_KEY)) } catch { /* Ignorar conteúdo corrompido. */ }
  const month = today().slice(0, 7)
  // Migração automática do formato original de uma única reforma.
  demoProjects = saved?.projects && Object.keys(saved.projects).length ? saved.projects : {
    main: { id: 'main', name: 'Nossa reforma', budgetCents: saved?.budgetCents ?? 8000000,
      categories: saved?.categories ?? INITIAL_CATEGORIES.map(c => ({ ...c })),
      expenses: saved?.expenses ?? [
        { id: 'demo-1', amountCents: 350000, date: `${month}-03`, categoryId: 'pedreiro', paymentMethod: 'pix', installments: 1, paidInstallments: 1, description: 'Primeira etapa da obra', createdBy: 'demo-admin' },
        { id: 'demo-2', amountCents: 240000, date: `${month}-05`, categoryId: 'material', paymentMethod: 'credit', installments: 6, paidInstallments: 2, description: 'Pisos e revestimentos', createdBy: 'demo-admin' },
        { id: 'demo-3', amountCents: 28500, date: `${month}-08`, categoryId: 'outras-despesas', paymentMethod: 'pix', installments: 1, paidInstallments: 1, description: 'Frete de materiais', createdBy: 'demo-admin' },
      ] },
  }
  store.members = saved?.members ?? [{ id: 'demo-admin', name: 'Família', email: 'familia@exemplo.com', role: 'admin', active: true }]
  const legacyIds = store.members.filter(member => member.active !== false).map(member => member.id)
  Object.values(demoProjects).forEach(project => {
    if (!Array.isArray(project.memberIds)) project.memberIds = [...legacyIds]
    project.deleted ??= false
  })
  store.selectedRenovationId = ''
  syncDemoRenovations()
  const preferred = preferredRenovation()
  const id = store.renovations.find(project => project.id === preferred)?.id || store.renovations[0]?.id
  if (id) selectRenovation(id)
  else { store.loadingData = false; store.renovationName = 'Reformas' }
}
function clearProjectData() {
  dataGeneration++
  dataStops.forEach(stop => stop()); dataStops = []
  store.expenses = []; store.categories = []; store.budgetCents = 0
  store.syncError = ''; store.loadingData = true; store.expenseModal = false; store.editing = null
}
function clearData() {
  stops.forEach(stop => stop()); stops = []
  clearProjectData()
  store.member = null; store.members = []; store.renovations = []
  store.selectedRenovationId = ''; store.renovationName = 'Nossa reforma'; demoProjects = {}
}
const base = () => doc(db, 'renovations', store.selectedRenovationId)
const membersBase = () => collection(db, 'renovations', 'main', 'members')
function listenData() {
  const turn = dataGeneration, reference = base()
  const loaded = new Set()
  const listen = (key, target, handler) => {
    dataStops.push(onSnapshot(target, snap => {
      if (turn !== dataGeneration) return
      handler(snap); loaded.add(key); store.loadingData = loaded.size < 3
    }, error => { if (turn === dataGeneration) { store.syncError = errorMessage(error); store.loadingData = false } }))
  }
  listen('settings', reference, snap => { store.budgetCents = snap.data()?.budgetCents ?? 0; store.renovationName = snap.data()?.name || 'Reforma' })
  listen('categories', collection(reference, 'categories'), snap => { store.categories = snap.docs.map(d => ({ ...d.data(), id: d.id })) })
  listen('expenses', collection(reference, 'expenses'), snap => { store.expenses = snap.docs.map(d => ({ ...d.data(), id: d.id })) })
}
export function selectRenovation(id) {
  if (!store.member) throw new Error('Entre com uma conta autorizada.')
  const project = store.renovations.find(item => item.id === id)
  if (!project || (store.member.role !== 'admin' && !project.memberIds?.includes(store.user.uid))) throw new Error('Você não tem acesso a esta reforma.')
  if (id === store.selectedRenovationId && !store.loadingData) return
  if (isDemo) captureDemoProject()
  clearProjectData()
  store.selectedRenovationId = id; store.renovationName = project.name
  try { localStorage.setItem(preferenceKey(), id) } catch { /* Seleção segue funcionando sem persistência. */ }
  if (isDemo) {
    const data = demoProjects[id]
    store.budgetCents = data.budgetCents; store.categories = JSON.parse(JSON.stringify(data.categories)); store.expenses = JSON.parse(JSON.stringify(data.expenses)); store.loadingData = false
  } else listenData()
}
export async function createRenovation(name) {
  if (store.member?.role !== 'admin') throw new Error('Somente administradores podem criar reformas.')
  name = validateRenovationName(name)
  const uid = store.user.uid
  const id = isDemo ? crypto.randomUUID() : doc(collection(db, 'renovations')).id
  if (isDemo) {
    captureDemoProject()
    demoProjects[id] = { id, name, memberIds: [uid], deleted: false, budgetCents: 0, categories: INITIAL_CATEGORIES.map(c => ({ ...c })), expenses: [] }
    persistDemo()
  } else {
    const ref = doc(db, 'renovations', id), batch = writeBatch(db)
    batch.set(ref, { name, memberIds: [uid], deleted: false, budgetCents: 0, updatedAt: serverTimestamp(), updatedBy: uid })
    INITIAL_CATEGORIES.forEach(({ id: category, ...data }) => batch.set(doc(ref, 'categories', category), { ...data, createdBy: uid, createdAt: serverTimestamp(), updatedBy: uid, updatedAt: serverTimestamp() }))
    await batch.commit()
  }
  if (store.user?.uid !== uid || !store.member) return
  if (!store.renovations.some(project => project.id === id)) store.renovations.push({ id, name, memberIds: [uid] })
  selectRenovation(id)
}
export function initSession() {
  if (isDemo || !auth) { store.ready = true; return }
  onAuthStateChanged(auth, user => {
    generation++; const turn = generation
    clearData(); store.user = user
    if (!user) { store.ready = true; return }
    let projectStop, listRole
    stops.push(() => projectStop?.())
    stops.push(onSnapshot(doc(membersBase(), user.uid), async snap => {
      if (turn !== generation) return
      const member = snap.exists() ? { ...snap.data(), id: snap.id } : null
      store.member = member?.active === true && ['admin', 'user'].includes(member.role) ? member : null
      store.ready = true
      if (!store.member) { generation++; clearData(); store.ready = true; return }
      if (listRole === member.role) return
      listRole = member.role
      projectStop?.(); clearProjectData(); store.selectedRenovationId = ''
      try { await user.getIdToken(true) }
      catch { if (turn === generation) { store.syncError = 'Entre novamente para atualizar suas permissões.'; store.loadingData = false } return }
      if (turn !== generation || store.member?.role !== member.role) return
      const projectsQuery = member.role === 'admin' ? collection(db, 'renovations') : query(collection(db, 'renovations'), where('deleted', '==', false), where('memberIds', 'array-contains', user.uid))
      projectStop = onSnapshot(projectsQuery, projects => {
        if (turn !== generation) return
        store.renovations = projects.docs.filter(d => d.data().deleted !== true).map(d => ({ id: d.id, name: d.data().name || 'Reforma', memberIds: d.data().memberIds || [] })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        if (!store.renovations.some(project => project.id === store.selectedRenovationId)) {
          const preferred = preferredRenovation()
          const id = store.renovations.find(project => project.id === preferred)?.id || store.renovations[0]?.id
          if (id) selectRenovation(id)
          else { clearProjectData(); store.selectedRenovationId = ''; store.renovationName = 'Reformas'; store.loadingData = false }
        }
      }, error => { if (turn === generation) { store.syncError = errorMessage(error); store.loadingData = false } })
    }, error => { if (turn === generation) { store.syncError = errorMessage(error); store.ready = true; store.member = null } }))
  })
}
export async function login(email, password) {
  if (isDemo) return loginDemo()
  await signInWithEmailAndPassword(auth, email.trim(), password)
}
export async function loginGoogle() {
  if (isDemo) return loginDemo()
  await signInWithPopup(auth, new GoogleAuthProvider())
}
export function loginDemo() {
  store.user = { uid: 'demo-admin', email: 'familia@exemplo.com', displayName: 'Família' }
  store.member = { name: 'Família', role: 'admin', active: true }; loadDemo()
  const current = store.members.find(member => member.id === 'demo-admin')
  if (current) { Object.assign(store.member, current); store.user.email = current.email; store.user.displayName = current.name }
  store.ready = true
}
export async function logout() {
  if (!isDemo) await signOut(auth)
  else { clearData(); store.user = null }
}
export async function resetPassword(email) {
  if (isDemo) throw new Error('Recuperação de senha disponível apenas após conectar o Firebase.')
  await sendPasswordResetEmail(auth, email.trim())
}
export async function connectGoogle() {
  if (isDemo) throw new Error('Vinculação disponível após conectar o Firebase.')
  const result = await linkWithPopup(auth.currentUser, new GoogleAuthProvider())
  store.user = { uid: result.user.uid, email: result.user.email, displayName: result.user.displayName, providerData: result.user.providerData.map(provider => ({ ...provider })) }; notify('Conta Google vinculada. Você pode usar os dois métodos de entrada.')
}
export async function connectPassword(password) {
  if (isDemo) throw new Error('Vinculação disponível após conectar o Firebase.')
  if (password.length < 10 || password.length > 128) throw new Error('Use uma senha de 10 a 128 caracteres.')
  const user = auth.currentUser
  if (!user.email) throw new Error('Sua conta precisa de um e-mail para vincular uma senha.')
  const result = await linkWithCredential(user, EmailAuthProvider.credential(user.email, password))
  store.user = { uid: result.user.uid, email: result.user.email, displayName: result.user.displayName, providerData: result.user.providerData.map(provider => ({ ...provider })) }; notify('Senha do aplicativo definida. Os dois métodos acessam os mesmos dados.')
}
export async function changePassword(input) {
  if (isDemo) throw new Error('A alteração de senha estará disponível após configurar o Firebase e a API na Vercel.')
  if (!auth.currentUser) throw new Error('Entre novamente para alterar sua senha.')
  const token = await auth.currentUser.getIdToken()
  let response
  try {
    response = await fetch('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(input) })
  } catch { throw new Error('Não foi possível confirmar a alteração. Confira a conexão e tente entrar novamente antes de repetir.') }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Serviço de alteração de senha indisponível. Use a aplicação publicada ou vercel dev para executar a API.')
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Não foi possível alterar a senha.')
  if (!result.passwordChanged) throw new Error('Não foi possível confirmar a alteração da senha.')
  return result
}
export async function reauthenticate(password) {
  if (isDemo) return
  if (auth.currentUser.providerData.some(p => p.providerId === 'password')) await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, password))
}
export function openExpense(expense = null) { if (store.loadingData || !store.selectedRenovationId) return; store.editing = expense ? { ...expense } : null; store.expenseModal = true }
export async function saveExpense(payload, id) {
  validateExpense(payload, store.categories)
  if (!store.categories.find(c => c.id === payload.categoryId)?.active && store.expenses.find(e => e.id === id)?.categoryId !== payload.categoryId) throw new Error('Escolha uma categoria ativa.')
  const data = { amountCents: payload.amountCents, date: payload.date, categoryId: payload.categoryId, paymentMethod: payload.paymentMethod, installments: payload.installments, paidInstallments: payload.paidInstallments, description: payload.description.trim() }
  if (isDemo) {
    if (id) { const index = store.expenses.findIndex(e => e.id === id); if (index < 0) throw new Error('Esta despesa não existe mais.'); store.expenses[index] = { ...store.expenses[index], ...data } }
    else store.expenses.push({ ...data, id: crypto.randomUUID(), createdBy: store.user.uid })
    saveDemo()
  } else {
    const metadata = { updatedBy: store.user.uid, updatedAt: serverTimestamp() }
    if (id) await updateDoc(doc(base(), 'expenses', id), { ...data, ...metadata })
    else await setDoc(doc(collection(base(), 'expenses')), { ...data, ...metadata, createdBy: store.user.uid, createdAt: serverTimestamp() })
  }
}
export async function removeExpense(id) {
  if (isDemo) { store.expenses = store.expenses.filter(e => e.id !== id); saveDemo() }
  else await deleteDoc(doc(base(), 'expenses', id))
}
export async function saveBudget(budgetCents) {
  if (!Number.isSafeInteger(budgetCents) || budgetCents < 0 || budgetCents > MAX_CENTS) throw new Error('Orçamento inválido.')
  if (isDemo) { store.budgetCents = budgetCents; saveDemo() }
  else await updateDoc(base(), { budgetCents, updatedBy: store.user.uid, updatedAt: serverTimestamp() })
}
export async function addCategory(name, color) {
  name = name.trim(); const id = categoryId(name)
  if (name.length < 2 || name.length > 60 || !id) throw new Error('Use um nome de 2 a 60 caracteres com letras ou números.')
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Cor inválida.')
  if (store.categories.some(c => c.id === id || normalizeName(c.name) === normalizeName(name))) throw new Error('Já existe uma categoria com esse nome, inclusive entre as desativadas.')
  const data = { name, color, active: true }
  if (isDemo) { store.categories.push({ id, ...data }); saveDemo() }
  else {
    const ref = doc(base(), 'categories', id)
    await runTransaction(db, async tx => {
      if ((await tx.get(ref)).exists()) throw new Error('Esta categoria já existe.')
      tx.set(ref, { ...data, createdBy: store.user.uid, createdAt: serverTimestamp(), updatedBy: store.user.uid, updatedAt: serverTimestamp() })
    })
  }
}
export async function toggleCategory(category) {
  if (isDemo) { store.categories.find(c => c.id === category.id).active = !category.active; saveDemo() }
  else await updateDoc(doc(base(), 'categories', category.id), { active: !category.active, updatedBy: store.user.uid, updatedAt: serverTimestamp() })
}
export async function importExpenses(rows) {
  if (!rows.length || rows.length > 400) throw new Error('Importe entre 1 e 400 despesas por arquivo.')
  rows.forEach(row => validateExpense(row.expense, store.categories))
  if (isDemo) { store.expenses.push(...rows.map(row => ({ ...row.expense, id: crypto.randomUUID(), createdBy: store.user.uid }))); saveDemo(); return }
  const batch = writeBatch(db)
  rows.forEach(({ expense }) => batch.set(doc(collection(base(), 'expenses')), { ...expense, createdBy: store.user.uid, createdAt: serverTimestamp(), updatedBy: store.user.uid, updatedAt: serverTimestamp() }))
  await batch.commit()
}
export function watchMembers() {
  if (isDemo) return () => {}
  return onSnapshot(membersBase(), snap => { store.members = snap.docs.map(d => ({ ...d.data(), id: d.id })) }, error => notify(errorMessage(error), 'error'))
}
export async function createMember(payload) {
  requireUIAdmin()
  if (isDemo) {
    if (store.members.some(m => m.active !== false && m.email.toLowerCase() === payload.email.trim().toLowerCase())) throw new Error('Este e-mail já está cadastrado.')
    store.members.push({ id: crypto.randomUUID(), name: payload.name, email: payload.email, role: payload.role, active: true }); saveDemo(); return
  }
  const token = await auth.currentUser.getIdToken()
  const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('API administrativa indisponível. Localmente use vercel dev; npm run dev inicia somente a interface.')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Não foi possível criar o usuário.')
}

function requireUIAdmin() {
  if (store.member?.role !== 'admin') throw new Error('Acesso exclusivo de administradores.')
}
async function adminCall(body) {
  requireUIAdmin()
  const token = await auth.currentUser.getIdToken()
  const response = await fetch('/api/admin/manage', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('API administrativa indisponível. Use a aplicação publicada ou vercel dev.')
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.')
  return result
}
export async function updateMember(uid, input) {
  requireUIAdmin(); validId(uid)
  const data = validateMemberEdit(input)
  protectOwnAccount(store.user.uid, uid, 'edit', data.role)
  if (!isDemo) return adminCall({ action: 'edit-account', uid, ...data })
  const member = store.members.find(member => member.id === uid && member.active !== false)
  if (!member) throw new Error('Conta não encontrada.')
  if (store.members.some(member => member.id !== uid && member.active !== false && member.email.toLowerCase() === data.email)) throw new Error('Este e-mail já pertence a outra conta.')
  Object.assign(member, data)
  if (uid === store.user.uid) { Object.assign(store.member, data); store.user.email = data.email; store.user.displayName = data.name }
  saveDemo()
  return { updated: true }
}
export async function removeMember(uid) {
  requireUIAdmin(); validId(uid); protectOwnAccount(store.user.uid, uid, 'delete')
  if (!isDemo) return adminCall({ action: 'delete-account', uid })
  const member = store.members.find(member => member.id === uid)
  if (!member) throw new Error('Conta não encontrada.')
  captureDemoProject()
  member.active = false; member.deleted = true
  Object.values(demoProjects).forEach(project => { project.memberIds = project.memberIds.filter(id => id !== uid) })
  syncDemoRenovations(); persistDemo()
  return { removed: true }
}
export async function linkMemberToRenovation(uid, renovationId) {
  requireUIAdmin(); validId(uid); validId(renovationId)
  if (!isDemo) return adminCall({ action: 'link-member', uid, renovationId })
  if (!store.members.some(member => member.id === uid && member.active !== false)) throw new Error('Membro não encontrado.')
  const project = demoProjects[renovationId]
  if (!project || project.deleted) throw new Error('Reforma não encontrada.')
  if (!project.memberIds.includes(uid) && project.memberIds.length >= 300) throw new Error('Selecione até 300 membros.')
  captureDemoProject()
  demoProjects[renovationId].memberIds = [...new Set([...demoProjects[renovationId].memberIds, uid])]
  syncDemoRenovations(); persistDemo()
  return { linked: true }
}
export async function updateRenovation(renovationId, input) {
  requireUIAdmin(); validId(renovationId)
  const data = validateRenovationEdit(input)
  if (!isDemo) return adminCall({ action: 'edit-renovation', renovationId, ...data })
  const project = demoProjects[renovationId]
  if (!project || project.deleted) throw new Error('Reforma não encontrada.')
  if (data.memberIds.some(uid => !store.members.some(member => member.id === uid && member.active !== false))) throw new Error('Membro não encontrado.')
  captureDemoProject(); Object.assign(demoProjects[renovationId], data)
  if (store.selectedRenovationId === renovationId) store.renovationName = data.name
  syncDemoRenovations(); persistDemo()
  return { updated: true }
}
export async function removeRenovation(renovationId) {
  requireUIAdmin(); validId(renovationId)
  if (!isDemo) return adminCall({ action: 'delete-renovation', renovationId })
  if (!demoProjects[renovationId] || demoProjects[renovationId].deleted) throw new Error('Reforma não encontrada.')
  captureDemoProject(); demoProjects[renovationId].deleted = true; demoProjects[renovationId].memberIds = []
  syncDemoRenovations(); persistDemo()
  return { removed: true }
}
