<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Verify phone number</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame>
        <p class="intro">
          A verified phone number is required to use FirmShake. We will send a one-time
          SMS code to confirm your number.
        </p>

        <div v-if="needsEmailVerification" class="email-verify-block">
          <p>
            Verify <strong>{{ userEmail }}</strong> before adding your phone number.
            Check your inbox for a verification link from FirmShake.
          </p>

          <ion-text v-if="emailVerifyMessage" color="medium">
            <p class="hint">{{ emailVerifyMessage }}</p>
          </ion-text>

          <ion-text v-if="error" color="danger">
            <p class="error">{{ error }}</p>
          </ion-text>

          <ion-button
            expand="block"
            fill="outline"
            :disabled="loading"
            class="action-btn"
            @click="handleResendVerificationEmail"
          >
            {{ loading ? 'Sending...' : 'Resend verification email' }}
          </ion-button>

          <ion-button expand="block" :disabled="loading" class="action-btn" @click="handleCheckEmailVerified">
            {{ loading ? 'Checking...' : "I've verified my email" }}
          </ion-button>

          <ion-button
            v-if="showStartOver"
            expand="block"
            fill="clear"
            color="medium"
            :disabled="loading"
            class="start-over-btn"
            @click="confirmStartOver"
          >
            Wrong email? Start over
          </ion-button>
        </div>

        <form v-else-if="!verificationId" @submit.prevent="handleSendCode">
          <PhoneNumberInput ref="phoneInputRef" v-model="phoneNumber" />

          <p class="hint">Double-check your number before sending the code. You can change it here.</p>

          <ion-text v-if="error" color="danger">
            <p class="error">{{ error }}</p>
            <p class="logs-hint">
              Having trouble?
              <router-link :to="{ path: '/logs', query: { from: 'MfaEnroll' } }">View debug logs</router-link>
              and send them to support.
            </p>
          </ion-text>

          <div v-if="showSetupHelp" class="setup-help">
            <p><strong>To enable SMS verification in Firebase:</strong></p>
            <ol>
              <li>Upgrade <code>firmshake-dev</code> to the Blaze plan (required for SMS MFA).</li>
              <li>
                Open
                <a
                  href="https://console.firebase.google.com/project/firmshake-dev/authentication/providers"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Authentication → Sign-in method
                </a>
                and under <strong>Advanced</strong>, enable <strong>SMS Multi-factor Authentication</strong>.
              </li>
              <li>
                In
                <a
                  href="https://console.firebase.google.com/project/firmshake-dev/authentication/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Authentication → Settings
                </a>
                , set <strong>SMS region policy</strong> to Allow and include your country (e.g. United States).
              </li>
              <li>Add test phone numbers under Advanced while developing to avoid SMS throttling.</li>
            </ol>
            <p class="hint">Phone verification is required. Sign out if you need to use a different account.</p>
          </div>

          <ion-button expand="block" type="submit" :disabled="loading" class="action-btn">
            {{ loading ? 'Sending code...' : 'Send verification code' }}
          </ion-button>

          <ion-button
            v-if="showStartOver"
            expand="block"
            fill="clear"
            color="medium"
            :disabled="loading"
            class="start-over-btn"
            @click="confirmStartOver"
          >
            Wrong email? Start over
          </ion-button>
        </form>

        <form v-else @submit.prevent="handleEnroll">
          <p class="hint">Enter the code sent to {{ displayPhone }}.</p>

          <ion-item>
            <ion-input
              v-model="verificationCode"
              label="Verification code"
              label-placement="stacked"
              inputmode="numeric"
              autocomplete="one-time-code"
              required
            />
          </ion-item>

          <ion-text v-if="error" color="danger">
            <p class="error">{{ error }}</p>
            <p class="logs-hint">
              Having trouble?
              <router-link :to="{ path: '/logs', query: { from: 'MfaEnroll' } }">View debug logs</router-link>
              and send them to support.
            </p>
          </ion-text>

          <ion-button expand="block" type="submit" :disabled="loading" class="action-btn">
            {{ loading ? 'Verifying...' : 'Verify phone number' }}
          </ion-button>

          <ion-button
            expand="block"
            fill="outline"
            :disabled="loading"
            class="action-btn"
            @click="handleChangePhoneNumber"
          >
            Use a different number
          </ion-button>

          <ion-button
            v-if="showStartOver"
            expand="block"
            fill="clear"
            color="medium"
            :disabled="loading"
            class="start-over-btn"
            @click="confirmStartOver"
          >
            Wrong email? Start over
          </ion-button>
        </form>

        <p v-if="showStartOver" class="start-over-note">
          Starting over deletes this unfinished account so the correct email and phone can be used.
        </p>

        <ion-button expand="block" fill="clear" color="medium" :disabled="loading || signingOut" @click="handleSignOut">
          Sign out
        </ion-button>

        <div id="mfa-enroll-recaptcha" />
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
  alertController,
} from '@ionic/vue';

