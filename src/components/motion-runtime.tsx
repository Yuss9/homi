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

export function MotionRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (
      reducedMotion ||
      !("IntersectionObserver" in window) ||
      !("animate" in HTMLElement.prototype)
    ) {
      return;
    }

    const observed = new WeakSet<HTMLElement>();
    const revealOrder = new WeakMap<HTMLElement, number>();
    let frame = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.animate(
            [
              {
                opacity: 0,
                transform: "translate3d(0, 14px, 0)",
              },
              {
                opacity: 1,
                transform: "translate3d(0, 0, 0)",
              },
            ],
            {
              duration: 520,
              delay: ((revealOrder.get(element) ?? 0) % 8) * 28,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              // Only preserve the opening keyframe during the short delay.
              // Once complete, CSS owns transform and opacity again so hover,
              // focus and route updates cannot fight a persistent animation.
              fill: "backwards",
            },
          );
          observer.unobserve(element);
        }
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 },
    );

    const register = () => {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(revealSelector),
      ).filter((element) => !observed.has(element));

      for (const [index, element] of elements.entries()) {
        observed.add(element);
        revealOrder.set(element, index);
        observer.observe(element);
      }
    };

    // Let the current React tree finish hydrating before observing it. The Web
    // Animations API changes presentation without changing reconciled classes,
    // attributes or inline styles, so route transitions stay hydration-safe.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(register);
    });

    const mutations = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(register);
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
