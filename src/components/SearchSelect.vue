<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, useId } from 'vue'
import Icon from './Icon.vue'
import { normalizeName } from '../lib/domain'
const props = defineProps({ modelValue: { type: String, default: '' }, label: String, placeholder: { type: String, default: 'Buscar e selecionar' }, options: { type: Array, default: () => [] }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const id = useId(), root = ref(null), opened = ref(false), search = ref(''), active = ref(0)
const selected = computed(() => props.options.find(option => option.id === props.modelValue))
const filtered = computed(() => props.options.filter(option => normalizeName(option.label).includes(normalizeName(search.value))))
watch(() => props.disabled, value => { if (value) opened.value = false })
watch(filtered, options => { if (active.value >= options.length) active.value = 0 })
function open() { if (!props.disabled && !opened.value) { opened.value = true; search.value = ''; active.value = 0 } }
function type(event) { search.value = event.target.value; opened.value = true; active.value = 0; emit('update:modelValue', '') }
function choose(option) { emit('update:modelValue', option.id); opened.value = false; search.value = '' }
function keyboard(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!opened.value) open()
    else active.value = Math.max(0, Math.min(filtered.value.length - 1, active.value + (event.key === 'ArrowDown' ? 1 : -1)))
    root.value?.querySelector(`#${id}-option-${active.value}`)?.scrollIntoView?.({ block: 'nearest' })
  } else if (event.key === 'Enter' && opened.value) { event.preventDefault(); if (filtered.value[active.value]) choose(filtered.value[active.value]) }
  else if (event.key === 'Escape' && opened.value) { event.preventDefault(); event.stopPropagation(); opened.value = false }
  else if (event.key === 'Tab') opened.value = false
}
function outside(event) { if (!root.value?.contains(event.target)) opened.value = false }
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>
<template>
  <div ref="root" class="search-select">
    <label :for="id">{{ label }}</label>
    <div class="search-select-field"><input :id="id" role="combobox" autocomplete="off" :value="opened ? search : (selected?.label || '')" :placeholder="placeholder" :disabled="disabled" :aria-expanded="opened" :aria-controls="`${id}-list`" :aria-activedescendant="opened && filtered[active] ? `${id}-option-${active}` : undefined" aria-autocomplete="list" @focus="open" @click="open" @input="type" @keydown="keyboard"/><Icon name="chevron" :size="18"/></div>
    <div v-if="opened" :id="`${id}-list`" class="search-select-list" role="listbox" :aria-label="label">
      <div v-for="(option, index) in filtered" :id="`${id}-option-${index}`" :key="option.id" role="option" :aria-selected="modelValue === option.id" :class="['search-select-option', { active: index === active }]" @pointerdown.prevent @mouseenter="active = index" @click="choose(option)"><span>{{ option.label }}</span><small v-if="option.description" class="muted">{{ option.description }}</small><Icon v-if="modelValue === option.id" name="check" :size="16"/></div>
      <p v-if="!filtered.length" class="no-results">Nenhum resultado encontrado.</p>
    </div>
  </div>
</template>
<style scoped>
.search-select { position: relative; min-width: 0; }
.search-select label { margin-bottom: 8px; }
.search-select-field { position: relative; }
.search-select-field input { padding-right: 42px; }
.search-select-field > svg { position: absolute; right: 14px; top: 50%; transform: translateY(-50%) rotate(90deg); color: var(--muted); pointer-events: none; }
.search-select-list { position: relative; margin-top: 5px; z-index: 5; max-height: 240px; overflow-y: auto; border: 1px solid var(--border); border-radius: 9px; padding: 5px; background: var(--surface); box-shadow: var(--shadow); }
.search-select-option { position: relative; display: flex; flex-direction: column; gap: 3px; padding: 10px 30px 10px 10px; border-radius: 5px; cursor: pointer; overflow-wrap: anywhere; }
.search-select-option.active { background: var(--green-soft); }
.search-select-option small, .no-results { font-size: var(--font-small); }
.search-select-option > svg { position: absolute; right: 8px; top: 12px; color: var(--green-text); }
.no-results { padding: 12px; color: var(--muted); }
</style>