import AppContentFrame from '@/components/AppContentFrame.vue';
import PhoneNumberInput from '@/components/PhoneNumberInput.vue';
import {
  abandonIncompleteRegistration,
  currentUser,
  logout,
  reloadCurrentUser,
  sendVerificationEmail,
} from '@/features/auth/services/auth';
import { enrollSmsMfa, isPasswordAuthUser, sendMfaEnrollmentCode, clearRecaptchaVerifier, clearPersistedMfaEnrollmentState, persistMfaEnrollmentState, readPersistedMfaEnrollmentState } from '@/features/auth/services/mfa';
import { formatMfaError, formatStartOverError, shouldShowMfaSetupHelp } from '@/features/auth/utils/authErrors';
import { waitForAuthSuccessScreen } from '@/features/auth/utils/authTransition';
import { debugLog, maskPhoneNumber, serializeError } from '@/common/debug/debugLog';
import {
  clearPendingMfaPhone,
  consumePendingMfaPhone,
  formatPhoneForDisplay,
  guessDefaultCountryCode,
  isValidPhoneNumber,
  nationalPhoneValidationMessage,
} from '@/utils/phoneNumber';

const router = useRouter();

const phoneInputRef = ref<InstanceType<typeof PhoneNumberInput> | null>(null);
const phoneNumber = ref('');
const verificationId = ref('');
const verificationCode = ref('');
const error = ref('');
const emailVerifyMessage = ref('');
const showSetupHelp = ref(false);
const loading = ref(false);
const signingOut = ref(false);
const needsEmailVerification = ref(false);

const displayPhone = computed(() => formatPhoneForDisplay(phoneNumber.value) || phoneNumber.value);
const userEmail = computed(() => currentUser.value?.email ?? 'your email address');
const showStartOver = computed(() => Boolean(currentUser.value && isPasswordAuthUser(currentUser.value)));

function syncEmailVerificationGate(user = currentUser.value): void {
  needsEmailVerification.value = Boolean(user && isPasswordAuthUser(user) && !user.emailVerified);
}

onMounted(() => {
  syncEmailVerificationGate();

  const pendingPhone = consumePendingMfaPhone();
  if (pendingPhone) {
    phoneNumber.value = pendingPhone;
  }

  const persistedEnrollment = readPersistedMfaEnrollmentState();
  if (persistedEnrollment) {
    verificationId.value = persistedEnrollment.verificationId;
    if (persistedEnrollment.phoneNumber && !phoneNumber.value) {
      phoneNumber.value = persistedEnrollment.phoneNumber;
    }
    debugLog.info('mfa', 'MfaEnrollPage: restored pending MFA enrollment state', {
      verificationIdPrefix: persistedEnrollment.verificationId.slice(0, 8),
      phoneMasked: persistedEnrollment.phoneNumber
        ? maskPhoneNumber(persistedEnrollment.phoneNumber)
        : null,
    });
  }

  if (needsEmailVerification.value) {
    emailVerifyMessage.value = 'We sent a verification email when you created your account.';
  }
});

async function handleResendVerificationEmail() {
  error.value = '';
  emailVerifyMessage.value = '';
  loading.value = true;

  try {
    const user = currentUser.value;
    if (!user) {
      throw new Error('You must be signed in to send a verification email');
    }

    await sendVerificationEmail(user);
    emailVerifyMessage.value = 'Verification email sent. Check your inbox and spam folder.';
  } catch (err) {
    error.value = formatMfaError(err);
  } finally {
    loading.value = false;
  }
}

async function handleCheckEmailVerified() {
  error.value = '';
  emailVerifyMessage.value = '';
  loading.value = true;

  try {
    const user = currentUser.value;
    if (!user) {
      throw new Error('You must be signed in');
    }

    await reloadCurrentUser(user);
    syncEmailVerificationGate(currentUser.value);

    if (needsEmailVerification.value) {
      error.value = 'Your email is not verified yet. Open the link in the verification email, then try again.';
      return;
    }

    emailVerifyMessage.value = 'Email verified. You can now add your phone number.';
  } catch (err) {
    error.value = formatMfaError(err);
  } finally {
    loading.value = false;
  }
}

