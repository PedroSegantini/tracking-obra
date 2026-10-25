<script setup>
import { ref, computed } from 'vue'
import Icon from '../components/Icon.vue'
import ExpenseList from '../components/ExpenseList.vue'
import { store, openExpense } from '../store'
import { money, totals, consideredCents, today } from '../lib/domain'
const mode = ref('total')
const currentMonth = today().slice(0, 7)
const sums = computed(() => totals(store.expenses))
const considered = computed(() => mode.value === 'total' ? sums.value.total : sums.value.paid)
const remaining = computed(() => store.budgetCents - considered.value)
const percent = computed(() => store.budgetCents > 0 ? considered.value / store.budgetCents * 100 : null)
const groups = computed(() => store.categories.map(c => ({ ...c, value: store.expenses.filter(e => e.categoryId === c.id).reduce((n, e) => n + consideredCents(e, mode.value), 0) })).sort((a, b) => b.value - a.value))
const recent = computed(() => [...store.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5))
const monthBars = computed(() => {
  const [y, m] = currentMonth.split('-').map(Number)
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(y, m - 6 + i, 1), key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return { key, label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), value: store.expenses.filter(e => e.date.startsWith(key)).reduce((n, e) => n + consideredCents(e, mode.value), 0) }
  })
})
const maxBar = computed(() => Math.max(...monthBars.value.map(b => b.value), 1))
const dateText = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
</script>
<template>
  <div class="page-heading"><div><h1>Visão Geral</h1></div><button class="button" @click="openExpense()"><Icon name="plus" :size="18"/>Adicionar despesa</button></div>
  <div class="overview-toolbar"><div class="segmented" aria-label="Visão dos gastos"><button :class="{ selected: mode === 'total' }" :aria-pressed="mode === 'total'" @click="mode = 'total'">Valor gasto total</button><button :class="{ selected: mode === 'partial' }" :aria-pressed="mode === 'partial'" @click="mode = 'partial'">Valor gasto parcial</button></div><span class="muted small date-stamp">{{ dateText }}</span></div><p class="view-explanation">{{ mode === 'total' ? 'Inclui o valor integral das compras, mesmo com parcelas futuras.' : 'Inclui PIX/Débito e somente as parcelas de crédito informadas como pagas.' }} Valores acumulados de toda a reforma.</p>
  <section class="stats-grid" aria-label="Indicadores da reforma"><article class="stat-card"><div class="stat-top"><span>Expectativa de gasto</span><span class="stat-icon"><Icon name="wallet"/></span></div><strong class="stat-value">{{ money(store.budgetCents) }}</strong><RouterLink to="/configuracoes" class="stat-foot">Ajustar orçamento <Icon name="up" :size="14"/></RouterLink></article><article class="stat-card"><div class="stat-top"><span>{{ mode === 'total' ? 'Gasto total' : 'Gasto parcial' }}</span><span class="stat-icon"><Icon name="expenses"/></span></div><strong class="stat-value">{{ money(considered) }}</strong><span class="stat-foot muted">{{ store.expenses.length }} {{ store.expenses.length === 1 ? 'despesa registrada' : 'despesas registradas' }}</span></article><article :class="['stat-card', 'accent-card', { exceeded: remaining < 0 }]"><div class="stat-top"><span>{{ remaining < 0 ? 'Orçamento excedido' : 'Saldo do orçamento' }}</span><span class="stat-icon"><Icon name="up"/></span></div><strong class="stat-value">{{ money(Math.abs(remaining)) }}</strong><span class="stat-foot">{{ mode === 'total' ? 'Após todas as compras registradas' : 'Após os pagamentos informados' }}</span></article><article class="stat-card"><div class="stat-top"><span>Ainda a pagar (Pago no crédito)</span><span class="stat-icon"><Icon name="credit"/></span></div><strong class="stat-value">{{ money(sums.outstanding) }}</strong><span class="stat-foot muted">Parcelas que ainda não foram quitadas</span></article></section>
  <section class="panel budget-panel"><div class="budget-heading"><div class="inline"><span class="soft-icon"><Icon name="house"/></span><div><h2>Progresso do orçamento gasto</h2></div></div><strong class="budget-percent" :class="{ 'danger-text': percent > 100 }">{{ percent === null ? 'Sem orçamento' : `${percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` }}</strong></div><div class="progress-track" role="progressbar" aria-label="Orçamento utilizado" :aria-valuenow="percent === null ? 0 : Math.round(Math.min(percent, 100))" aria-valuemin="0" aria-valuemax="100" :aria-valuetext="percent === null ? 'Orçamento não definido' : `${percent.toFixed(1)}% utilizado`"><span :class="{ over: percent > 100 }" :style="{ width: `${Math.min(percent || 0, 100)}%` }"/></div><div class="between muted budget-amounts"><span>{{ money(considered) }} utilizados</span><span>Meta: {{ money(store.budgetCents) }}</span></div><p v-if="!store.budgetCents" class="hint">Defina uma expectativa de gasto em Configurações para acompanhar o percentual.</p></section>
  <div class="charts-grid"><section class="panel"><div class="panel-heading"><div><h2>Onde estamos investindo</h2><p class="small muted">Gastos por categoria · {{ mode === 'total' ? 'total' : 'parcial' }}</p></div><span class="subtle-chip">Toda a reforma</span></div><div v-if="considered" class="category-chart"><div class="category-stack">
    <span v-for="g in groups.filter(g => g.value)" :key="g.id" class="category-segment" tabindex="0" role="img" :aria-label="`${g.name}: ${money(g.value)}`" :aria-describedby="`category-tooltip-${g.id}`" :style="{ width: `${g.value / considered * 100}%`, background: g.color }">
      <span :id="`category-tooltip-${g.id}`" class="category-tooltip" role="tooltip">{{ g.name }}</span>
    </span>
  </div><div v-for="g in groups" :key="g.id" class="category-row"><span class="legend-dot" :style="{ background: g.color }"/><span>{{ g.name }}</span><strong>{{ money(g.value) }}</strong><span class="muted category-percent">{{ (g.value / considered * 100).toFixed(0) }}%</span></div></div><div v-else class="empty small">Os gastos desta visão aparecerão aqui.</div></section>
  <section class="panel"><div class="panel-heading"><h2>Compras por mês</h2></div><div class="monthly-chart-scroll" role="region" aria-label="Compras nos últimos seis meses" tabindex="0"><div class="bar-chart"><div v-for="bar in monthBars" :key="bar.key" class="bar-column"><span class="bar-value">{{ money(bar.value) }}</span><div class="bar-well"><div :class="['bar', { latest: bar.key === currentMonth }]" :style="{ height: `${bar.value ? Math.max(bar.value / maxBar * 100, 3) : 0}%` }" :title="`${bar.key}: ${money(bar.value)}`"/></div><span class="bar-label">{{ bar.label }}</span></div></div></div></section></div>
  <section class="panel recent-panel"><div class="panel-heading"><div><h2>Últimos registros</h2><p class="small muted">Os gastos mais recentes da sua reforma</p></div><RouterLink to="/despesas" class="text-button inline">Ver todas<Icon name="arrow" :size="16"/></RouterLink></div><ExpenseList :expenses="recent" compact/></section>
</template>

<style scoped>
.budget-panel .budget-amounts { font-size: var(--font-body); line-height: 1.6; flex-wrap: wrap; }
.category-stack { overflow: visible; }
.category-segment { position: relative; }
.category-segment:first-child { border-radius: 5px 0 0 5px; }
.category-segment:last-child { border-radius: 0 5px 5px 0; }
.category-segment:only-child { border-radius: 5px; }
.category-segment:focus-visible { outline: 2px solid var(--green-text); outline-offset: 3px; }
.category-tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  width: max-content;
  max-width: min(240px, 65vw);
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
  font-size: var(--font-small);
  line-height: 1.5;
  overflow-wrap: anywhere;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}
.category-segment:first-child .category-tooltip { left: 0; transform: none; }
.category-segment:last-child:not(:first-child) .category-tooltip { left: auto; right: 0; transform: none; }
.category-segment:hover .category-tooltip, .category-segment:focus .category-tooltip { visibility: visible; opacity: 1; }

</style>
