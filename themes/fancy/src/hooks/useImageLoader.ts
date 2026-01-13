// Progressive image loading with XHR and abort support

import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

interface ImageLoadState {
  src: string | null;
  progress: number;
  loading: boolean;
  error: string | null;
}

interface UseImageLoaderResult extends ImageLoadState {
  load: (url: string) => void;
  abort: () => void;
}

export function useImageLoader(): UseImageLoaderResult {
  const [state, setState] = useState<ImageLoadState>({
    src: null,
    progress: 0,
    loading: false,
    error: null,
  });

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      if (xhrRef.current) {
        xhrRef.current.abort();
      }
    };
  }, []);

  const abort = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  }, []);

  const load = useCallback((url: string) => {
    // Abort any existing download
    abort();

    // Revoke previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    setState({
      src: null,
      progress: 0,
      loading: true,
      error: null,
    });

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setState((s) => ({ ...s, progress: percent }));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const blobUrl = URL.createObjectURL(xhr.response as Blob);
        blobUrlRef.current = blobUrl;
        setState({
          src: blobUrl,
          progress: 100,
          loading: false,
          error: null,
        });
      } else {
        setState({
          src: null,
          progress: 0,
          loading: false,
          error: `Failed to load image: ${xhr.status}`,
        });
      }
      xhrRef.current = null;
    };

    xhr.onerror = () => {
      setState({
        src: null,
        progress: 0,
        loading: false,
        error: 'Network error loading image',
      });
      xhrRef.current = null;
    };

    xhr.onabort = () => {
      setState((s) => ({ ...s, loading: false }));
      xhrRef.current = null;
    };

    xhr.send();
  }, [abort]);

  return { ...state, load, abort };
}

// Simpler hook for preloading images without progress tracking
export function useImagePreload(): (urls: string[]) => void {
  return useCallback((urls: string[]) => {
    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, []);
}
