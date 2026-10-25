<script setup>
import { ref, computed } from 'vue'
import Icon from './Icon.vue'
import Modal from './Modal.vue'
import { store, openExpense, removeExpense, notify } from '../store'
import { money, dateLabel, paidCents } from '../lib/domain'
import { errorMessage } from '../lib/errors'
const props = defineProps({ expenses: Array, compact: Boolean })
const deleting = ref(null), busy = ref(false), error = ref('')
const categories = computed(() => Object.fromEntries(store.categories.map(c => [c.id, c])))
async function confirmDelete() {
  busy.value = true; error.value = ''
  try { await removeExpense(deleting.value.id); deleting.value = null; notify('Despesa excluída.') } catch (e) { error.value = errorMessage(e) } finally { busy.value = false }
}
</script>
<template>
  <div v-if="!expenses.length" class="empty"><Icon name="expenses" :size="34"/><h3>Nenhuma despesa por aqui</h3><p>Adicione um gasto ou ajuste os filtros para começar.</p></div>
  <div v-else class="expense-table-wrap"><table class="expense-table"><thead><tr><th>Despesa</th><th>Data</th><th>Pagamento</th><th class="numeric">Valor total / pago</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>
    <tr v-for="e in expenses" :key="e.id"><td><div class="expense-identity"><span class="category-icon" :style="{ '--category-color': categories[e.categoryId]?.color || '#6686b1' }"><Icon :name="e.paymentMethod === 'credit' ? 'credit' : 'expenses'" :size="18"/></span><div><strong>{{ e.description || categories[e.categoryId]?.name || 'Despesa' }}</strong><span class="muted small">{{ categories[e.categoryId]?.name || 'Categoria indisponível' }}</span></div></div></td>
    <td data-label="Data">{{ dateLabel(e.date) }}</td><td data-label="Pagamento"><span class="payment-pill">{{ e.paymentMethod === 'credit' ? 'Crédito' : 'PIX/Débito' }}</span><span v-if="e.paymentMethod === 'credit'" class="small muted installment-info">{{ e.paidInstallments }}/{{ e.installments }} parcelas pagas</span></td>
    <td class="numeric" data-label="Total / pago"><strong>{{ money(e.amountCents) }}</strong><span class="small muted">{{ money(paidCents(e)) }} pagos</span></td>
    <td class="row-actions"><button class="icon-button" :aria-label="`Editar ${e.description || 'despesa'}`" @click="openExpense(e)"><Icon name="edit" :size="17"/></button><button class="icon-button danger-text" :aria-label="`Excluir ${e.description || 'despesa'}`" @click="deleting = e; error = ''"><Icon name="trash" :size="17"/></button></td></tr>
  </tbody></table></div>
  <Modal v-if="deleting" title="Excluir despesa?" :busy="busy" @close="!busy && (deleting = null)"><p>Você vai excluir <strong>{{ deleting.description || 'esta despesa' }}</strong>, no valor de {{ money(deleting.amountCents) }}. Esta ação não pode ser desfeita.</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><div class="modal-actions"><button class="button secondary" :disabled="busy" @click="deleting = null">Cancelar</button><button class="button danger" :disabled="busy" @click="confirmDelete">{{ busy ? 'Excluindo…' : 'Excluir despesa' }}</button></div></Modal>
</template>
