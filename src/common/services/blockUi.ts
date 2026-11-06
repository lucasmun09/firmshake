import { alertController, toastController } from '@ionic/vue';

import type { ParticipantProfile } from '@/common/composables/useParticipantProfiles';

export const BLOCK_CONFIRM_MESSAGE =
  'Blocking a user means you will no longer able to see their listing and restricts all communication. Do you still want to proceed?';

const BLOCK_SUCCESS_TOAST_MS = 5000;

export function resolveBlockedDisplayName(
  userId: string,
  profiles: Record<string, ParticipantProfile | undefined>,
  fallback = 'FirmShake User',
): string {
  return profiles[userId]?.displayName ?? fallback;
}

export async function confirmBlockUser(): Promise<boolean> {
  let confirmed = false;

  const alert = await alertController.create({
    message: BLOCK_CONFIRM_MESSAGE,
    buttons: [
      { text: 'No', role: 'cancel' },
      {
        text: 'Yes',
        handler: () => {
          confirmed = true;
        },
      },
    ],
  });

  await alert.present();
  await alert.onDidDismiss();
  return confirmed;
}

export async function showBlockSuccessToast(displayName: string): Promise<void> {
  const toast = await toastController.create({
    message: `You have successfully blocked ${displayName}. You can see all blocked users by going to Gear Icon -> Blocked Users`,
    duration: BLOCK_SUCCESS_TOAST_MS,
    position: 'top',
    color: 'success',
  });
  await toast.present();
}
