import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

import { compressListingPhoto } from '@/utils/imageProcessing';

async function photoUriToFile(uri: string, name = 'listing-photo'): Promise<File> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const extension = blob.type.split('/')[1] ?? 'jpeg';

  const file = new File([blob], `${name}.${extension}`, {
    type: blob.type || 'image/jpeg',
  });

  return compressListingPhoto(file);
}

async function captureNativePhoto(source: CameraSource): Promise<File | null> {
  const photo = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source,
  });

  if (!photo.webPath) {
    return null;
  }

  return photoUriToFile(photo.webPath);
}

export async function takeListingPhoto(): Promise<File | null> {
  if (Capacitor.isNativePlatform()) {
    return captureNativePhoto(CameraSource.Camera);
  }

  return null;
}

export async function pickListingPhotoFromLibrary(): Promise<File | null> {
  if (Capacitor.isNativePlatform()) {
    return captureNativePhoto(CameraSource.Photos);
  }

  return null;
}

/** @deprecated Use takeListingPhoto or pickListingPhotoFromLibrary */
export async function pickListingPhoto(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  return captureNativePhoto(CameraSource.Prompt);
}

export async function filesFromInput(input: HTMLInputElement): Promise<File[]> {
  const files = Array.from(input.files ?? []);
  input.value = '';
  return files;
}

export async function compressListingPhotos(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => compressListingPhoto(file)));
}
