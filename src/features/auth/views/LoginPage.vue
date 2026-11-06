<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary" class="auth-toolbar">
        <div class="auth-toolbar-brand">
          <FirmShakeLogo size="brand" />
          <ion-title>FirmShake</ion-title>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <AppContentFrame v-if="completingAuth || googleRedirectProcessing" class="auth-complete-state">
        <ion-spinner name="crescent" />
        <p>Logging in...</p>
      </AppContentFrame>

      <AppContentFrame v-else>
      <h1 class="title">Sign in</h1>
      <p class="subtitle">Community marketplace with FirmShake.</p>

      <form @submit.prevent="handleLogin">
        <ion-item>
          <ion-input
            v-model="email"
            type="email"
            label="Email"
            label-placement="stacked"
            autocomplete="email"
            required
          />
        </ion-item>

        <ion-item>
          <ion-input
            v-model="password"
            type="password"
            label="Password"
            label-placement="stacked"
            autocomplete="current-password"
            required
          />
        </ion-item>

        <ion-text v-if="error" color="danger">
          <p class="error">{{ error }}</p>
        </ion-text>

        <ion-button expand="block" type="submit" :disabled="loading" class="submit-btn">
          {{ loading ? verifyingLabel : 'Sign in' }}
        </ion-button>
      </form>

      <ion-button fill="clear" expand="block" router-link="/forgot-password">
        Forgot password?
      </ion-button>

      <ion-button fill="clear" expand="block" router-link="/register">
        Create an account
      </ion-button>

      <div class="divider">or</div>

      <GoogleSignInButton
        context="signin"
        :disabled="loading"
        :loading="loading"
        :loading-label="verifyingLabel"
        @credential="handleGoogleCredential"
        @fallback="handleGoogleLogin"
        @error="onGoogleButtonError"
      />

      <hr class="section-divider" aria-hidden="true" />

      <ion-button
        expand="block"
        fill="outline"
        color="medium"
        class="browse-guest-btn"
        :router-link="GUEST_BROWSE_PATH"
      >
        Browse Without Login
      </ion-button>

      <ion-note v-if="!isFirebaseConfigured" class="setup-note">
        Firebase is not configured. Copy <code>.env.example</code> to
        <code>.env.local</code> and follow <code>docs/FIREBASE_SETUP.md</code>.
      </ion-note>

      <RecaptchaNotice />
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';

import type { User } from 'firebase/auth';

import {
  authReady,
  currentUser,
  googleRedirectError,
  googleRedirectProcessing,
  loginWithEmail,
  loginWithGoogle,
  loginWithGoogleIdToken,
  navigateAfterAuthentication,
} from '@/features/auth/services/auth';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import GoogleSignInButton from '@/features/auth/components/GoogleSignInButton.vue';
import AppContentFrame from '@/components/AppContentFrame.vue';
import FirmShakeLogo from '@/components/FirmShakeLogo.vue';
import RecaptchaNotice from '@/components/RecaptchaNotice.vue';
import { captureMultiFactorResolver, getPendingMfaResolver } from '@/features/auth/services/mfa';
import { isFirebaseConfigured, auth } from '@/common/services/firebase';
import { formatAuthError, type AuthErrorContext } from '@/features/auth/utils/authErrors';
import { SESSION_EXPIRED_MESSAGE, SESSION_EXPIRED_QUERY } from '@/features/auth/services/sessionExpiry';
import { isGoogleIdentityConfigured, loadGoogleIdentityServices } from '@/features/auth/services/googleIdentity';
import { isRecaptchaConfigured, loadRecaptcha } from '@/utils/recaptcha';
import { GUEST_BROWSE_PATH } from '@/router/rootRoute';

const router = useRouter();
const route = useRoute();
const recaptchaEnabled = isRecaptchaConfigured();
const verifyingLabel = recaptchaEnabled ? 'Verifying security...' : 'Signing in...';

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const completingAuth = ref(false);

