"use client";

import { useEffect } from "react";

export function PwaRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);
  return null;
}
