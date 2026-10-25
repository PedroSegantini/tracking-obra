<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import { validatePasswordChange } from '../lib/account-security'
import { errorMessage } from '../lib/errors'
import { store, connectGoogle, connectPassword, resetPassword, changePassword, logout, attempt, notify } from '../store'
const password = ref(''), confirm = ref(''), busy = ref(false)
const currentPassword = ref(''), newPassword = ref(''), confirmPassword = ref(''), changeError = ref('')
const providers = computed(() => store.user?.providerData?.map(p => p.providerId) || [])
async function google() { busy.value = true; await attempt(connectGoogle); busy.value = false }
async function addPassword() { busy.value = true; await attempt(async () => { if (password.value !== confirm.value) throw new Error('As senhas não conferem.'); await connectPassword(password.value); password.value = ''; confirm.value = '' }); busy.value = false }
async function recover() { busy.value = true; await attempt(async () => { await resetPassword(store.user.email); notify('Se houver uma conta elegível, as instruções serão enviadas por e-mail.') }); busy.value = false }
async function submitPasswordChange() {
  if (busy.value) return
  busy.value = true; changeError.value = ''
  try {
    const input = { currentPassword: currentPassword.value, newPassword: newPassword.value, confirmPassword: confirmPassword.value }
    validatePasswordChange(input)
    const result = await changePassword(input)
    currentPassword.value = ''; newPassword.value = ''; confirmPassword.value = ''
    notify('Senha alterada. Entre novamente.')
    if (result.notification === 'sent') notify('Aviso de alteração enviado ao seu e-mail.')
    else notify('Sua senha foi alterada, mas o aviso por e-mail não pôde ser enviado.', 'error')
    await logout()
  } catch (error) { changeError.value = errorMessage(error) }
  finally { currentPassword.value = ''; busy.value = false }
}
</script>
<template>
  <div class="page-heading"><div><h1>Minha conta</h1></div></div>
  <section class="panel account-summary"><span class="avatar large">{{ store.member.name.slice(0, 1).toUpperCase() }}</span><div><h2>{{ store.member.name }}</h2><p class="muted">{{ store.user.email }}</p><span class="subtle-chip">{{ store.member.role === 'admin' ? 'Administrador' : 'Membro da família' }}</span></div></section>
  <div class="settings-grid"><section class="panel"><div class="panel-heading"><div><h2>Conta Google</h2><p class="muted small">Acesso com a sua conta Google</p></div><Icon name="link"/></div><p v-if="providers.includes('google.com')" class="success-text inline"><Icon name="check"/>Google conectado</p><template v-else><p class="muted">Entre com sua conta atual e conecte o Google aqui para manter o mesmo cadastro.</p><button class="button" :disabled="busy || store.demo" @click="google">Conectar Google</button></template></section>
  <section class="panel"><div class="panel-heading"><div><h2>E-mail e senha</h2></div><Icon name="user"/></div><template v-if="providers.includes('password')"><p class="success-text inline"><Icon name="check"/>E-mail e senha habilitados</p><button class="button secondary" :disabled="busy" @click="recover">Receber e-mail para trocar senha</button></template><form v-else class="form-stack" @submit.prevent="addPassword"><p class="muted small">O e-mail utilizado será {{ store.user.email }}. A senha do Google não é alterada.</p><label>Nova senha<input v-model="password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required :disabled="store.demo"/></label><label>Confirmar senha<input v-model="confirm" type="password" autocomplete="new-password" minlength="10" maxlength="128" required :disabled="store.demo"/></label><button class="button fit" :disabled="busy || store.demo">{{ busy ? 'Aguarde…' : 'Habilitar e-mail e senha' }}</button></form></section>
  <section class="panel password-change-panel">
    <div class="panel-heading"><h2>Alterar senha</h2><Icon name="user" /></div>
    <p v-if="!providers.includes('password') && !store.demo" class="hint">Habilite e-mail e senha para alterar a senha do aplicativo.</p>
    <form class="form-stack" @submit.prevent="submitPasswordChange">
      <label>Senha atual<input v-model="currentPassword" type="password" autocomplete="current-password" maxlength="128" required :disabled="busy || store.demo || !providers.includes('password')" /></label>
      <div class="form-grid">
        <label>Nova senha<input v-model="newPassword" type="password" autocomplete="new-password" minlength="10" maxlength="128" required :disabled="busy || store.demo || !providers.includes('password')" /></label>
        <label>Confirmar nova senha<input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="10" maxlength="128" required :disabled="busy || store.demo || !providers.includes('password')" /></label>
      </div>
      <p class="hint">Use de 10 a 128 caracteres. A senha do Google não será alterada.</p>
      <p v-if="changeError" class="form-error" role="alert">{{ changeError }}</p>
      <button class="button fit" :disabled="busy || store.demo || !providers.includes('password')">{{ busy ? 'Aguarde…' : 'Confirmar alteração' }}</button>
    </form>
  </section>
  </div><p class="hint">Por segurança, o Firebase pode solicitar um novo login antes da vinculação. Se isso acontecer, saia, entre novamente e repita a ação.</p>
</template>

<style scoped>
.password-change-panel { grid-column: 1 / -1; }
.password-change-panel > .hint { margin-bottom: 18px; }
@media (max-width: 600px) { .password-change-panel .form-grid { grid-template-columns: 1fr; } }
</style>
