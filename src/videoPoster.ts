export type VideoPosterCaptureResult = {
  file: File;
  objectUrl: string;
};

const MAX_POSTER_EDGE = 750;
const TARGET_BYTES = 150 * 1024;

/** Capture a local video's first frame. The caller owns the returned object URL. */
export async function captureVideoPoster(file: File): Promise<VideoPosterCaptureResult> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  try {
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        video.onloadeddata = null;
        video.onerror = null;
        error ? reject(error) : resolve();
      };
      const timer = setTimeout(() => finish(new Error('读取视频首帧超时，请手动上传封面')), 15000);
      video.onloadeddata = () => finish();
      video.onerror = () => finish(new Error('无法读取视频首帧'));
      video.src = objectUrl;
      video.load();
    });
    if (!video.videoWidth || !video.videoHeight) throw new Error('无法读取视频尺寸');
    const scale = Math.min(1, MAX_POSTER_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器不支持视频封面生成');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    let quality = 0.82;
    let blob = await canvasToBlob(canvas, quality);
    while (blob.size > TARGET_BYTES && quality > 0.35) {
      quality -= 0.08;
      blob = await canvasToBlob(canvas, quality);
    }
    return { file: new File([blob], 'video-poster.webp', { type: 'image/webp' }), objectUrl };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法生成视频封面')), 'image/webp', quality);
  });
}
