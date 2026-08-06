export interface WebcamCapture {
  stop: () => void;
  capture: () => Promise<File>;
}

export async function startWebcamCapture(
  video: HTMLVideoElement,
): Promise<WebcamCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'environment',
    },
    audio: false,
  });

  video.srcObject = stream;
  await video.play();

  return {
    stop() {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      video.srcObject = null;
    },
    async capture() {
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      const width = settings.width ?? video.videoWidth;
      const height = settings.height ?? video.videoHeight;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not capture photo');
      }

      context.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (nextBlob) => (nextBlob ? resolve(nextBlob) : reject(new Error('Capture failed'))),
          'image/jpeg',
          0.9,
        );
      });

      return new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
    },
  };
}

export function isWebcamAvailable(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}
