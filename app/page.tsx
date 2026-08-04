import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  FileText,
  House,
  LockKeyhole,
  Package,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { SignOutButton } from "@/src/components/sign-out-button";
import { getOptionalSession } from "@/src/server/authorization";
import styles from "./home-refresh.module.css";

export const metadata: Metadata = {
  title: "Your home, remembered",
  description:
    "Homi keeps maintenance, warranties, manuals, repairs, equipment and household documents organized in one private home journal.",
  alternates: { canonical: "/" },
};

const features = [
  {
    icon: CalendarDays,
    title: "Maintenance that stays calm",
    body: "Recurring care, checklists, reminders and a clear calendar without turning your home into another project board.",
  },
  {
    icon: Package,
    title: "Every object has a story",
    body: "Keep model numbers, warranties, repairs, replacement history and useful notes attached to the right equipment.",
  },
  {
    icon: FileText,
    title: "Documents where they belong",
    body: "Invoices, manuals, photos and certificates remain private and connected to the room, task or repair they explain.",
  },
  {
    icon: Camera,
    title: "Made for the phone in your hand",
    body: "Install the PWA, scan a label, capture a document and open the exact equipment record while standing beside it.",
  },
  {
    icon: Users,
    title: "A shared household memory",
    body: "Give family, housemates or trusted helpers the right role while sensitive actions remain protected on the server.",
  },
  {
    icon: QrCode,
    title: "Connected to the real home",
    body: "QR labels, Home Assistant, widgets, private calendars and scoped APIs make Homi useful beyond the browser.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Homi",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web, iOS, Android",
  description: "A private home maintenance and household memory journal.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
};

function Wordmark({ connected = false }: { connected?: boolean }) {
  return (
    <span className={styles.wordmark}>
      <span
        className={`${styles.wordmarkDot} ${connected ? styles.wordmarkConnected : ""}`}
        aria-hidden="true"
      />
      Homi
      {connected && <span className="sr-only"> — Connected</span>}
    </span>
  );
}

function EditorialImage({
  src,
  alt,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  loading?: "eager" | "lazy";
}) {
  return (
    // These editorial photos intentionally remain ordinary images so the
    // public page does not require a Next.js remote-image allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

export default async function MarketingHome() {
  const session = await getOptionalSession();
  const verified = Boolean(session?.user.emailVerified);
  const accountHref = verified ? "/dashboard" : "/verify-email";
  const accountLabel = verified ? "Open dashboard" : "Verify email";

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className={styles.header}>
        <div className={styles.nav}>
          <Link href="/" aria-label="Homi home">
            <Wordmark connected={Boolean(session)} />
          </Link>
          <nav className={styles.navLinks} aria-label="Primary navigation">
            <Link href="#features">Features</Link>
            <Link href="#everyday">Everyday use</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
          <div className={styles.navActions}>
            {session ? (
              <>
                <SignOutButton
                  className={`${styles.signIn} ${styles.sessionButton}`}
                />
                <Link className={styles.smallButton} href={accountHref}>
                  {accountLabel}
                  <ArrowRight size={15} />
                </Link>
              </>
            ) : (
              <>
                <Link className={styles.signIn} href="/sign-in">
                  Sign in
                </Link>
                <Link className={styles.smallButton} href="/sign-up">
                  Create account
                  <ArrowRight size={15} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>A private memory for your home</p>
            <h1>Your home, remembered.</h1>
            <p className={styles.heroLede}>
              Homi gives maintenance, equipment, documents and household know-how
              one calm place—so caring for a home feels lighter, not busier.
            </p>
            <div className={styles.heroActions}>
              <Link
                className={styles.primaryButton}
                href={session ? accountHref : "/sign-up"}
              >
                {session ? accountLabel : "Start your journal"}
                <ArrowRight size={17} />
              </Link>
              <Link className={styles.quietLink} href="#features">
                See what Homi remembers
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className={styles.heroVisual} aria-label="A modern home and Homi preview">
            <figure className={styles.heroHouse}>
              <EditorialImage
                loading="eager"
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=86"
                alt="A warm modern house surrounded by trees"
              />
            </figure>
            <figure className={styles.heroPeople}>
              <EditorialImage
                loading="eager"
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=700&q=84"
                alt="Friends sharing a relaxed moment together"
              />
            </figure>
            <div className={styles.productFloat}>
              <div className={styles.floatTop}>
                <span>Cedar House · Today</span>
                <strong>Home health 94</strong>
              </div>
              <h2>Everything is in order.</h2>
              <p>One small maintenance task is coming up this week.</p>
              <div className={styles.floatTask}>
                <span>
                  <Wrench size={16} />
                </span>
                <div>
                  <strong>Check boiler pressure</strong>
                  <small>Utility room · about 5 minutes</small>
                </div>
                <time>Thu</time>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.promiseStrip} aria-label="Homi promises">
          <span>Private by default</span>
          <span>Designed for real households</span>
          <span>Self-hosted and yours</span>
        </section>

        <section className={styles.story}>
          <div>
            <p className={styles.eyebrow}>The home is more than an address</p>
            <h2>A living record of everyday care.</h2>
          </div>
          <div className={styles.storyCopy}>
            <p>
              Receipts disappear into drawers. A filter is changed but nobody
              remembers when. The person who knows the boiler leaves for the
              weekend exactly when it starts making a noise.
            </p>
            <p>
              Homi turns those scattered details into a clear history shared by
              the people who live there—without adding noise to daily life.
            </p>
          </div>
        </section>

        <section className={styles.features} id="features">
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>One product, the whole home</p>
            <h2>Useful before, during and after something needs attention.</h2>
          </div>
          <div className={styles.featureGrid}>
            {features.map(({ icon: Icon, title, body }) => (
              <article className={styles.featureCard} key={title}>
                <span>
                  <Icon size={20} strokeWidth={1.7} />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.life} id="everyday">
          <figure className={styles.lifeImage}>
            <EditorialImage
              src="https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1500&q=86"
              alt="A calm, light-filled modern home interior"
            />
          </figure>
          <div className={styles.lifeCopy}>
            <p className={styles.eyebrow}>Designed around the moment</p>
            <h2>Open Homi where the work happens.</h2>
            <p>
              Scan the appliance label in the kitchen, attach the invoice after a
              repair, check the maintenance list from the sofa or let Home
              Assistant surface what matters. The product follows the home.
            </p>
            <div className={styles.lifeList}>
              <div>
                <Camera size={20} />
                <span>
                  <strong>At the equipment</strong>
                  <small>Camera scan, QR labels and quick actions.</small>
                </span>
              </div>
              <div>
                <Check size={20} />
                <span>
                  <strong>While the work is fresh</strong>
                  <small>Checklists, photos, costs and completion history.</small>
                </span>
              </div>
              <div>
                <Sparkles size={20} />
                <span>
                  <strong>Before the next problem</strong>
                  <small>Gentle reminders, budgets and replacement forecasts.</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.privacy}>
          <div className={styles.privacyCopy}>
            <p className={styles.eyebrow}>Privacy belongs in the architecture</p>
            <h2>Your home is personal. Homi treats it that way.</h2>
            <p>
              Private files are authorized on every request, household roles are
              enforced on the server and Homi contains no advertising trackers,
              payment profiling or hidden analytics.
            </p>
          </div>
          <div className={styles.privacyPoints}>
            <div>
              <LockKeyhole size={22} />
              <span>
                <strong>Private file storage</strong>
                <small>No public document URLs.</small>
              </span>
            </div>
            <div>
              <ShieldCheck size={22} />
              <span>
                <strong>Protected household boundaries</strong>
                <small>Every home and role is checked server-side.</small>
              </span>
            </div>
            <div>
              <House size={22} />
              <span>
                <strong>Self-hosted ownership</strong>
                <small>Your database, files and backups remain yours.</small>
              </span>
            </div>
          </div>
        </section>

        <section className={styles.finalCta}>
          <div>
            <p className={styles.eyebrow}>A calmer way to care for home</p>
            <h2>Remember once. Find it whenever the house needs it.</h2>
            <p>
              Give the details, documents and routines of your home one private
              place that the whole household can understand.
            </p>
            <Link
              className={styles.primaryButton}
              href={session ? accountHref : "/sign-up"}
            >
              {session ? accountLabel : "Start your home journal"}
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <Wordmark connected={Boolean(session)} />
          <span> · Your home, remembered.</span>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/features">Features</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a
            className={styles.photoCredit}
            href="https://unsplash.com/?utm_source=homi&utm_medium=referral"
            target="_blank"
            rel="noreferrer"
          >
            Photography · Unsplash
          </a>
        </nav>
      </footer>
    </div>
  );
}