onMounted(() => {
  if (route.query[SESSION_EXPIRED_QUERY] === '1') {
    error.value = SESSION_EXPIRED_MESSAGE;
  }

  if (googleRedirectError.value) {
    error.value = googleRedirectError.value;
  }

  if (recaptchaEnabled) {
    void loadRecaptcha().catch(() => {
      // Submit handler will surface a useful error if loading fails.
    });
  }

  if (isGoogleIdentityConfigured()) {
    void loadGoogleIdentityServices().catch(() => {
      // GoogleSignInButton falls back to same-tab redirect when GIS fails to load.
    });
  }
});

watch(googleRedirectError, (message) => {
  if (message) {
    error.value = message;
  }
});

let redirectRecoveryAttempted = false;

watch(
  () => ({
    processing: googleRedirectProcessing.value,
    ready: authReady.value,
    userUid: currentUser.value?.uid ?? null,
    redirectError: googleRedirectError.value,
  }),
  async (state, previous) => {
    const redirectJustFinished = previous?.processing && !state.processing;

    debugLog.debug('auth', 'LoginPage: redirect recovery watch fired', {
      redirectJustFinished,
      redirectRecoveryAttempted,
      processing: state.processing,
      ready: state.ready,
      userUid: state.userUid,
      redirectError: state.redirectError,
      routePath: router.currentRoute.value.fullPath,
    });

    if (!redirectJustFinished || redirectRecoveryAttempted) {
      return;
    }

    debugLog.info('auth', 'LoginPage: redirect processing finished', {
      ready: state.ready,
      userUid: state.userUid,
      previousUserUid: previous?.userUid ?? null,
      authCurrentUserUid: auth?.currentUser?.uid ?? null,
      redirectError: state.redirectError,
      routePath: router.currentRoute.value.fullPath,
    });

    // Popup cancel / already-signed-in sessions also flip processing false.
    // Only auto-navigate when redirect recovery newly established a session.
    if (!state.ready || !state.userUid || state.redirectError || previous?.userUid) {
      debugLog.info('auth', 'LoginPage: redirect finished without recoverable session', {
        ready: state.ready,
        userUid: state.userUid,
        previousUserUid: previous?.userUid ?? null,
        authCurrentUserUid: auth?.currentUser?.uid ?? null,
        redirectError: state.redirectError,
        routePath: router.currentRoute.value.fullPath,
      });
      return;
    }

    redirectRecoveryAttempted = true;
    debugLog.info('auth', 'LoginPage: redirect finished with active session; navigating', {
      uid: state.userUid,
      routePath: router.currentRoute.value.fullPath,
    });

    completingAuth.value = true;
    try {
      await navigateAfterAuthentication(router, currentUser.value!);
      debugLog.info('auth', 'LoginPage: post-redirect navigation succeeded', {
        uid: state.userUid,
        routePath: router.currentRoute.value.fullPath,
      });
    } catch (err) {
      completingAuth.value = false;
      error.value = formatAuthError(err, 'google');
      debugLog.error('auth', 'LoginPage: post-redirect navigation failed', {
        error: serializeError(err),
        uid: state.userUid,
        routePath: router.currentRoute.value.fullPath,
      });
    }
  },
);

async function completeAuthAndNavigate(user: User, context: AuthErrorContext) {
  debugLog.info('auth', 'LoginPage: completeAuthAndNavigate.start', {
    uid: user.uid,
    context,
    routePath: router.currentRoute.value.fullPath,
  });

  completingAuth.value = true;
  try {
    await navigateAfterAuthentication(router, user);
    debugLog.info('auth', 'LoginPage: completeAuthAndNavigate.done', {
      uid: user.uid,
      routePath: router.currentRoute.value.fullPath,
    });
  } catch (err) {
    completingAuth.value = false;
    error.value = formatAuthError(err, context);
    debugLog.error('auth', 'LoginPage: completeAuthAndNavigate failed', {
      uid: user.uid,
      context,
      error: serializeError(err),
      routePath: router.currentRoute.value.fullPath,
    });
  }
}

