<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import { store, connectGoogle, connectPassword, resetPassword, attempt, notify } from '../store'
const password = ref(''), confirm = ref(''), busy = ref(false)
const providers = computed(() => store.user?.providerData?.map(p => p.providerId) || [])
async function google() { busy.value = true; await attempt(connectGoogle); busy.value = false }
async function addPassword() { busy.value = true; await attempt(async () => { if (password.value !== confirm.value) throw new Error('As senhas não conferem.'); await connectPassword(password.value); password.value = ''; confirm.value = '' }); busy.value = false }
async function recover() { busy.value = true; await attempt(async () => { await resetPassword(store.user.email); notify('Se houver uma conta elegível, as instruções serão enviadas por e-mail.') }); busy.value = false }
</script>
<template>
  <div class="page-heading"><div><h1>Minha conta</h1><p class="muted">Dois métodos de entrada, os mesmos dados da família.</p></div></div>
  <section class="panel account-summary"><span class="avatar large">{{ store.member.name.slice(0, 1).toUpperCase() }}</span><div><h2>{{ store.member.name }}</h2><p class="muted">{{ store.user.email }}</p><span class="subtle-chip">{{ store.member.role === 'admin' ? 'Administrador' : 'Membro da família' }}</span></div></section>
  <div class="settings-grid"><section class="panel"><div class="panel-heading"><div><h2>Conta Google</h2><p class="muted small">Acesso com a sua conta Google</p></div><Icon name="link"/></div><p v-if="providers.includes('google.com')" class="success-text inline"><Icon name="check"/>Google conectado</p><template v-else><p class="muted">Entre com sua conta atual e conecte o Google aqui para manter o mesmo cadastro.</p><button class="button" :disabled="busy || store.demo" @click="google">Conectar Google</button></template></section>
  <section class="panel"><div class="panel-heading"><div><h2>E-mail e senha</h2><p class="muted small">Uma senha exclusiva para este aplicativo</p></div><Icon name="user"/></div><template v-if="providers.includes('password')"><p class="success-text inline"><Icon name="check"/>E-mail e senha habilitados</p><button class="button secondary" :disabled="busy" @click="recover">Receber e-mail para trocar senha</button></template><form v-else class="form-stack" @submit.prevent="addPassword"><p class="muted small">O e-mail utilizado será {{ store.user.email }}. A senha do Google não é alterada.</p><label>Nova senha<input v-model="password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required :disabled="store.demo"/></label><label>Confirmar senha<input v-model="confirm" type="password" autocomplete="new-password" minlength="10" maxlength="128" required :disabled="store.demo"/></label><button class="button fit" :disabled="busy || store.demo">{{ busy ? 'Aguarde…' : 'Habilitar e-mail e senha' }}</button></form></section></div><p class="hint">Por segurança, o Firebase pode solicitar um novo login antes da vinculação. Se isso acontecer, saia, entre novamente e repita a ação.</p>
</template>
