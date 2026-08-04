import Link from "next/link";
import { Download, ExternalLink, Share, Smartphone } from "lucide-react";
import { PwaInstallPrompt } from "@/src/components/pwa-install-prompt";

export const metadata = {
  title: "Install Homi",
  description: "Install Homi as a connected app on iPhone, iPad or Android.",
};

export default function InstallPage() {
  return (
    <main id="main" className="install-page">
      <nav className="install-nav">
        <Link href="/">⌂ Homi</Link>
        <Link href="/dashboard">Open dashboard</Link>
      </nav>
      <section className="install-hero">
        <span className="install-app-icon large">⌂</span>
        <small>Connected mobile experience</small>
        <h1>Keep Homi one tap away.</h1>
        <p>
          Install Homi on your home screen for a standalone app window,
          shortcuts, notifications, camera scanning and faster access to your
          private household journal.
        </p>
        <PwaInstallPrompt />
        <p className="install-connected-note">
          Homi remains connected to your server. Offline mode is intentionally
          disabled so every change uses current household data.
        </p>
      </section>

      <section className="install-platform-grid">
        <article>
          <span><Share size={24} /></span>
          <h2>iPhone and iPad</h2>
          <ol>
            <li>Open Homi in Safari.</li>
            <li>Tap the Share button.</li>
            <li>Select Add to Home Screen.</li>
            <li>Keep the Homi name and tap Add.</li>
          </ol>
          <p>
            The installed app supports Web Push on compatible iOS versions once
            notifications are enabled in Homi settings.
          </p>
        </article>
        <article>
          <span><Download size={24} /></span>
          <h2>Android</h2>
          <ol>
            <li>Open Homi in Chrome or another compatible browser.</li>
            <li>Use the Install Homi button above or open the browser menu.</li>
            <li>Select Install app.</li>
            <li>Confirm the installation.</li>
          </ol>
          <p>
            Long-press the installed icon to access shortcuts for scanning,
            maintenance, repairs and the calendar.
          </p>
        </article>
      </section>

      <section className="install-features">
        <h2>Available after installation</h2>
        <div>
          {[
            ["Camera scanner", "Scan equipment barcodes and open the matching Homi record."],
            ["Quick actions", "Create maintenance, report a repair or open the calendar."],
            ["Web Push", "Receive household reminders from the connected Homi server."],
            ["Native widgets", "Use the optional companion app for iOS and Android home-screen widgets."],
          ].map(([title, text]) => (
            <article key={title}>
              <Smartphone size={20} />
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="install-footer">
        <Link href="/settings">
          Configure mobile integrations <ExternalLink size={14} />
        </Link>
      </footer>
    </main>
  );
}
