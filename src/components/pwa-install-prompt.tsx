"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, MoreVertical, Share, Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function standalone() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PwaInstallPrompt({ compact = false }: { compact?: boolean }) {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(standalone);
  const [isIos] = useState(
    () =>
      typeof navigator !== "undefined" &&
      /iphone|ipad|ipod/i.test(navigator.userAgent),
  );

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) {
      setOpen(true);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  }

  if (installed) {
    return compact ? null : (
      <div className="install-state">
        <Smartphone size={18} />
        <div>
          <strong>Homi is installed</strong>
          <small>Open it from your home screen or app launcher.</small>
        </div>
      </div>
    );
  }

  return (
    <>
      {compact ? (
        <button
          className="icon-button"
          type="button"
          aria-label="Install Homi"
          onClick={() => void install()}
        >
          <Download size={18} />
        </button>
      ) : (
        <button className="button" type="button" onClick={() => void install()}>
          <Download size={16} />
          Install Homi
        </button>
      )}

      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="install-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-homi-title"
          >
            <button
              className="icon-action install-close"
              aria-label="Close installation guide"
              type="button"
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </button>
            <span className="install-app-icon">⌂</span>
            <h2 id="install-homi-title">Install Homi on this device</h2>
            <p>
              Homi opens in a standalone app window and stays connected to your
              private server. No offline copy of household data is created.
            </p>
            {isIos ? (
              <ol className="install-steps">
                <li>
                  <span>
                    <Share size={18} />
                  </span>
                  Tap <strong>Share</strong> in Safari.
                </li>
                <li>
                  <span>＋</span>
                  Choose <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  <span>✓</span>
                  Confirm with <strong>Add</strong>.
                </li>
              </ol>
            ) : (
              <ol className="install-steps">
                <li>
                  <span>
                    <MoreVertical size={18} />
                  </span>
                  Open the browser menu.
                </li>
                <li>
                  <span>
                    <Download size={18} />
                  </span>
                  Choose <strong>Install app</strong> or{" "}
                  <strong>Add to Home screen</strong>.
                </li>
                <li>
                  <span>✓</span>
                  Confirm the installation.
                </li>
              </ol>
            )}
            <Link className="button button-secondary" href="/install">
              Open the complete guide
            </Link>
          </section>
        </div>
      )}
    </>
  );
}
