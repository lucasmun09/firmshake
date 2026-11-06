import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/logs',
    name: 'Logs',
    component: () => import('@/features/debug/views/LogsPage.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/logs',
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