async function handleLogin() {
  error.value = '';
  loading.value = true;

  try {
    const user = await loginWithEmail(email.value, password.value);
    loading.value = false;
    await completeAuthAndNavigate(user, 'login');
  } catch (err) {
    if (captureMultiFactorResolver(err)) {
      loading.value = false;
      await router.push('/mfa-challenge');
      return;
    }
    error.value = formatAuthError(err, 'login');
    loading.value = false;
  }
}

async function handleGoogleCredential(idToken: string) {
  error.value = '';
  loading.value = true;

  debugLog.info('auth', 'LoginPage: GIS credential received', {
    routePath: router.currentRoute.value.fullPath,
    tokenLength: idToken.length,
  });

  try {
    const user = await loginWithGoogleIdToken(idToken);
    loading.value = false;

    if (user) {
      await completeAuthAndNavigate(user, 'google');
      return;
    }

    if (getPendingMfaResolver()) {
      await router.push('/mfa-challenge');
      return;
    }
  } catch (err) {
    error.value = formatAuthError(err, 'google');
    loading.value = false;
    debugLog.error('auth', 'LoginPage: GIS credential sign-in failed', {
      error: serializeError(err),
    });
  }
}

function onGoogleButtonError(message: string) {
  error.value = message;
}

async function handleGoogleLogin() {
  error.value = '';
  loading.value = true;

  debugLog.info('auth', 'LoginPage: handleGoogleLogin clicked', {
    routePath: router.currentRoute.value.fullPath,
    authReady: authReady.value,
    currentUserUid: currentUser.value?.uid ?? null,
    googleRedirectProcessing: googleRedirectProcessing.value,
  });

  try {
    const user = await loginWithGoogle();
    loading.value = false;

    if (user) {
      debugLog.info('auth', 'LoginPage: Google sign-in returned user', { uid: user.uid });
      await completeAuthAndNavigate(user, 'google');
      return;
    }

    if (getPendingMfaResolver()) {
      debugLog.info('auth', 'LoginPage: redirecting to MFA challenge after Google sign-in');
      await router.push('/mfa-challenge');
      return;
    }

    debugLog.info('auth', 'LoginPage: Google sign-in ended without user (cancelled or redirect started)', {
      googleRedirectProcessing: googleRedirectProcessing.value,
    });
  } catch (err) {
    error.value = formatAuthError(err, 'google');
    loading.value = false;
    debugLog.error('auth', 'LoginPage: handleGoogleLogin failed', {
      error: serializeError(err),
      routePath: router.currentRoute.value.fullPath,
    });
  }
}
</script>

<style scoped>
.auth-toolbar {
  --padding-start: 0.5rem;
  --padding-end: 0.5rem;
}

.auth-toolbar-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: 100%;
  min-height: 44px;
}

.auth-toolbar-brand ion-title {
  position: static;
  padding: 0;
  font-weight: 700;
}

.title {
  margin-top: 0;
}

.subtitle {
  color: var(--ion-color-medium);
  margin-bottom: 1.5rem;
}

.error {
  padding: 0.5rem 1rem;
}

.submit-btn {
  margin-top: 1rem;
}

.divider {
  text-align: center;
  color: var(--ion-color-medium);
  margin: 1rem 0;
}

.section-divider {
  border: none;
  border-top: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.12));
  margin: 1.25rem 0;
}

.browse-guest-btn {
  margin-top: 0;
}

.setup-note {
  display: block;
  margin-top: 2rem;
  line-height: 1.4;
}

.auth-complete-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 50vh;
  color: var(--ion-color-medium);
  text-align: center;
}

.auth-complete-state p {
  margin: 0;
  font-size: 1rem;
}
</style>
