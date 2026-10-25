<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import Icon from '../components/Icon.vue'
import { store, watchMembers, createMember, notify } from '../store'
import { validateUserInput } from '../lib/domain'
import { errorMessage } from '../lib/errors'
const form = reactive({ name: '', email: '', password: '', role: 'user' }), busy = ref(false), error = ref('')
let stop
onMounted(() => { if (store.member?.role === 'admin') stop = watchMembers() })
onBeforeUnmount(() => stop?.())
async function submit() {
  busy.value = true; error.value = ''
  try { await createMember(validateUserInput(form)); form.name = ''; form.email = ''; form.password = ''; form.role = 'user'; notify('Usuário adicionado.') }
  catch (e) { error.value = errorMessage(e) } finally { busy.value = false }
}
</script>
<template>
  <div v-if="store.member?.role !== 'admin'" class="empty"><Icon name="alert"/><h1>Acesso restrito</h1><p>Esta área é exclusiva de administradores.</p><RouterLink to="/" class="button">Voltar ao resumo</RouterLink></div>
  <template v-else><div class="page-heading"><div><h1>Administração</h1><p class="muted">Cadastre quem pode acompanhar e organizar a reforma.</p></div></div><div class="settings-grid"><section class="panel"><div class="panel-heading"><div><h2>Criar usuário</h2><p class="muted small">O cargo padrão é membro da família.</p></div><Icon name="users"/></div><form class="form-stack" @submit.prevent="submit"><label>Nome de usuário<input v-model="form.name" autocomplete="off" minlength="2" maxlength="80" required/></label><label>E-mail<input v-model="form.email" type="email" autocomplete="off" maxlength="254" required/></label><label>Senha inicial<input v-model="form.password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required/></label><p class="hint">De 10 a 128 caracteres. O familiar poderá trocar a senha pela recuperação de acesso.</p><label>Cargo<select v-model="form.role"><option value="user">user — Membro da família</option><option value="admin">admin — Administrador</option></select></label><p v-if="form.role === 'admin'" class="notice">Este usuário também poderá criar outros usuários e administradores.</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="button fit" :disabled="busy"><Icon name="plus" :size="17"/>{{ busy ? 'Criando…' : 'Criar usuário' }}</button></form></section>
  <section class="panel"><div class="panel-heading"><div><h2>Membros da reforma</h2><p class="muted small">{{ store.members.length }} contas autorizadas</p></div></div><div v-for="member in store.members" :key="member.id" class="member-row"><span class="avatar">{{ member.name?.slice(0, 1).toUpperCase() }}</span><div><strong>{{ member.name }}</strong><span class="muted small block">{{ member.email }}</span><span class="subtle-chip">{{ member.role }}</span></div></div><p class="hint">Nesta primeira versão, a administração permite criar e listar usuários. Alteração de cargo e remoção ficam para uma próxima etapa.</p></section></div></template>
</template>
