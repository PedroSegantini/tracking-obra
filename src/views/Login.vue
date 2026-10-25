<script setup>
import { ref } from 'vue'
import Icon from '../components/Icon.vue'
import { store, login, loginGoogle, resetPassword, notify } from '../store'
import { errorMessage } from '../lib/errors'
defineProps({ theme: { type: String, default: 'light' } })
const emit = defineEmits(['toggle-theme'])
const email = ref(''), password = ref(''), busy = ref(false), error = ref(''), recovery = ref(false), show = ref(false)
function setRecovery(value) {
  recovery.value = value; error.value = ''; password.value = ''; show.value = false
}
async function submit(method) {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    if (method === 'google') await loginGoogle()
    else if (recovery.value) { await resetPassword(email.value); notify('Se houver uma conta elegível, você receberá as instruções por e-mail.'); recovery.value = false }
    else await login(email.value, password.value)
  } catch (e) { error.value = errorMessage(e) } finally { busy.value = false }
}
</script>
<template>
  <main class="login-layout">
    <section class="login-card" aria-labelledby="login-title">
      <header class="login-heading" :class="{ 'is-recovery': recovery }">
        <button
          v-if="recovery"
          type="button"
          class="icon-button login-back"
          aria-label="Voltar para o login"
          :disabled="busy"
          @click="setRecovery(false)"
        ><Icon name="back" /></button>
        <h1 id="login-title">{{ recovery ? 'Recuperar senha' : 'Entre na conta' }}</h1>
        <button
          type="button"
          class="icon-button login-theme"
          :aria-label="theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'"
          :title="theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'"
          @click="emit('toggle-theme')"
        >
          <span>{{ theme === 'dark' ? 'Modo claro' : 'Modo escuro' }}</span>
          <Icon :name="theme === 'dark' ? 'sun' : 'moon'" :size="18" />
        </button>
      </header>
      <p v-if="store.configError" class="form-error" role="alert">{{ store.configError }}</p>

      <template v-if="!store.configError">
        <template v-if="!recovery">
          <button class="button secondary google-button" :disabled="busy" @click="submit('google')">
            <svg v-if="!store.demo" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.5a4.8 4.8 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.6ZM12 22c2.7 0 5-.9 6.7-2.5l-3.3-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0 0 12 22Zm-5.6-8.3a6 6 0 0 1 0-3.4V7.6H3a10 10 0 0 0 0 8.8l3.4-2.7ZM12 6.2c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.6l3.4 2.7C7.2 8 9.4 6.2 12 6.2Z"/></svg>
            {{ store.demo ? 'Continuar' : 'Continuar com Google' }}
          </button>
          <div class="divider"><span>ou</span></div>
        </template>

        <form class="form-stack" @submit.prevent="submit('email')">
          <label>E-mail
            <input v-model="email" type="email" autocomplete="username" placeholder="voce@exemplo.com" required :disabled="busy" />
          </label>
          <label v-if="!recovery">Senha
            <div class="password-field">
              <input v-model="password" :type="show ? 'text' : 'password'" autocomplete="current-password" placeholder="Sua senha" required :disabled="busy" />
              <button type="button" class="icon-button" :aria-label="show ? 'Ocultar senha' : 'Mostrar senha'" @click="show = !show">
                <Icon :name="show ? 'hidden' : 'eye'" :size="18" />
              </button>
            </div>
          </label>
          <button v-if="!recovery" type="button" class="text-button align-right" :disabled="busy" @click="setRecovery(true)">Esqueci minha senha</button>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <button class="button" :disabled="busy">{{ busy ? 'Aguarde…' : recovery ? 'Enviar instruções' : 'Entrar' }}</button>
          <button v-if="recovery" type="button" class="text-button" :disabled="busy" @click="setRecovery(false)">Voltar para o login</button>
        </form>
      </template>
    </section>
  </main>
</template>

<style scoped>
.login-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 32px 24px;
  background: var(--surface);
}
.login-card {
  width: 100%;
  max-width: 360px;
}
.login-theme {
  width: auto;
  flex-shrink: 0;
  gap: 6px;
  padding: 0 4px;
  font-size: 11px;
  white-space: nowrap;
}
.login-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 28px;
}
.login-back { flex-shrink: 0; }
.login-card h1 {
  flex: 1;
  min-width: 0;
  margin: 0;
  text-align: left;
  font-size: 28px;
  letter-spacing: -.8px;
}
.is-recovery h1 { font-size: 24px; }
@media (max-width: 380px) {
  .login-card h1 { font-size: 24px; }
  .is-recovery { flex-wrap: wrap; }
  .is-recovery .login-theme { margin-left: auto; }
}
.login-card > .form-error { margin-bottom: 20px; }
.google-button { width: 100%; }
.divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 22px 0;
  font-size: 12px;
  color: var(--muted);
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--border);
}
.password-field { position: relative; }
.password-field input { padding-right: 42px; }
.password-field .icon-button { position: absolute; right: 4px; top: 4px; }
</style>
