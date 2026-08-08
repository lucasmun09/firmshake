import { alertController, type UseIonRouterResult } from '@ionic/vue';

const GUEST_TAB_LOGIN_MESSAGE =
  'Sign in to message sellers, propose FirmShakes, and manage your buying and selling.';

/** Tab routes that require auth — desktop guests see a prompt instead of leaving the tab shell. */
export const GUEST_PROTECTED_TAB_PATHS = new Set([
  '/tabs/buying',
  '/tabs/selling',
  '/tabs/inbox',
  '/tabs/profile',
  '/tabs/sell',
]);

export function isGuestProtectedTabPath(path: string): boolean {
  const normalized = path.replace(/\/$/, '') || '/';
  return GUEST_PROTECTED_TAB_PATHS.has(normalized);
}

export function guestTabFeatureLabel(path: string): string {
  switch (path.replace(/\/$/, '') || '/') {
    case '/tabs/buying':
      return 'Buying';
    case '/tabs/selling':
      return 'Selling';
    case '/tabs/inbox':
      return 'Inbox';
    case '/tabs/profile':
      return 'Settings';
    case '/tabs/sell':
      return 'Sell';
    default:
      return 'this feature';
  }
}

export async function promptGuestSignIn(
  ionRouter: UseIonRouterResult,
  featureLabel = 'this feature',
): Promise<void> {
  const alert = await alertController.create({
    header: 'Sign in required',
    message: `${GUEST_TAB_LOGIN_MESSAGE} Sign in to access ${featureLabel}.`,
    buttons: [
      { text: 'Continue browsing', role: 'cancel' },
      {
        text: 'Sign in',
        handler: () => {
          ionRouter.navigate('/login', 'forward', 'push');
        },
      },
    ],
  });

  await alert.present();
}
