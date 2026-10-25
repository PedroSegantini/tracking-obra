<script setup>
import { computed, ref, watch } from 'vue'
import Icon from '../components/Icon.vue'
import ExpenseList from '../components/ExpenseList.vue'
import { store, openExpense, attempt } from '../store'
import { money, totals, normalizeName } from '../lib/domain'
import { downloadWorkbook } from '../lib/excel'
import { openDatePicker } from '../lib/date-picker'
const search = ref(''), category = ref(''), method = ref(''), from = ref(''), until = ref(''), page = ref(1), exporting = ref(false)
const filtered = computed(() => [...store.expenses].filter(e => (!category.value || e.categoryId === category.value) && (!method.value || e.paymentMethod === method.value) && (!from.value || e.date >= from.value) && (!until.value || e.date <= until.value) && (!search.value || normalizeName(`${e.description} ${store.categories.find(c => c.id === e.categoryId)?.name || ''}`).includes(normalizeName(search.value)))).sort((a, b) => b.date.localeCompare(a.date)))
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 15)))
const visible = computed(() => filtered.value.slice((page.value - 1) * 15, page.value * 15))
const sums = computed(() => totals(filtered.value))
watch([search, category, method, from, until], () => { page.value = 1 })
watch(pages, n => { page.value = Math.min(page.value, n) })
function clear() { search.value = ''; category.value = ''; method.value = ''; from.value = ''; until.value = '' }
async function exportData() { exporting.value = true; await attempt(() => downloadWorkbook(filtered.value, store.categories)); exporting.value = false }
</script>
<template>
  <div class="page-heading"><div><h1>Despesas</h1><p class="muted">Consulte, organize e atualize os gastos.</p></div><div class="inline wrap"><button class="button secondary" :disabled="exporting" @click="exportData"><Icon name="download" :size="18"/>{{ exporting ? 'Exportando…' : 'Exportar Excel' }}</button><button class="button" @click="openExpense()"><Icon name="plus" :size="18"/>Adicionar despesa</button></div></div>
  <section class="panel filters"><div class="filter-grid"><label class="search-field"><span>Buscar</span><div class="input-icon"><Icon name="search" :size="18"/><input v-model="search" placeholder="Descrição ou categoria" type="search"/></div></label><label>Categoria<select v-model="category"><option value="">Todas</option><option v-for="c in store.categories" :key="c.id" :value="c.id">{{ c.name }}</option></select></label><label>Pagamento<select v-model="method"><option value="">Todos</option><option value="pix">PIX/Débito</option><option value="credit">Crédito</option></select></label><label>De<input v-model="from" type="date" @click="openDatePicker"/></label><label>Até<input v-model="until" type="date" @click="openDatePicker"/></label></div><div class="between small"><span class="muted">{{ filtered.length }} registros encontrados</span><button class="text-button" @click="clear">Limpar filtros</button></div><p v-if="from && until && from > until" class="form-error">A data inicial está depois da data final.</p></section>
  <div class="mini-stats"><span>Total filtrado <strong>{{ money(sums.total) }}</strong></span><span>Já pago <strong>{{ money(sums.paid) }}</strong></span><span>Ainda a pagar <strong>{{ money(sums.outstanding) }}</strong></span></div>
  <section class="panel"><ExpenseList :expenses="visible"/><div v-if="filtered.length" class="pagination"><span class="muted small">Página {{ page }} de {{ pages }}</span><div class="inline"><button class="button secondary small-button" :disabled="page === 1" @click="page--">Anterior</button><button class="button secondary small-button" :disabled="page === pages" @click="page++">Próxima</button></div></div></section><p class="hint">A exportação inclui todos os resultados dos filtros, mesmo os de outras páginas.</p>
</template>
