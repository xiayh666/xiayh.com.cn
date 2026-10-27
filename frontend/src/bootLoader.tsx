import { useEffect } from "react";

type BootLoaderState = {
  fadeMs: number;
  minVisibleMs: number;
  readyClass: string;
  showDelayMs: number;
  showTimer?: number;
  shownAt: number;
  visibleClass: string;
};

declare global {
  interface Window {
    __bootLoader?: BootLoaderState;
  }
}

// Mount inside the visible page's Suspense boundary, never next to its fallback.
export function BootReady() {
  useEffect(() => {
    const loader = document.getElementById("boot-loader");
    if (!loader) return;
    const state = window.__bootLoader;
    if (state?.showTimer) window.clearTimeout(state.showTimer);
    const visibleClass = state?.visibleClass ?? "boot-loader-visible";
    const readyClass = state?.readyClass ?? "app-ready";
    const visible = document.documentElement.classList.contains(visibleClass);
    const elapsed = state ? performance.now() - state.shownAt : 0;
    const remaining = visible ? Math.max(0, (state?.minVisibleMs ?? 180) - elapsed) : 0;
    let exitTimer: number;
    let removeTimer: number;
    const frame = requestAnimationFrame(() => {
      exitTimer = window.setTimeout(() => {
        document.documentElement.classList.add(readyClass);
        document.documentElement.classList.remove(visibleClass);
        removeTimer = window.setTimeout(() => {
          loader.remove();
          delete window.__bootLoader;
        }, visible ? (state?.fadeMs ?? 180) + 40 : 0);
      }, remaining);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);
  return null;
}
