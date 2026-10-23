"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that caches the app shell so TaskFlow loads
 * offline after the first visit. Registration is skipped in development so
 * the service worker never fights the dev server's hot reload.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Offline support is progressive enhancement; the app works online
        // without it, so registration failures are non-fatal.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
