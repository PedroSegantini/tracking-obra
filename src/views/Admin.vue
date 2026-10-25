<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import Icon from '../components/Icon.vue'
import Modal from '../components/Modal.vue'
import SearchSelect from '../components/SearchSelect.vue'
import { store, watchMembers, createMember, updateMember, removeMember, linkMemberToRenovation, updateRenovation, removeRenovation, logout, notify } from '../store'
import { validateUserInput } from '../lib/domain'
import { errorMessage } from '../lib/errors'
const form = reactive({ name: '', email: '', password: '', role: 'user' })
const busy = ref(false), error = ref(''), modalError = ref('')
const editingAccount = ref(null), accountDraft = reactive({ name: '', email: '', role: 'user' })
const linking = ref(false), linkUid = ref(''), linkProject = ref('')
const editingProject = ref(null), projectDraft = reactive({ name: '', members: [] }), candidate = ref('')
const removing = ref(null)
const accounts = computed(() => store.members.filter(member => member.active !== false || member.deleting))
const activeAccounts = computed(() => accounts.value.filter(member => member.active !== false))
const memberOptions = computed(() => activeAccounts.value.map(member => ({ id: member.id, label: member.name, description: member.email })))
const projectOptions = computed(() => store.renovations.map(project => ({ id: project.id, label: project.name })))
const availableOptions = computed(() => memberOptions.value.filter(member => !projectDraft.members.some(item => item.id === member.id)))
const draftMembers = computed(() => projectDraft.members.map(({ id }) => ({ id, name: activeAccounts.value.find(member => member.id === id)?.name || 'Membro indisponível' })))
let stop
onMounted(() => { if (store.member?.role === 'admin') stop = watchMembers() })
onBeforeUnmount(() => stop?.())
function memberProjects(uid) { return store.renovations.filter(project => project.members.some(member => member.id === uid)).map(project => project.name).join(', ') }
async function submit() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { await createMember(validateUserInput(form)); form.name = ''; form.email = ''; form.password = ''; form.role = 'user'; notify('Usuário adicionado.') }
  catch (e) { error.value = errorMessage(e) } finally { busy.value = false }
}
function editAccount(member) { modalError.value = ''; editingAccount.value = member; Object.assign(accountDraft, { name: member.name, email: member.email, role: member.role }) }
async function saveAccount() {
  if (busy.value) return
  busy.value = true; modalError.value = ''
  try {
    const result = await updateMember(editingAccount.value.id, accountDraft)
    editingAccount.value = null; notify('Conta atualizada.')
    if (result.sessionsRevoked === false) notify('Não foi possível encerrar as sessões antigas desta conta. Confira no Firebase.', 'error')
    if (result.reauthenticate) { notify('Entre novamente com o e-mail atualizado.'); await logout() }
  } catch (e) { modalError.value = errorMessage(e) } finally { busy.value = false }
}
function openLink() { modalError.value = ''; linkUid.value = ''; linkProject.value = store.selectedRenovationId || ''; linking.value = true }
async function saveLink() {
  if (busy.value) return
  busy.value = true; modalError.value = ''
  try { await linkMemberToRenovation(linkUid.value, linkProject.value); linking.value = false; notify('Membro atrelado à reforma.') }
  catch (e) { modalError.value = errorMessage(e) } finally { busy.value = false }
}
function editProject(project) { modalError.value = ''; candidate.value = ''; editingProject.value = project; projectDraft.name = project.name; projectDraft.members = project.members.map(member => ({ ...member })) }
function addDraftMember() { if (candidate.value && !projectDraft.members.some(member => member.id === candidate.value)) { projectDraft.members.push({ id: candidate.value }); candidate.value = '' } }
async function saveProject() {
  if (busy.value) return
  busy.value = true; modalError.value = ''
  try { await updateRenovation(editingProject.value.id, projectDraft); editingProject.value = null; notify('Reforma atualizada.') }
  catch (e) { modalError.value = errorMessage(e) } finally { busy.value = false }
}
function askRemove(type, item) { modalError.value = ''; removing.value = { type, item } }
async function confirmRemove() {
  if (busy.value) return
  busy.value = true; modalError.value = ''
  try {
    const type = removing.value.type
    if (type === 'account') await removeMember(removing.value.item.id)
    else await removeRenovation(removing.value.item.id)
    removing.value = null; notify(type === 'account' ? 'Conta removida.' : 'Reforma excluída.')
  } catch (e) { modalError.value = errorMessage(e) } finally { busy.value = false }
}
</script>
<template>
  <div v-if="store.member?.role !== 'admin'" class="empty"><Icon name="alert"/><h1>Acesso restrito</h1><p>Esta área é exclusiva de administradores.</p><RouterLink to="/" class="button">Voltar ao resumo</RouterLink></div>
  <template v-else>
    <div class="page-heading"><h1>Administração</h1></div>
    <div class="settings-grid">
      <section class="panel">
        <div class="panel-heading"><h2>Criar usuário</h2><Icon name="users"/></div>
        <form class="form-stack" @submit.prevent="submit">
          <label>Nome de usuário<input v-model="form.name" autocomplete="off" minlength="2" maxlength="80" required :disabled="busy"/></label>
          <label>E-mail<input v-model="form.email" type="email" autocomplete="off" maxlength="254" required :disabled="busy"/></label>
          <label>Senha inicial<input v-model="form.password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required :disabled="busy"/></label>
          <label>Cargo<select v-model="form.role" :disabled="busy"><option value="user">user — Membro da família</option><option value="admin">admin — Administrador</option></select></label>
          <p v-if="form.role === 'admin'" class="notice">Este usuário também poderá gerenciar contas e todas as reformas.</p>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <button class="button fit" :disabled="busy"><Icon name="plus" :size="17"/>{{ busy ? 'Aguarde…' : 'Criar usuário' }}</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-heading admin-panel-heading"><div><h2>Membros da reforma</h2><p class="muted small">{{ accounts.length }} contas cadastradas</p></div><button class="button" :disabled="busy || !store.renovations.length || !activeAccounts.length" @click="openLink"><Icon name="link" :size="17"/>Atrelar membro a reforma</button></div>
        <div v-if="!accounts.length" class="empty">Nenhum membro cadastrado.</div>
        <div v-for="member in accounts" :key="member.id" class="admin-member-row">
          <span class="avatar">{{ member.name?.slice(0, 1).toUpperCase() }}</span>
          <div class="admin-member-details"><strong>{{ member.name }}</strong><span class="muted small block">{{ member.email }}</span><span class="subtle-chip">{{ member.role }}</span><p class="hint">{{ member.deleting ? 'Exclusão pendente' : memberProjects(member.id) || 'Sem reforma vinculada' }}</p></div>
          <div class="inline admin-actions"><button class="icon-button" :disabled="busy || member.deleting" :aria-label="`Editar conta de ${member.name}`" @click="editAccount(member)"><Icon name="edit" :size="18"/></button><button class="icon-button danger-text" :disabled="busy || member.id === store.user.uid" :title="member.id === store.user.uid ? 'Você não pode remover a própria conta' : 'Remover conta'" :aria-label="`Remover conta de ${member.name}`" @click="askRemove('account', member)"><Icon name="trash" :size="18"/></button></div>
        </div>
      </section>
      <section class="panel admin-renovations">
        <div class="panel-heading"><div><h2>Reformas</h2><p class="muted small">{{ store.renovations.length }} reformas cadastradas</p></div><Icon name="house"/></div>
        <div v-if="!store.renovations.length" class="empty">Crie uma reforma pelo menu lateral.</div>
        <div v-for="project in store.renovations" :key="project.id" class="admin-project-row"><div><strong>{{ project.name }}</strong><span class="muted small block">{{ project.members.length }} membros vinculados</span></div><div class="inline admin-actions"><button class="button secondary" :disabled="busy" @click="editProject(project)"><Icon name="edit" :size="17"/>Editar</button><button class="button secondary danger-text" :disabled="busy" @click="askRemove('project', project)"><Icon name="trash" :size="17"/>Excluir</button></div></div>
      </section>
    </div>

    <Modal v-if="editingAccount" title="Editar conta" :busy="busy" @close="!busy && (editingAccount = null)">
      <form class="form-stack" @submit.prevent="saveAccount">
        <label>Nome de usuário<input v-model="accountDraft.name" minlength="2" maxlength="80" required :disabled="busy"/></label>
        <label>E-mail<input v-model="accountDraft.email" type="email" maxlength="254" required :disabled="busy"/></label>
        <label>Cargo<select v-model="accountDraft.role" :disabled="busy || editingAccount.id === store.user.uid"><option value="user">user — Membro da família</option><option value="admin">admin — Administrador</option></select></label>
        <p class="hint">Alterar e-mail ou cargo exige novo login dessa conta.</p>
        <p v-if="modalError" class="form-error" role="alert">{{ modalError }}</p>
        <div class="modal-actions"><button type="button" class="button secondary" :disabled="busy" @click="editingAccount = null">Cancelar</button><button class="button" :disabled="busy">{{ busy ? 'Salvando…' : 'Salvar conta' }}</button></div>
      </form>
    </Modal>
    <Modal v-if="linking" title="Atrelar membro a reforma" :busy="busy" @close="!busy && (linking = false)">
      <form class="form-stack link-form" @submit.prevent="saveLink">
        <SearchSelect v-model="linkUid" label="Membro" placeholder="Buscar pelo nome do membro" :options="memberOptions" :disabled="busy"/>
        <SearchSelect v-model="linkProject" label="Reforma" placeholder="Buscar pelo nome da reforma" :options="projectOptions" :disabled="busy"/>
        <p v-if="modalError" class="form-error" role="alert">{{ modalError }}</p>
        <div class="modal-actions"><button type="button" class="button secondary" :disabled="busy" @click="linking = false">Cancelar</button><button class="button" :disabled="busy || !linkUid || !linkProject">{{ busy ? 'Salvando…' : 'Atrelar membro' }}</button></div>
      </form>
    </Modal>
    <Modal v-if="editingProject" title="Editar reforma" wide :busy="busy" @close="!busy && (editingProject = null)">
      <form class="form-stack" @submit.prevent="saveProject">
        <label>Nome da reforma<input v-model="projectDraft.name" minlength="2" maxlength="80" required :disabled="busy"/></label>
        <div class="admin-add-member"><SearchSelect v-model="candidate" label="Adicionar membro" placeholder="Buscar pelo nome do membro" :options="availableOptions" :disabled="busy || projectDraft.members.length >= 300"/><button type="button" class="button secondary" :disabled="busy || !candidate" @click="addDraftMember">Adicionar</button></div>
        <div class="admin-draft-members"><p v-if="!draftMembers.length" class="muted">Nenhum membro vinculado.</p><div v-for="member in draftMembers" :key="member.id" class="admin-project-row"><span>{{ member.name }}</span><button type="button" class="text-button danger-text" :disabled="busy" @click="projectDraft.members = projectDraft.members.filter(item => item.id !== member.id)">Remover vínculo</button></div></div>
        <p class="hint">Administradores têm acesso a todas as reformas. Remover um vínculo não exclui a conta nem os gastos registrados.</p>
        <p v-if="modalError" class="form-error" role="alert">{{ modalError }}</p>
        <div class="modal-actions"><button type="button" class="button secondary" :disabled="busy" @click="editingProject = null">Cancelar</button><button class="button" :disabled="busy">{{ busy ? 'Salvando…' : 'Salvar reforma' }}</button></div>
      </form>
    </Modal>
    <Modal v-if="removing" :title="removing.type === 'account' ? 'Remover conta?' : 'Confirmar exclusão da reforma'" :wide="removing.type === 'project'" :busy="busy" @close="!busy && (removing = null)">
      <p v-if="removing.type === 'account'">A conta de <strong>{{ removing.item.name }}</strong> perderá o acesso e será removida do login. Os gastos já registrados serão preservados.</p>
      <div v-else class="renovation-delete-confirmation">
        <Icon name="alert" :size="44" class="danger-text"/>
        <h3>Deseja excluir a reforma {{ removing.item.name }}?</h3>
        <p>A reforma sairá da lista e seus membros perderão o acesso. O histórico de gastos será preservado no banco de dados.</p>
        <p class="muted">Não será possível restaurar a reforma pela interface.</p>
      </div>
      <p v-if="modalError" class="form-error" role="alert">{{ modalError }}</p>
      <div class="modal-actions"><button class="button secondary" :disabled="busy" @click="removing = null">Cancelar</button><button class="button danger" :disabled="busy" @click="confirmRemove">{{ busy ? 'Removendo…' : removing.type === 'project' ? 'Excluir reforma' : 'Confirmar remoção' }}</button></div>
    </Modal>
  </template>
