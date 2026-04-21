import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    pannellum: any;
  }
}

const PANNELUM_JS = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
const PANNELUM_CSS = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';

export const loadPannellum = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.pannellum) {
      resolve();
      return;
    }

    if (!document.querySelector(`link[href="${PANNELUM_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = PANNELUM_CSS;
      document.head.appendChild(link);
    }

    if (!document.querySelector(`script[src="${PANNELUM_JS}"]`)) {
      const script = document.createElement('script');
      script.src = PANNELUM_JS;
      script.async = true;
      script.crossOrigin = 'anonymous'; // Fix for generic "Script error."
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Pannellum'));
      document.body.appendChild(script);
    } else {
      const check = setInterval(() => {
        if (window.pannellum) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    }
  });
};

interface ViewerProps {
  id: string;
  imageUrl: string;
  mode: 'sphere' | 'cylinder'; // Change our internal name to avoid confusion with Pannellum's type
  onCapture?: (dataUrl: string) => void;
}

export const PanoramaViewer: React.FC<ViewerProps> = ({ id, imageUrl, mode, onCapture }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let viewer: any;
    
    const init = async () => {
      try {
        await loadPannellum();
        if (!containerRef.current) return;

        const config: any = {
            type: 'equirectangular', // Pannellum only supports equirectangular, cubemap, multires
            panorama: imageUrl,
            autoLoad: true,
            showControls: false,
            mouseZoom: true,
            // To simulate cylindrical, we constrain the vertical angle if desired. 
            // Often, users just upload a strip and we let Pannellum auto-detect or map it equirectangularly.
            ...(mode === 'cylinder' ? { haov: 360, vaov: 90, minPitch: -45, maxPitch: 45 } : {})
        };

        if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
            config.crossOrigin = 'anonymous';
        }

        viewer = window.pannellum.viewer(containerRef.current, config);

        viewer.on('error', (err: any) => {
            console.error('Pannellum internal error:', err);
        });

        viewerRef.current = viewer;
        setIsLoaded(true);
      } catch (err) {
        console.error('Panorama init error:', err);
      }
    };

    init();

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [imageUrl, mode]);

  useEffect(() => {
    const handleCapture = (e: any) => {
      if (viewerRef.current && onCapture && e.detail?.nodeId === id) {
        const canvas = viewerRef.current.getRenderer().getCanvas();
        onCapture(canvas.toDataURL('image/png'));
      }
    };

    window.addEventListener('capture-panorama', handleCapture);
    return () => window.removeEventListener('capture-panorama', handleCapture);
  }, [id, onCapture]);

  const stopProp = (e: React.PointerEvent | React.WheelEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-black rounded-lg overflow-hidden relative"
      onPointerDown={stopProp}
      onWheel={stopProp}
    >
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 font-mono animate-pulse">
          LOADING PANORAMA...
        </div>
      )}
    </div>
  );
};

export const Plugin720Viewer: React.FC<{ id: string, imageUrl: string, onCapture?: (dataUrl: string) => void }> = ({ id, imageUrl, onCapture }) => (
  <PanoramaViewer id={id} imageUrl={imageUrl} mode="sphere" onCapture={onCapture} />
);

export const Plugin360Viewer: React.FC<{ id: string, imageUrl: string, onCapture?: (dataUrl: string) => void }> = ({ id, imageUrl, onCapture }) => (
  <PanoramaViewer id={id} imageUrl={imageUrl} mode="cylinder" onCapture={onCapture} />
);

export const extractPanoramaViews = async (imageUrl: string, mode: 'sphere' | 'cylinder', viewsCount: 4 | 6): Promise<{name: string, url: string}[]> => {
  await loadPannellum();
  return new Promise((resolve, reject) => {
      const container = document.createElement('div');
      container.style.width = '1024px';
      container.style.height = '1024px';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      let viewer: any;
      try {
          const config: any = {
              type: 'equirectangular',
              panorama: imageUrl,
              autoLoad: true,
              showControls: false,
              mouseZoom: false,
              ...(mode === 'cylinder' ? { haov: 360, vaov: 90 } : {})
          };
          if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
              config.crossOrigin = 'anonymous';
          }
          viewer = window.pannellum.viewer(container, config);
      } catch (err) {
          document.body.removeChild(container);
          return reject(err);
      }

      viewer.on('load', async () => {
          const views = viewsCount === 6
              ? [ {n: '前', y: 0, p: 0}, {n: '后', y: 180, p: 0}, {n: '左', y: -90, p: 0}, {n: '右', y: 90, p: 0}, {n: '上', y: 0, p: 90}, {n: '下', y: 0, p: -90} ]
              : [ {n: '前', y: 0, p: 0}, {n: '后', y: 180, p: 0}, {n: '左', y: -90, p: 0}, {n: '右', y: 90, p: 0} ];

          const results = [];
          for(const v of views) {
              viewer.setPitch(v.p);
              viewer.setYaw(v.y);
              await new Promise(r => setTimeout(r, 600)); // wait for rendering to update
              const canvas = viewer.getRenderer().getCanvas();
              results.push({ name: v.n, url: canvas.toDataURL('image/png') });
          }

          viewer.destroy();
          document.body.removeChild(container);
          resolve(results);
      });

      viewer.on('error', (err: any) => {
          viewer.destroy();
          document.body.removeChild(container);
          reject(err);
      });
  });
};
