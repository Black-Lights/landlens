'use client';

import { useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2 } from 'lucide-react';

export type LocateState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'ok'; lat: number; lng: number; accuracy: number }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

type Props = {
  onLocate: (lat: number, lng: number, accuracy: number) => void;
  onError?: (state: LocateState) => void;
};

export function LocateMe({ onLocate, onError }: Props) {
  const [state, setState] = useState<LocateState>({ status: 'idle' });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  function handleClick() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const next: LocateState = { status: 'unavailable', reason: 'Geolocation API not available' };
      setState(next);
      onError?.(next);
      showToast('Location is not supported in this browser');
      return;
    }

    setState({ status: 'requesting' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const next: LocateState = { status: 'ok', lat: latitude, lng: longitude, accuracy };
        setState(next);
        onLocate(latitude, longitude, accuracy);
        if (accuracy > 200) {
          showToast('Location accuracy is low — try moving to open sky');
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          const next: LocateState = { status: 'denied' };
          setState(next);
          onError?.(next);
          showToast('Enable location in your browser settings to use this');
        } else {
          const next: LocateState = { status: 'unavailable', reason: err.message };
          setState(next);
          onError?.(next);
          showToast('Could not get your location — try again');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  const busy = state.status === 'requesting';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label="Find land around me"
        title="Find land around me"
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white shadow-lg ring-1 ring-black/10 transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <Crosshair className="h-5 w-5" aria-hidden />
        )}
      </button>
      {toast && (
        <div
          role="status"
          className="pointer-events-auto absolute bottom-20 left-1/2 z-30 max-w-[85vw] -translate-x-1/2 rounded-md bg-slate-900/90 px-3 py-2 text-center text-xs text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  );
}