</template>
<style scoped>
.renovation-delete-confirmation { display: grid; justify-items: center; gap: 18px; padding: 28px 12px; text-align: center; }
.renovation-delete-confirmation h3 { margin: 0; font-size: var(--font-section); overflow-wrap: anywhere; }
.renovation-delete-confirmation p { margin: 0; max-width: 620px; line-height: 1.6; }
.admin-panel-heading { align-items: flex-start; flex-wrap: wrap; }
.admin-renovations { grid-column: 1 / -1; }
.admin-member-row { display: flex; gap: 12px; align-items: flex-start; padding: 18px 0; border-bottom: 1px solid var(--border); }
.admin-member-row:last-child, .admin-project-row:last-child { border-bottom: 0; }
.admin-member-details { min-width: 0; flex: 1; overflow-wrap: anywhere; }
.admin-member-details .small { margin: 4px 0 9px; }
.admin-member-details .hint { margin-top: 8px; }
.admin-actions { flex-shrink: 0; gap: 5px; }
.admin-project-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--border); overflow-wrap: anywhere; }
.admin-project-row > div:first-child { min-width: 0; }
.admin-project-row .small { margin-top: 5px; }
.admin-add-member { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: end; }
.admin-draft-members { max-height: 280px; overflow-y: auto; }
@media(max-width: 600px) {
  .admin-project-row { flex-wrap: wrap; }
  .admin-add-member { grid-template-columns: 1fr; }
  .admin-actions .button { padding: 9px 11px; }
}
</style>
