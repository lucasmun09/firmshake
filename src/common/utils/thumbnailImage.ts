export const THUMBNAIL_MAX_DIMENSION = 320;
export const THUMBNAIL_JPEG_QUALITY = 0.75;

export function thumbnailCacheKey(url: string): string {
  return `thumb:${url}`;
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

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode thumbnail'))),
      'image/jpeg',
      quality,
    );
  });
}

/** Resize an image blob for browse-card thumbnails. Falls back to the source blob when canvas APIs are unavailable. */
export async function createThumbnailBlob(
  source: Blob,
  maxDimension = THUMBNAIL_MAX_DIMENSION,
): Promise<Blob> {
  if (
    typeof createImageBitmap === 'undefined' ||
    typeof document === 'undefined' ||
    !source.type.startsWith('image/')
  ) {
    return source;
  }

  const bitmap = await createImageBitmap(source);
  try {
    const { width, height } = scaledDimensions(bitmap.width, bitmap.height, maxDimension);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      return source;
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(bitmap, 0, 0, width, height);
    return canvasToBlob(canvas, THUMBNAIL_JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}
