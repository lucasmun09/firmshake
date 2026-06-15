import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

import { compressListingPhoto } from '@/utils/imageProcessing';

export async function pickListingPhoto(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  const photo = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt,
  });

  if (!photo.webPath) return null;

  const response = await fetch(photo.webPath);
  const blob = await response.blob();
  const extension = blob.type.split('/')[1] ?? 'jpeg';

  const file = new File([blob], `listing-photo.${extension}`, {
    type: blob.type || 'image/jpeg',
  });

  return compressListingPhoto(file);
}