async function handleSendCode() {
  error.value = '';
  showSetupHelp.value = false;

  if (!isValidPhoneNumber(phoneNumber.value)) {
    const countryCode = phoneInputRef.value?.countryCode ?? guessDefaultCountryCode();
    error.value = nationalPhoneValidationMessage(countryCode);
    return;
  }

  loading.value = true;

  try {
    const user = currentUser.value;
    if (!user) {
      throw new Error('You must be signed in to verify your phone number');
    }

    verificationId.value = await sendMfaEnrollmentCode(
      user,
      phoneNumber.value,
      'mfa-enroll-recaptcha',
    );
    persistMfaEnrollmentState(verificationId.value, phoneNumber.value);
  } catch (err) {
    showSetupHelp.value = shouldShowMfaSetupHelp(err);
    error.value = formatMfaError(err, {
      invalidPhoneMessage: nationalPhoneValidationMessage(
        phoneInputRef.value?.countryCode ?? guessDefaultCountryCode(),
      ),
    });
  } finally {
    loading.value = false;
  }
}

async function handleEnroll() {
  error.value = '';
  showSetupHelp.value = false;
  loading.value = true;

  try {
    const user = currentUser.value;
    if (!user) {
      throw new Error('You must be signed in to verify your phone number');
    }

    const enrolledUser = await enrollSmsMfa(
      user,
      verificationId.value,
      verificationCode.value.trim(),
    );
    await waitForAuthSuccessScreen();
    const { navigateAfterAuthentication } = await import('@/features/auth/services/auth');
    await navigateAfterAuthentication(router, enrolledUser);
  } catch (err) {
    showSetupHelp.value = shouldShowMfaSetupHelp(err);
    error.value = formatMfaError(err, {
      invalidPhoneMessage: nationalPhoneValidationMessage(
        phoneInputRef.value?.countryCode ?? guessDefaultCountryCode(),
      ),
    });
  } finally {
    loading.value = false;
  }
}

async function handleChangePhoneNumber() {
  error.value = '';
  verificationId.value = '';
  verificationCode.value = '';
  clearPendingMfaPhone();
  clearPersistedMfaEnrollmentState();
  clearRecaptchaVerifier();
  debugLog.info('mfa', 'MfaEnrollPage: user chose to change phone number');
}

async function confirmStartOver() {
  const alert = await alertController.create({
    header: 'Start over?',
    message:
      'This deletes your unfinished FirmShake account and frees your email and phone number so you can register again with the correct details. This cannot be undone.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Start over',
        role: 'destructive',
        handler: () => {
          void handleStartOver();
        },
      },
    ],
  });

  await alert.present();
}

async function handleStartOver() {
  error.value = '';
  loading.value = true;

  try {
    await abandonIncompleteRegistration();
    await router.replace('/register');
  } catch (err) {
    error.value = formatStartOverError(err);
    debugLog.error('auth', 'MfaEnrollPage: start over failed', {
      error: serializeError(err),
    });
  } finally {
    loading.value = false;
  }
}

async function handleSignOut() {
  if (signingOut.value) {
    return;
  }

  signingOut.value = true;
  error.value = '';

  const uid = currentUser.value?.uid ?? null;
  debugLog.info('auth', 'MfaEnrollPage: sign out requested', {
    uid,
    routePath: '/mfa-enroll',
  });

  try {
    await logout();
    debugLog.info('auth', 'MfaEnrollPage: navigating to login after sign out', { uid });
    await router.replace('/login');
    debugLog.info('auth', 'MfaEnrollPage: sign out navigation complete', { uid });
  } catch (err) {
    debugLog.error('auth', 'MfaEnrollPage: sign out failed', {
      uid,
      error: serializeError(err),
    });
    error.value = 'Could not sign out. Please try again.';
  } finally {
    signingOut.value = false;
  }
}

</script>

<style scoped>
.intro,
.hint {
  color: var(--ion-color-medium);
  line-height: 1.45;
}

.intro {
  margin-bottom: 1rem;
}

.error {
  padding: 0.5rem 1rem;
}

.logs-hint {
  padding: 0 1rem 0.5rem;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.action-btn {
  margin-top: 1rem;
}

.setup-help {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: var(--ion-color-light);
  color: var(--ion-color-medium-shade);
  font-size: 0.9rem;
  line-height: 1.45;
}

.setup-help ol {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
}

.setup-help li + li {
  margin-top: 0.35rem;
}

.setup-help a {
  color: var(--ion-color-primary);
}

.start-over-btn {
  margin-top: 0.5rem;
}

.start-over-note {
  margin: 0.75rem 0 0;
  padding: 0 0.25rem;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  line-height: 1.45;
  text-align: center;
}

.email-verify-block {
  margin-bottom: 1rem;
}

.email-verify-block p {
  line-height: 1.45;
}
</style>
