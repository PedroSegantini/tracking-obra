<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
defineProps({ title: String, busy: Boolean, wide: Boolean })
const emit = defineEmits(['close'])
const dialog = ref(null)
const titleId = `dialog-${crypto.randomUUID()}`
function cancel(event) { event.preventDefault(); emit('close') }
onMounted(() => { dialog.value.showModal(); document.body.style.overflow = 'hidden' })
onBeforeUnmount(() => { document.body.style.overflow = ''; dialog.value?.close() })
</script>
<template>
  <dialog ref="dialog" :class="['modal', { wide }]" :aria-labelledby="titleId" @cancel="cancel">
    <header class="modal-heading"><h2 :id="titleId">{{ title }}</h2><button class="icon-button" type="button" aria-label="Fechar janela" :disabled="busy" @click="emit('close')"><Icon name="x" /></button></header>
    <slot />
  </dialog>
</template>
