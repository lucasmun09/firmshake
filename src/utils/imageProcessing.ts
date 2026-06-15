const MAX_DIMENSION = 1080;
const MAX_BYTES = 1024 * 1024;
const JPEG_QUALITY_START = 0.85;
const JPEG_QUALITY_STEP = 0.1;
const JPEG_QUALITY_MIN = 0.5;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      type,
      quality,
    );
  });
}

function scaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

async function canSkipReencode(file: File): Promise<boolean> {
  if (file.size > MAX_BYTES || file.type !== 'image/jpeg') {
    return false;
  }

  const [raw, oriented] = await Promise.all([
    createImageBitmap(file),
    createImageBitmap(file, { imageOrientation: 'from-image' }),
  ]);

  try {
    const longest = Math.max(oriented.width, oriented.height);
    const orientationMatchesNatural =
      raw.width === oriented.width && raw.height === oriented.height;

    return longest <= MAX_DIMENSION && orientationMatchesNatural;
  } finally {
    raw.close();
    oriented.close();
  }
}

export async function compressListingPhoto(file: File): Promise<File> {
  if (await canSkipReencode(file)) {
    return file;
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    let { width, height } = scaledDimensions(bitmap.width, bitmap.height, MAX_DIMENSION);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is not available');
    }

    let quality = JPEG_QUALITY_START;
    let blob: Blob | null = null;

    while (true) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      quality = JPEG_QUALITY_START;
      do {
        blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        if (blob.size <= MAX_BYTES) break;
        quality -= JPEG_QUALITY_STEP;
      } while (quality >= JPEG_QUALITY_MIN);

      if (blob.size <= MAX_BYTES) break;

      const nextLongest = Math.max(width, height) * 0.85;
      if (nextLongest < 320) break;

      ({ width, height } = scaledDimensions(width, height, nextLongest));
    }

    if (!blob) {
      throw new Error('Failed to compress image');
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'listing-photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
