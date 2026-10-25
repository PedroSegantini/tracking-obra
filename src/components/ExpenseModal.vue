<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Modal from './Modal.vue'
import { store, saveExpense, notify } from '../store'
import { parseMoney, inputMoney, today, paidCents, money } from '../lib/domain'
import { errorMessage } from '../lib/errors'
import { openDatePicker } from '../lib/date-picker'
const existing = store.editing
const form = reactive({ amount: existing ? inputMoney(existing.amountCents) : '', date: existing?.date || today(), categoryId: existing?.categoryId || '', paymentMethod: existing?.paymentMethod || 'pix', installments: existing?.installments || 1, paidInstallments: existing?.paidInstallments ?? 0, description: existing?.description || '' })
const busy = ref(false), error = ref('')
const categories = computed(() => store.categories.filter(c => c.active || c.id === existing?.categoryId))
watch(() => form.installments, value => { if (Number(form.paidInstallments) > Number(value)) form.paidInstallments = value })
const partial = computed(() => { try { return paidCents({ amountCents: parseMoney(form.amount), paymentMethod: form.paymentMethod, installments: Number(form.installments), paidInstallments: Number(form.paidInstallments) }) } catch { return 0 } })
function close() { if (!busy.value) store.expenseModal = false }
async function submit() {
  busy.value = true; error.value = ''
  try {
    await saveExpense({ amountCents: parseMoney(form.amount), date: form.date, categoryId: form.categoryId, paymentMethod: form.paymentMethod, installments: form.paymentMethod === 'pix' ? 1 : Number(form.installments), paidInstallments: form.paymentMethod === 'pix' ? 1 : Number(form.paidInstallments), description: form.description }, existing?.id)
    notify(existing ? 'Despesa atualizada.' : 'Despesa adicionada.'); busy.value = false; close()
  } catch (e) { error.value = errorMessage(e) } finally { busy.value = false }
}
</script>
<template>
  <Modal :title="existing ? 'Editar despesa' : 'Adicionar despesa'" :busy="busy" @close="close">
    <form class="form-stack" @submit.prevent="submit">
      <p class="muted">Registre o valor total da compra, mesmo quando parcelada.</p>
      <label>Valor total (R$)<input v-model="form.amount" inputmode="decimal" placeholder="0,00" required maxlength="20" autofocus /></label>
      <div class="form-grid"><label>Data da compra<input v-model="form.date" type="date" @click="openDatePicker" min="1900-01-01" max="2199-12-31" required /></label><label>Categoria<select v-model="form.categoryId" required><option value="" disabled>Selecione</option><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}{{ c.active ? '' : ' (desativada)' }}</option></select></label></div>
      <p v-if="!categories.length" class="hint">Crie ou reative uma categoria em Configurações antes de registrar.</p>
      <label>Forma de pagamento<select v-model="form.paymentMethod"><option value="pix">PIX/Débito</option><option value="credit">Crédito</option></select></label>
      <div v-if="form.paymentMethod === 'credit'" class="inset form-stack">
        <div class="form-grid"><label>Total de parcelas<input v-model.number="form.installments" type="number" min="1" max="600" step="1" required /></label><label>Parcelas já pagas<input v-model.number="form.paidInstallments" type="number" min="0" :max="form.installments" step="1" required /></label></div>
        <p class="hint">Consideramos as primeiras parcelas quitadas. Atualize esta quantidade quando pagar novas parcelas.</p><p class="small">Valor pago até agora: <strong>{{ money(Number.isFinite(partial) ? partial : 0) }}</strong></p>
      </div>
      <label>Descrição <span class="optional">opcional</span><textarea v-model="form.description" maxlength="500" rows="3" placeholder="Ex.: pisos da cozinha" /></label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="modal-actions"><button type="button" class="button secondary" :disabled="busy" @click="close">Cancelar</button><button class="button" :disabled="busy">{{ busy ? 'Salvando…' : 'Salvar despesa' }}</button></div>
    </form>
  </Modal>
</template>
