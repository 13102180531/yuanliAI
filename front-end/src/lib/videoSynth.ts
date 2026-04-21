export const synthesizeVideo = async (
  clips: {url: string; start: number; end: number; duration: number; type: string}[],
  options: {
    width?: number;
    height?: number;
    transitionType?: string;
    transitionDuration?: number;
  }
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = options.width || 1280;
      canvas.height = options.height || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      const fps = 30;
      const stream = canvas.captureStream(fps);
      
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4'; 
      }
      
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(URL.createObjectURL(blob));
      };
      
      recorder.start();

      let currentClipIndex = 0;
      let animationFrameId: number;
      
      const playNext = async () => {
         if (currentClipIndex >= clips.length) {
            recorder.stop();
            return;
         }
         
         const clip = clips[currentClipIndex];
         const mediaType = clip.type || (clip.url.match(/image/i) ? 'image' : 'video');
         const durationMs = (clip.duration || 5) * 1000;
         const transitionType = options.transitionType || 'none';
         const transDurMs = (options.transitionDuration || 0.5) * 1000;
         
         const renderFrame = (media: HTMLVideoElement | HTMLImageElement, elapsed: number, durationMs: number) => {
             ctx.fillStyle = '#000';
             ctx.fillRect(0, 0, canvas.width, canvas.height);
             
             let isTransitioningIn = elapsed < transDurMs && currentClipIndex > 0;
             let isTransitioningOut = durationMs - elapsed < transDurMs && currentClipIndex < clips.length - 1;
             
             let t = 1;
             if (isTransitioningIn) {
                 t = Math.max(0, elapsed / transDurMs);
             } else if (isTransitioningOut) {
                 t = Math.max(0, (durationMs - elapsed) / transDurMs);
             }

             ctx.save();
             
             if (transitionType !== 'none' && t < 1) {
                 const ease = 1 - Math.pow(1 - t, 3); // Cubic ease out
                 
                 if (transitionType === 'fade_black') {
                     ctx.globalAlpha = t;
                 } else if (transitionType === 'fade_white') {
                     ctx.globalAlpha = t;
                 } else if (transitionType === 'zoom_in') {
                     const scale = isTransitioningIn ? 1.5 - 0.5 * ease : 1.0 + 0.5 * (1 - ease);
                     ctx.globalAlpha = t;
                     ctx.translate(canvas.width / 2, canvas.height / 2);
                     ctx.scale(scale, scale);
                     ctx.translate(-canvas.width / 2, -canvas.height / 2);
                 } else if (transitionType === 'zoom_out') {
                     const scale = isTransitioningIn ? 0.5 + 0.5 * ease : 1.0 - 0.5 * (1 - ease);
                     ctx.globalAlpha = t;
                     ctx.translate(canvas.width / 2, canvas.height / 2);
                     ctx.scale(scale, scale);
                     ctx.translate(-canvas.width / 2, -canvas.height / 2);
                 } else if (transitionType === 'slide_left') {
                     const offset = isTransitioningIn ? (1 - ease) * canvas.width : -(1 - ease) * canvas.width;
                     ctx.translate(offset, 0);
                     ctx.globalAlpha = t;
                 } else if (transitionType === 'slide_right') {
                     const offset = isTransitioningIn ? -(1 - ease) * canvas.width : (1 - ease) * canvas.width;
                     ctx.translate(offset, 0);
                     ctx.globalAlpha = t;
                 } else if (transitionType === 'slide_up') {
                     const offset = isTransitioningIn ? (1 - ease) * canvas.height : -(1 - ease) * canvas.height;
                     ctx.translate(0, offset);
                     ctx.globalAlpha = t;
                 } else if (transitionType === 'slide_down') {
                     const offset = isTransitioningIn ? -(1 - ease) * canvas.height : (1 - ease) * canvas.height;
                     ctx.translate(0, offset);
                     ctx.globalAlpha = t;
                 } else if (transitionType === 'wipe_right') {
                     ctx.beginPath();
                     ctx.globalAlpha = t;
                     const cw = isTransitioningIn ? ease * canvas.width : canvas.width - (1 - ease) * canvas.width;
                     ctx.rect(0, 0, Math.max(0, cw), canvas.height);
                     ctx.clip();
                 } else if (transitionType === 'blur') {
                     ctx.globalAlpha = t;
                     ctx.filter = `blur(${(1 - t) * 20}px)`;
                 }
             }

             // Draw image
             let mw = media instanceof HTMLVideoElement ? media.videoWidth : media.width;
             let mh = media instanceof HTMLVideoElement ? media.videoHeight : media.height;
             if (mw && mh) {
                 const scale = Math.min(canvas.width / mw, canvas.height / mh);
                 const w = mw * scale;
                 const h = mh * scale;
                 const x = (canvas.width - w) / 2;
                 const y = (canvas.height - h) / 2;
                 ctx.drawImage(media, x, y, w, h);
             }
             
             ctx.restore();
             
             if (transitionType === 'fade_white' && t < 1) {
                 ctx.fillStyle = `rgba(255, 255, 255, ${1 - t})`;
                 ctx.fillRect(0, 0, canvas.width, canvas.height);
             }
         };

         if (mediaType === 'image') {
             const img = new Image();
             img.crossOrigin = 'anonymous';
             img.src = clip.url;
             await new Promise(r => {
                 img.onload = r;
                 img.onerror = r;
             });
             
             let startTime = performance.now();
             const draw = () => {
                 const now = performance.now();
                 const elapsed = now - startTime;
                 
                 renderFrame(img, elapsed, durationMs);
                 
                 if (elapsed < durationMs) {
                     animationFrameId = requestAnimationFrame(draw);
                 } else {
                     currentClipIndex++;
                     playNext();
                 }
             };
             animationFrameId = requestAnimationFrame(draw);
             
         } else {
             const video = document.createElement('video');
             video.crossOrigin = 'anonymous';
             video.src = clip.url;
             video.muted = true;
             video.playsInline = true;
             
             await new Promise(r => {
                 video.onloadedmetadata = () => {
                     video.currentTime = clip.start || 0;
                     if (video.readyState >= 2) {
                         r(null);
                     } else {
                         video.onseeked = () => {
                             video.onseeked = null;
                             r(null);
                         };
                     }
                 };
                 video.onerror = r;
             });
             
             try {
                await video.play();
             } catch(e) {
                console.error("Video play failed", e);
             }
             
             let startTime = performance.now();
             const draw = () => {
                 const now = performance.now();
                 const elapsed = now - startTime;
                 
                 if (video.videoWidth > 0 && video.videoHeight > 0) {
                     renderFrame(video, elapsed, durationMs);
                 }
                 
                 if (elapsed < durationMs && !video.ended) {
                     animationFrameId = requestAnimationFrame(draw);
                 } else {
                     video.pause();
                     video.removeAttribute('src'); 
                     video.load();
                     currentClipIndex++;
                     playNext();
                 }
             };
             animationFrameId = requestAnimationFrame(draw);
         }
      };
      
      playNext();
      
    } catch(err) {
      reject(err);
    }
  });
};
