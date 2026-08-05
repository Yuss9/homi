import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Camera,
  Check,
  FileText,
  House,
  Link2,
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
import styles from "./home-vibrant.module.css";

export const metadata: Metadata = {
  title: "Care for your home, effortlessly",
  description:
    "Homi brings maintenance, warranties, manuals, repairs, equipment and household documents into one calm private home journal.",
  alternates: { canonical: "/" },
};

const railFeatures = [
  { icon: CalendarDays, title: "Maintenance", body: "Recurring care without the project-board noise." },
  { icon: Wrench, title: "Repairs", body: "Issues, costs and history in one clear record." },
  { icon: FileText, title: "Documents", body: "Manuals, receipts and certificates where they belong." },
  { icon: ShieldCheck, title: "Warranties", body: "Coverage dates that remain easy to find." },
  { icon: Bell, title: "Reminders", body: "Useful prompts before small work becomes a problem." },
  { icon: QrCode, title: "QR scanning", body: "Open the right equipment record while beside it." },
  { icon: Link2, title: "Integrations", body: "Home Assistant, calendars, widgets and scoped APIs." },
  { icon: Users, title: "Household", body: "Share the memory without sharing every permission." },
];

const features = [
  {
    icon: CalendarDays,
    title: "Maintenance that stays calm",
    body: "Recurring care, checklists, seasonal rules and a clear calendar that make the next job obvious without making the home feel like another workplace.",
  },
  {
    icon: Package,
    title: "Every object keeps its story",
    body: "Model numbers, QR labels, warranties, repairs, replacement history and useful notes stay attached to the right equipment.",
  },
  {
    icon: FileText,
    title: "Documents live with the work",
    body: "Invoices, manuals, photos and certificates remain private and connected to the room, maintenance task or repair they explain.",
  },
  {
    icon: Camera,
    title: "Built for the phone in your hand",
    body: "Install the PWA, capture an equipment label, attach a photo and open a record while standing exactly where the work happens.",
  },
  {
    icon: Users,
    title: "A shared household memory",
    body: "Family, housemates and trusted helpers can contribute with the right role while sensitive actions remain protected on the server.",
  },
  {
    icon: Link2,
    title: "Connected to the real home",
    body: "Home Assistant, private calendars, widgets, MQTT and scoped APIs let Homi surface useful context beyond the browser.",
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
    // Pexels photography is deliberately rendered as an ordinary image. The
    // host is explicitly allowed by the production CSP and credited below.
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
                <SignOutButton className={`${styles.signIn} ${styles.sessionButton}`} />
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
          <div className={styles.heroCopy} data-reveal>
            <p className={styles.eyebrow}>A private operating system for the home</p>
            <h1>
              Care for your home,
              <span>effortlessly.</span>
            </h1>
            <p className={styles.heroLede}>
              Homi turns maintenance, equipment, documents and household know-how
              into one clear memory—so the home stays cared for without feeling
              like another job.
            </p>
            <div className={styles.heroActions}>
              <Link
                className={styles.primaryButton}
                href={session ? accountHref : "/sign-up"}
              >
                {session ? accountLabel : "Start your home journal"}
                <ArrowRight size={17} />
              </Link>
              <Link className={styles.secondaryButton} href="#features">
                Explore Homi
                <Sparkles size={16} />
              </Link>
            </div>
            <div className={styles.trustLine} aria-label="Built for real households">
              <div className={styles.trustAvatars} aria-hidden="true">
                <span>AM</span><span>JL</span><span>SK</span>
              </div>
              <span>Private by default · designed for real households</span>
            </div>
          </div>

          <div className={styles.heroVisual} data-reveal>
            <EditorialImage
              loading="eager"
              src="https://images.pexels.com/photos/7512985/pexels-photo-7512985.jpeg?auto=compress&cs=tinysrgb&w=1800"
              alt="A person taking care of a bright contemporary kitchen"
            />

            <div className={styles.floatCard}>
              <small>Coming up · 3</small>
              <h2>The week is under control.</h2>
              <div className={styles.floatTask}>
                <span><Wrench size={15} /></span>
                <div><strong>Change HVAC filter</strong><small>Due in 7 days</small></div>
              </div>
              <div className={styles.floatTask}>
                <span><ShieldCheck size={15} /></span>
                <div><strong>Check smoke alarms</strong><small>Due in 18 days</small></div>
              </div>
            </div>

            <div className={styles.healthCard}>
              <small>Home health</small>
              <strong>94</strong>
              <div className={styles.healthLine} aria-hidden="true" />
              <small>Everything important is on track.</small>
            </div>

            <div className={styles.scanCard}>
              <small>Scan to open</small>
              <div className={styles.scanCode} aria-hidden="true">
                {Array.from({ length: 25 }, (_, index) => <i key={index} />)}
              </div>
              <small>Equipment, files and history</small>
            </div>

            <div className={styles.integrationCard}>
              <span><House size={16} /></span>
              <div><strong>Home Assistant</strong><small>Connected</small></div>
            </div>
          </div>
        </section>

        <section className={styles.featureRail} aria-label="Homi capabilities" data-reveal>
          {railFeatures.map(({ icon: Icon, title, body }) => (
            <article className={styles.railItem} key={title}>
              <span className={styles.railIcon}><Icon size={19} strokeWidth={1.7} /></span>
              <strong>{title}</strong>
              <small>{body}</small>
            </article>
          ))}
        </section>

        <section className={styles.story}>
          <div className={styles.storyCopy} data-reveal>
            <p className={styles.eyebrow}>The home is more than an address</p>
            <h2>A living record of everyday care.</h2>
            <p>
              Receipts disappear into drawers. A filter is changed but nobody
              remembers when. Homi brings those scattered details together so the
              people who live there can understand what happened and what comes next.
            </p>
          </div>
          <div className={styles.storyMedia} data-reveal>
            <figure className={styles.storyHouse}>
              <EditorialImage
                src="https://images.pexels.com/photos/7587880/pexels-photo-7587880.jpeg?auto=compress&cs=tinysrgb&w=1700"
                alt="A minimalist modern house with a green garden"
              />
            </figure>
            <figure className={styles.storyChore}>
              <EditorialImage
                src="https://images.pexels.com/photos/5591909/pexels-photo-5591909.jpeg?auto=compress&cs=tinysrgb&w=900"
                alt="Hands cleaning a kitchen counter as part of everyday home care"
              />
            </figure>
            <div className={styles.storyBadge}>
              <strong>One home, one memory</strong>
              <small>Care, files and decisions remain connected.</small>
            </div>
          </div>
        </section>

        <section className={styles.featureSection} id="features">
          <div className={styles.sectionHead} data-reveal>
            <p className={styles.eyebrow}>One product, the whole home</p>
            <h2>Useful before, during and after something needs attention.</h2>
          </div>
          <div className={styles.featureGrid}>
            {features.map(({ icon: Icon, title, body }) => (
              <article className={styles.featureCard} key={title} data-reveal>
                <span><Icon size={21} strokeWidth={1.7} /></span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.everyday} id="everyday">
          <figure className={styles.everydayPhoto} data-reveal>
            <EditorialImage
              src="https://images.pexels.com/photos/8082205/pexels-photo-8082205.jpeg?auto=compress&cs=tinysrgb&w=1600"
              alt="A calm modern living space filled with natural light"
            />
            <div className={styles.phoneCard}>
              <div className={styles.phoneCardHead}>
                <strong>Today at Cedar House</strong>
                <span>Home health 94</span>
              </div>
              <div className={styles.phoneTask}>
                <span><Camera size={16} /></span>
                <div><strong>Quick scan</strong><small>Open a product or document</small></div>
                <time>Now</time>
              </div>
              <div className={styles.phoneTask}>
                <span><Check size={16} /></span>
                <div><strong>Boiler pressure checked</strong><small>Utility room · completed</small></div>
                <time>10:42</time>
              </div>
            </div>
          </figure>

          <div className={styles.everydayCopy} data-reveal>
            <p className={styles.eyebrow}>Designed around the moment</p>
            <h2>Open Homi where the work happens.</h2>
            <p>
              Scan a label in the kitchen, attach the invoice after a repair,
              check the list from the sofa or let Home Assistant surface what
              matters. The product follows the home instead of asking the home to
              follow the product.
            </p>
            <div className={styles.everydayList}>
              <div>
                <span><Camera size={18} /></span>
                <span><strong>At the equipment</strong><small>Camera capture, QR labels and exact records.</small></span>
              </div>
              <div>
                <span><Check size={18} /></span>
                <span><strong>While the work is fresh</strong><small>Checklists, photos, costs and completion history.</small></span>
              </div>
              <div>
                <span><Sparkles size={18} /></span>
                <span><strong>Before the next problem</strong><small>Gentle reminders, budgets and replacement forecasts.</small></span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.privacy}>
          <div className={styles.privacyCopy} data-reveal>
            <p className={styles.eyebrow}>Privacy belongs in the architecture</p>
            <h2>Your data. Your home. Your choice.</h2>
            <p>
              Private files are authorized on every request, household roles are
              enforced on the server and self-hosting keeps the database, files and
              backups under your control.
            </p>
          </div>
          <div className={styles.privacyGrid}>
            <article className={styles.privacyPoint} data-reveal>
              <LockKeyhole size={22} />
              <strong>Private file storage</strong>
              <small>No public document URLs and no advertising trackers.</small>
            </article>
            <article className={styles.privacyPoint} data-reveal>
              <ShieldCheck size={22} />
              <strong>Protected boundaries</strong>
              <small>Every home and role is checked server-side.</small>
            </article>
            <article className={styles.privacyPoint} data-reveal>
              <House size={22} />
              <strong>Self-hosted ownership</strong>
              <small>Your instance and backups remain yours.</small>
            </article>
            <article className={styles.privacyPoint} data-reveal>
              <Users size={22} />
              <strong>Purposeful collaboration</strong>
              <small>Share only the access each person actually needs.</small>
            </article>
          </div>
        </section>

        <section className={styles.finalCta}>
          <div data-reveal>
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
            href="https://www.pexels.com/?utm_source=homi&utm_medium=referral"
            target="_blank"
            rel="noreferrer"
          >
            Photography · Pexels
          </a>
        </nav>
      </footer>
    </div>
  );
}
