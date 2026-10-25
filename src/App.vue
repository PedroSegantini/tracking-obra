<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from './components/Icon.vue'
import ExpenseModal from './components/ExpenseModal.vue'
import Login from './views/Login.vue'
import { store, initSession, logout, openExpense, attempt } from './store'
const route = useRoute(), router = useRouter(), mobileOpen = ref(false)
const theme = ref(document.documentElement.dataset.theme || 'light')
const links = computed(() => [ { to: '/', icon: 'dashboard', text: 'Visão geral' }, { to: '/despesas', icon: 'expenses', text: 'Despesas' }, { to: '/configuracoes', icon: 'settings', text: 'Configurações' }, { to: '/conta', icon: 'user', text: 'Minha conta' }, ...(store.member?.role === 'admin' ? [{ to: '/admin', icon: 'users', text: 'Administração' }] : []) ])
function toggleTheme() { theme.value = theme.value === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme.value; try { localStorage.setItem('obra-theme', theme.value) } catch { /* Sem persistência, o tema ainda funciona. */ } }
async function exit() { await attempt(logout); await router.push('/') }
onMounted(initSession)
</script>
<template>
  <a href="#main-content" class="skip-link" v-if="store.member">Pular para conteúdo</a>
  <div v-if="!store.ready" class="full-loading" role="status"><Icon name="loading" class="spin" :size="30"/>Preparando sua reforma…</div>
  <Login v-else-if="!store.user" :theme="theme" @toggle-theme="toggleTheme"/>
  <main v-else-if="!store.member" class="access-page"><span class="brand-mark"><Icon name="helmet" :size="30"/></span><h1>Acesso à reforma pendente</h1><p class="muted">Você entrou como {{ store.user.email }}, mas esta conta não está autorizada. Peça ao administrador para cadastrar este e-mail.</p><p v-if="store.syncError" role="alert" class="form-error">{{ store.syncError }}</p><button class="button" @click="exit">Sair e usar outra conta</button></main>
  <div v-else class="app-layout">
    <button v-if="mobileOpen" class="sidebar-backdrop" aria-label="Fechar menu" @click="mobileOpen = false"/>
    <aside :class="['sidebar', { 'mobile-open': mobileOpen }]"><RouterLink to="/" class="brand" @click="mobileOpen = false"><span class="brand-mark"><Icon name="helmet" :size="27"/></span><span>tracking<span class="brand-light">obra</span><small>SUA REFORMA EM DIA</small></span></RouterLink><div class="project-switch"><span class="project-avatar"><Icon name="house" :size="19"/></span><span><strong>{{ store.renovationName }}</strong><small>Um projeto, toda a família</small></span></div><span class="nav-caption">ACOMPANHAMENTO</span><nav aria-label="Principal"><RouterLink v-for="link in links" :key="link.to" :to="link.to" :class="{ active: route.path === link.to }" @click="mobileOpen = false"><Icon :name="link.icon"/><span>{{ link.text }}</span><Icon v-if="route.path === link.to" class="nav-chevron" name="chevron" :size="16"/></RouterLink></nav><div class="sidebar-bottom"><div class="sidebar-note"><Icon name="house"/><p>Grandes mudanças começam com pequenos cuidados.</p></div><button class="theme-toggle" @click="toggleTheme"><Icon :name="theme === 'dark' ? 'sun' : 'moon'" :size="19"/><span>{{ theme === 'dark' ? 'Modo claro' : 'Modo escuro' }}</span><span class="theme-switch" :class="{ on: theme === 'dark' }"/></button><div class="profile"><span class="avatar">{{ (store.member.name || 'U').slice(0, 1).toUpperCase() }}</span><span><strong>{{ store.member.name }}</strong><small>{{ store.member.role === 'admin' ? 'Administrador' : 'Membro da família' }}</small></span><button class="icon-button" aria-label="Sair da conta" @click="exit"><Icon name="logout" :size="18"/></button></div></div></aside>
    <div class="main-shell"><header class="topbar"><div class="topbar-left"><button class="icon-button menu-toggle" aria-label="Abrir menu" :aria-expanded="mobileOpen" @click="mobileOpen = !mobileOpen"><Icon name="menu"/></button><span class="muted small">Nossa casa</span><Icon name="chevron" :size="14"/><strong class="small">{{ route.meta.title }}</strong></div><div class="topbar-right"><span class="family-badge"><span class="status-dot"/>{{ store.demo ? 'Modo demonstração' : 'Espaço da família' }}</span><button class="icon-button mobile-theme" :aria-label="theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'" @click="toggleTheme"><Icon :name="theme === 'dark' ? 'sun' : 'moon'"/></button></div></header>
      <div v-if="store.demo" class="demo-banner">Demonstração: dados fictícios salvos apenas neste navegador. Configure o Firebase para compartilhar com a família.</div>
      <main id="main-content" class="page" tabindex="-1"><div v-if="store.syncError" class="notice error" role="alert">{{ store.syncError }} Recarregue a página para tentar sincronizar novamente.</div><div v-if="store.loadingData" class="empty" role="status"><Icon name="loading" class="spin"/>Carregando os dados…</div><RouterView v-else/></main>
      <footer class="page-footer"><span>Tracking Obra</span><span>Mais controle para construir seus planos.</span></footer>
    </div><button class="mobile-add" aria-label="Adicionar despesa" @click="openExpense()"><Icon name="plus" :size="26"/></button>
  </div>
  <ExpenseModal v-if="store.member && store.expenseModal"/>
  <div class="toast-container" aria-live="polite" aria-atomic="false"><div v-for="toast in store.toasts" :key="toast.id" :class="['toast', toast.type]"><Icon :name="toast.type === 'error' ? 'alert' : 'check'"/><span>{{ toast.message }}</span><button class="icon-button" aria-label="Dispensar mensagem" @click="store.toasts = store.toasts.filter(t => t.id !== toast.id)"><Icon name="x" :size="16"/></button></div></div>
</template>
