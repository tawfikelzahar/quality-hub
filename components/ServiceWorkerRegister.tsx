"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js once, on the client, after mount.
 * The service worker itself does no caching (see sw.js) — it exists only
 * so the browser considers the site installable as a PWA / TWA.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
