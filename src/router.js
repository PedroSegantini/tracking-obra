import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from './views/Dashboard.vue'
import Expenses from './views/Expenses.vue'
import Settings from './views/Settings.vue'
import Account from './views/Account.vue'
import Admin from './views/Admin.vue'
import { store } from './store'
const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/', component: Dashboard, meta: { title: 'Visão geral' } },
  { path: '/despesas', component: Expenses, meta: { title: 'Despesas' } },
  { path: '/configuracoes', component: Settings, meta: { title: 'Configurações' } },
  { path: '/conta', component: Account, meta: { title: 'Minha conta' } },
  { path: '/admin', component: Admin, meta: { title: 'Administração', admin: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
] })
router.beforeEach(to => to.meta.admin && store.ready && store.member?.role !== 'admin' ? '/' : true)
router.afterEach(to => { document.title = `${to.meta.title || 'Sua reforma'} · Tracking Obra` })
export default router
