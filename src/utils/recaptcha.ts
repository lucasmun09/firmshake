declare global {
  interface GrecaptchaClient {
    ready(callback: () => void): void;
    execute(siteKey: string, options: { action: string }): Promise<string>;
  }

  interface Window {
    grecaptcha?: GrecaptchaClient & {
      enterprise?: GrecaptchaClient;
    };
  }
}

/** Temporary kill-switch — set VITE_RECAPTCHA_DISABLED=false to re-enable. */
export function isRecaptchaDisabled(): boolean {
  const flag = import.meta.env.VITE_RECAPTCHA_DISABLED?.trim().toLowerCase();
  if (flag === 'false' || flag === '0') {
    return false;
  }
  // Disabled by default until reCAPTCHA is re-enabled explicitly.
  return true;
}

export function isRecaptchaConfigured(): boolean {
  return !isRecaptchaDisabled() && Boolean(import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim());
}

function useEnterpriseRecaptcha(): boolean {
  const flag = import.meta.env.VITE_RECAPTCHA_USE_ENTERPRISE?.trim();
  if (flag === 'true') {
    return true;
  }
  if (flag === 'false') {
    return false;
  }

  // Production builds use Cloud Run, which verifies tokens via reCAPTCHA Enterprise.
  return !import.meta.env.DEV;
}

function getSiteKey(): string {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();
  if (!siteKey) {
    throw new Error('reCAPTCHA is not configured');
  }
  return siteKey;
}

function getRecaptchaClient(): GrecaptchaClient {
  const grecaptcha = window.grecaptcha;
  if (!grecaptcha) {
    throw new Error('reCAPTCHA failed to initialize');
  }

  if (useEnterpriseRecaptcha()) {
    const enterprise = grecaptcha.enterprise;
    if (!enterprise) {
      throw new Error('reCAPTCHA Enterprise failed to initialize');
    }
    return enterprise;
  }

  return grecaptcha;
}

let loadPromise: Promise<void> | null = null;

/**
 * Clears login reCAPTCHA Enterprise (v3 render) so Firebase phone MFA can load
 * reCAPTCHA v2 or its own Enterprise script. Login loads enterprise.js with
 * ?render=, which leaves window.grecaptcha without render()/getResponse(); MFA
 * then fails with auth/internal-error when Enterprise execute falls back to v2.
 */
export function resetLoginRecaptchaForPhoneMfa(): void {
  if (typeof window === 'undefined') {
    return;
  }

  document
    .querySelectorAll('script[data-firmshake-recaptcha="true"]')
    .forEach((node) => node.remove());

  const grecaptcha = window.grecaptcha as (typeof window.grecaptcha & { render?: unknown }) | undefined;
  if (grecaptcha && typeof grecaptcha.render !== 'function') {
    delete window.grecaptcha;
  }

  loadPromise = null;
}

export async function loadRecaptcha(): Promise<void> {
  if (!isRecaptchaConfigured()) {
    return;
  }

  if (window.grecaptcha) {
    return;
  }

  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-firmshake-recaptcha="true"]',
      );
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load reCAPTCHA')), {
          once: true,
        });
        return;
      }

      const siteKey = getSiteKey();
      const script = document.createElement('script');
      script.src = useEnterpriseRecaptcha()
        ? `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(siteKey)}`
        : `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      script.dataset.firmshakeRecaptcha = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load reCAPTCHA'));
      document.head.appendChild(script);
    });
  }

  await loadPromise;
}

export async function executeRecaptcha(action: string): Promise<string> {
  if (!isRecaptchaConfigured()) {
    throw new Error('reCAPTCHA is not configured');
  }

  await loadRecaptcha();
  const client = getRecaptchaClient();

  return new Promise<string>((resolve, reject) => {
    client.ready(() => {
      client
        .execute(getSiteKey(), { action })
        .then(resolve)
        .catch(reject);
    });
  });
}
