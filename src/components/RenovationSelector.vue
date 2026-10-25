<script setup>
import { ref } from 'vue'
import Icon from './Icon.vue'
import Modal from './Modal.vue'
import { store, selectRenovation, createRenovation, notify } from '../store'
import { errorMessage } from '../lib/errors'
const creating = ref(false), name = ref(''), busy = ref(false), error = ref('')
function change(event) {
  const id = event.target.value
  if (id === '__new__') { event.target.value = store.selectedRenovationId; name.value = ''; error.value = ''; creating.value = true }
  else { try { selectRenovation(id) } catch (e) { notify(errorMessage(e), 'error') } }
}
async function submit() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { await createRenovation(name.value); creating.value = false; notify('Reforma criada.') }
  catch (e) { error.value = errorMessage(e) } finally { busy.value = false }
}
</script>
<template>
  <div class="renovation-switch">
    <span class="project-avatar"><Icon name="house" :size="19" /></span>
    <label class="sr-only" for="renovation-select">Selecionar reforma</label>
    <select id="renovation-select" :value="store.selectedRenovationId" :disabled="store.loadingData || store.expenseModal || busy" @change="change">
      <option v-for="project in store.renovations" :key="project.id" :value="project.id">{{ project.name }}</option>
      <option v-if="store.member?.role === 'admin'" value="__new__">+ Nova reforma</option>
    </select>
  </div>
  <Modal v-if="creating" title="Nova reforma" :busy="busy" @close="!busy && (creating = false)">
    <form class="form-stack" @submit.prevent="submit">
      <label>Nome da reforma<input v-model="name" minlength="2" maxlength="80" placeholder="Ex.: Apartamento" required autofocus :disabled="busy" /></label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="modal-actions"><button type="button" class="button secondary" :disabled="busy" @click="creating = false">Cancelar</button><button class="button" :disabled="busy">{{ busy ? 'Criando…' : 'Criar reforma' }}</button></div>
    </form>
  </Modal>
</template>
<style scoped>
.renovation-switch { display: flex; align-items: center; gap: 8px; padding: 8px; margin: 34px 0 28px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-alt); }
.renovation-switch select { min-width: 0; flex: 1; padding: 9px 4px; border: 0; background: transparent; font-weight: 650; font-size: 12px; text-overflow: ellipsis; }
</style>
