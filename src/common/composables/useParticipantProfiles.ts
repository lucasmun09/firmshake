import { onUnmounted, ref, watch, type Ref } from 'vue';

import { subscribeUserProfile } from '@/common/services/users';

export interface ParticipantProfile {
  displayName: string;
  photoUrl?: string;
}

export function useParticipantProfiles(userIds: Ref<string[]>) {
  const participantProfiles = ref<Record<string, ParticipantProfile>>({});
  const unsubscribers: Array<() => void> = [];

  function resubscribe(ids: string[]) {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    unsubscribers.length = 0;

    for (const uid of ids) {
      if (!uid) {
        continue;
      }

      const unsubscribe = subscribeUserProfile(uid, (profile) => {
        participantProfiles.value = {
          ...participantProfiles.value,
          [uid]: {
            displayName: profile?.displayName ?? 'FirmShake User',
            photoUrl: profile?.photoUrl,
          },
        };
      });
      unsubscribers.push(unsubscribe);
    }
  }

  watch(userIds, (ids) => resubscribe(ids), { immediate: true });

  onUnmounted(() => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  return { participantProfiles };
}
