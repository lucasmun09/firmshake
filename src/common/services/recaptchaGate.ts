import { debugLog } from '@/common/debug/debugLog';
import { loggedFetch } from '@/common/debug/loggedFetch';
import { getApiBaseUrl, isApiConfigured } from '@/utils/apiBaseUrl';
import { executeRecaptcha, isRecaptchaConfigured, isRecaptchaDisabled } from '@/utils/recaptcha';

export async function assertRecaptchaVerified(action: string): Promise<void> {
  if (isRecaptchaDisabled() || !isRecaptchaConfigured()) {
    return;
  }

  if (!isApiConfigured()) {
    throw new Error(
      'reCAPTCHA is enabled but the FirmShake API is not configured for this environment.',
    );
  }

  debugLog.info('auth', 'Verifying reCAPTCHA', { action });

  const token = await executeRecaptcha(action);
  const response = await loggedFetch(`${getApiBaseUrl()}/api/auth/verify-recaptcha`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, action }),
  }, {
    category: 'auth',
    label: `POST /api/auth/verify-recaptcha (${action})`,
  });

  if (!response.ok) {
    const body = await response.text();
    let message = 'reCAPTCHA verification failed. Please try again.';
    try {
      const data = JSON.parse(body) as { error?: string };
      if (data.error) {
        message = data.error;
      }
    } catch {
      // Keep default message.
    }
    debugLog.warn('auth', 'reCAPTCHA verification failed', { action, message });
    throw new Error(message);
  }

  debugLog.info('auth', 'reCAPTCHA verified', { action });
}
