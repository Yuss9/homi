"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const revealSelector = [
  "[data-reveal]",
  ".app-main > .dashboard-head",
  ".app-main > .dash-status",
  ".app-main > .personalized-dashboard > *",
  ".app-main > .dash-grid > *",
  ".app-main > .resource-list-card",
  ".dash-card",
  ".template-card",
  ".operations-guide-step",
  ".operations-tabs .button",
  ".operations-item",
  ".document-row",
  ".cost-summary-card",
].join(",");

function revealImmediately(elements: HTMLElement[]) {
  for (const element of elements) element.classList.add("is-revealed");
}

export function MotionRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const root = document.documentElement;
    const observed = new Set<HTMLElement>();
    let frame = 0;

    const collect = () =>
      Array.from(document.querySelectorAll<HTMLElement>(revealSelector)).filter(
        (element) => !observed.has(element),
      );

    if (reducedMotion || !("IntersectionObserver" in window)) {
      revealImmediately(collect());
      return;
    }

    root.classList.add("motion-enabled");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.classList.add("is-revealed");
          observer.unobserve(element);
        }
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 },
    );

    const register = () => {
      const elements = collect();
      for (const [index, element] of elements.entries()) {
        observed.add(element);
        element.classList.add("homi-reveal");
        element.style.setProperty("--reveal-order", String(index % 8));
        observer.observe(element);
      }
    };

    register();
    const mutations = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(register);
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      observer.disconnect();
      root.classList.remove("motion-enabled");
    };
  }, [pathname]);

  return null;
}
