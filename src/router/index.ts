import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';

import { authReady, currentUser } from '@/services/auth';
import TabsPage from '@/views/TabsPage.vue';

const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: '/tabs/home' },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/RegisterPage.vue'),
    meta: { public: true },
  },
  {
    path: '/tabs/',
    component: TabsPage,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/tabs/home',
      },
      {
        path: 'home',
        name: 'Home',
        component: () => import('@/views/HomePage.vue'),
      },
      {
        path: 'sell',
        name: 'Sell',
        component: () => import('@/views/CreateListingPage.vue'),
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/ProfilePage.vue'),
      },
    ],
  },
  {
    path: '/listing/:id',
    name: 'ListingDetail',
    component: () => import('@/views/ListingDetailPage.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  if (!authReady.value) {
    await new Promise<void>((resolve) => {
      const interval = window.setInterval(() => {
        if (authReady.value) {
          window.clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  const isPublic = to.meta.public === true;
  const requiresAuth = to.meta.requiresAuth === true;
  const isLoggedIn = Boolean(currentUser.value);

  if (requiresAuth && !isLoggedIn) {
    return { name: 'Login', query: { redirect: to.fullPath } };
  }

  if (isPublic && isLoggedIn && (to.name === 'Login' || to.name === 'Register')) {
    return { name: 'Home' };
  }

  return true;
});

export default router;
