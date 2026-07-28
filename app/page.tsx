import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  FileText,
  House,
  LockKeyhole,
  Package,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { Reveal } from "@/src/components/marketing";
import { SignOutButton } from "@/src/components/sign-out-button";
import { getOptionalSession } from "@/src/server/authorization";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Your home, remembered",
  description:
    "Homi keeps your maintenance, warranties, manuals, repairs, and household documents organized and private.",
  alternates: { canonical: "/" },
};

const benefits = [
  {
    number: "01",
    title: "Remember what matters",
    body: "Every repair, model number, receipt, and useful note stays connected to the room or object it belongs to.",
  },
  {
    number: "02",
    title: "Stay gently ahead",
    body: "Thoughtful reminders surface maintenance when it is useful—before a small job becomes an expensive one.",
  },
  {
    number: "03",
    title: "Share without losing control",
    body: "Give the right people access while private files and sensitive actions remain carefully protected.",
  },
];

const faq = [
  [
    "Is my home information private?",
    "Yes. Homi is private by default. Files require an authorized session, and no advertising trackers are included.",
  ],
  [
    "Can I share Homi with my household?",
    "Yes. Invite family or housemates as an admin, member, or read-only viewer. Every action is checked on the server.",
  ],
  [
    "Can I manage more than one home?",
    "Yes. Keep separate journals for your main home, a holiday place, or a property you help look after.",
  ],
  [
    "What can I upload?",
    "Homi accepts PDF, JPEG, PNG, and WebP files up to 10 MB by default. The limit is configurable for self-hosting.",
  ],
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Homi",
      url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@homi.local",
    },
    {
      "@type": "SoftwareApplication",
      name: "Homi",
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      description: "A private home maintenance journal.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
    {
      "@type": "FAQPage",
      mainEntity: faq.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

function Wordmark({
  light = false,
  connected = false,
}: {
  light?: boolean;
  connected?: boolean;
}) {
  return (
    <span className={`${styles.wordmark} ${light ? styles.wordmarkLight : ""}`}>
      <span
        className={`${styles.wordmarkDot} ${connected ? styles.wordmarkConnected : ""}`}
        aria-hidden="true"
      />
      Homi
      {connected && <span className="sr-only"> — Connected</span>}
    </span>
  );
}

function HomeJournal() {
  const entries = [
    {
      date: "Today",
      icon: Check,
      title: "The house is all caught up",
      note: "Nothing urgent needs your attention.",
    },
    {
      date: "In 5 days",
      icon: Wrench,
      title: "Check boiler pressure",
      note: "Utility room · About 5 minutes",
    },
    {
      date: "18 Sep",
      icon: ShieldCheck,
      title: "Dishwasher warranty",
      note: "Miele G 7150 · Covered until 2027",
    },
  ];

  return (
    <Reveal className={styles.journal} delay={0.12}>
      <div className={styles.journalTop}>
        <div>
          <span className={styles.microLabel}>Cedar House</span>
          <p>Home journal · Since 2022</p>
        </div>
        <span className={styles.liveStatus}>
          <i />
          All is well
        </span>
      </div>
      <div className={styles.journalIntro}>
        <span>Monday, 24 August</span>
        <h2>
          A quiet week
          <br />
          at home.
        </h2>
      </div>
      <div className={styles.timeline}>
        {entries.map(({ date, icon: Icon, title, note }, index) => (
          <div className={styles.timelineEntry} key={title}>
            <time>{date}</time>
            <span className={styles.timelineMarker}>
              <Icon size={16} strokeWidth={1.7} />
            </span>
            <div>
              <strong>{title}</strong>
              <small>{note}</small>
            </div>
            <span className={styles.entryNumber}>0{index + 1}</span>
          </div>
        ))}
      </div>
      <div className={styles.journalFoot}>
        <span>24 objects</span>
        <span>8 rooms</span>
        <span>12 private documents</span>
      </div>
    </Reveal>
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
            <Link href="/features">Features</Link>
            <Link href="/how-it-works">How it works</Link>
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
          <Reveal className={styles.heroCopy}>
            <p className={styles.eyebrow}>A private memory for your home</p>
            <h1>Your home, remembered.</h1>
            <p className={styles.heroLede}>
              A calm place for the repairs, documents, objects, and small
              details that make a home easier to care for.
            </p>
            <div className={styles.heroActions}>
              <Link
                className={styles.primaryButton}
                href={session ? accountHref : "/sign-up"}
              >
                {session ? accountLabel : "Start your journal"}
                <ArrowRight size={17} />
              </Link>
              <Link className={styles.quietLink} href="#journal">
                Discover Homi
              </Link>
            </div>
          </Reveal>
          <HomeJournal />
        </section>

        <section className={styles.promiseStrip} aria-label="Product promises">
          <span>Private by default</span>
          <span>No advertising trackers</span>
          <span>Your data stays yours</span>
        </section>

        <section className={styles.introSection} id="journal">
          <Reveal className={styles.introHeading}>
            <p className={styles.eyebrow}>Made for real homes</p>
            <h2>A home has a long memory.</h2>
          </Reveal>
          <Reveal className={styles.introText} delay={0.08}>
            <p>
              Receipts hide in drawers. Manuals disappear into inboxes. The date
              of the last filter change lives in someone&apos;s head.
            </p>
            <p>
              Homi gives that everyday knowledge a permanent, orderly
              place—without turning your home into another project to manage.
            </p>
          </Reveal>
        </section>

        <section className={styles.benefits}>
          {benefits.map(({ number, title, body }, index) => (
            <Reveal className={styles.benefit} delay={index * 0.08} key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </Reveal>
          ))}
        </section>

        <section className={styles.archiveSection}>
          <Reveal className={styles.archiveCopy}>
            <p className={styles.eyebrow}>A place for everything</p>
            <h2>
              Organised like your home,
              <br />
              not like a database.
            </h2>
            <p>
              Move naturally from rooms to objects, then find every document,
              maintenance note, and repair exactly where you expect it.
            </p>
            <Link className={styles.inlineLink} href="/features">
              Explore the home journal
              <ArrowRight size={16} />
            </Link>
          </Reveal>
          <Reveal className={styles.roomIndex} delay={0.08}>
            {[
              ["01", "Kitchen", "6 objects · 4 documents", Package],
              ["02", "Living room", "5 objects · 2 documents", House],
              ["03", "Utility", "4 objects · 5 documents", Wrench],
              ["04", "Whole home", "8 recurring tasks", CalendarDays],
            ].map(([number, room, detail, icon]) => {
              const Icon = icon;
              return (
                <div className={styles.roomRow} key={room as string}>
                  <span>{number as string}</span>
                  <Icon size={18} strokeWidth={1.55} />
                  <strong>{room as string}</strong>
                  <small>{detail as string}</small>
                  <ArrowRight size={17} />
                </div>
              );
            })}
          </Reveal>
        </section>

        <section className={styles.rhythmSection}>
          <div className={styles.rhythmInner}>
            <Reveal className={styles.rhythmHeader}>
              <p className={styles.eyebrow}>A gentler rhythm</p>
              <h2>
                What needs doing.
                <br />
                Nothing more.
              </h2>
            </Reveal>
            <Reveal className={styles.schedule} delay={0.08}>
              {[
                ["24", "Mon", "Water the olive tree", "Living room · 10 min"],
                ["27", "Thu", "Check boiler pressure", "Utility · 5 min"],
                ["29", "Sat", "Clean extractor filter", "Kitchen · 20 min"],
              ].map(([day, weekday, task, detail], index) => (
                <div className={styles.scheduleRow} key={task}>
                  <time>
                    <span>{weekday}</span>
                    {day}
                  </time>
                  <i className={index === 0 ? styles.done : ""} />
                  <div>
                    <strong>{task}</strong>
                    <small>{detail}</small>
                  </div>
                  <span>{index === 0 ? "Done" : "Upcoming"}</span>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section className={styles.privacySection}>
          <div className={styles.privacyInner}>
            <Reveal className={styles.privacyCopy}>
              <LockKeyhole size={29} strokeWidth={1.45} />
              <p className={styles.eyebrow}>
                Privacy is part of the foundation
              </p>
              <h2>
                Your home is personal.
                <br />
                Homi treats it that way.
              </h2>
              <p>
                Files are never exposed through public links. Permissions are
                enforced on the server, sensitive actions are audited, and there
                are no third-party advertising trackers.
              </p>
              <Link className={styles.lightButton} href="/privacy">
                Read our privacy approach
                <ArrowRight size={16} />
              </Link>
            </Reveal>
            <Reveal className={styles.privacyList} delay={0.08}>
              <div>
                <ShieldCheck />
                <span>
                  <strong>Private by default</strong>
                  Every file download is authorized.
                </span>
              </div>
              <div>
                <Users />
                <span>
                  <strong>Precise household roles</strong>
                  Owner, admin, member, and viewer.
                </span>
              </div>
              <div>
                <FileText />
                <span>
                  <strong>A trustworthy record</strong>
                  Important actions leave an audit trail.
                </span>
              </div>
            </Reveal>
          </div>
        </section>

        <section className={styles.quoteSection}>
          <Reveal>
            <p className={styles.quoteLabel}>
              Illustrative story · demo content
            </p>
            <blockquote>
              “I finally know where the boiler warranty is—and when the annual
              service is due.”
            </blockquote>
            <span>Maya · homeowner</span>
          </Reveal>
        </section>

        <section className={styles.faqSection}>
          <Reveal className={styles.faqHeading}>
            <p className={styles.eyebrow}>Good to know</p>
            <h2>
              A clear place
              <br />
              from the start.
            </h2>
          </Reveal>
          <div className={styles.faqList}>
            {faq.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span>+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.finalCta}>
          <Reveal>
            <Wordmark light connected={Boolean(session)} />
            <h2>
              A well-kept home
              <br />
              starts with remembering.
            </h2>
            <p>Give every detail of your home a calm, private place.</p>
            <Link
              className={styles.lightButton}
              href={session ? accountHref : "/sign-up"}
            >
              {session ? accountLabel : "Start your home journal"}
              <ArrowRight size={17} />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div>
            <Wordmark connected={Boolean(session)} />
            <p>Your home, remembered.</p>
          </div>
          <nav aria-label="Product links">
            <strong>Product</strong>
            <Link href="/features">Features</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href={session ? accountHref : "/sign-up"}>
              {session ? accountLabel : "Create account"}
            </Link>
          </nav>
          <nav aria-label="Company links">
            <strong>Company</strong>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/contact">Contact</Link>
          </nav>
          <div className={styles.footerNote}>
            <strong>Built with care</strong>
            <p>
              No ads. No trackers.
              <br />
              Your data stays yours.
            </p>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} Homi</span>
          <span>Made for homes that are lived in.</span>
        </div>
      </footer>
    </div>
  );
}
