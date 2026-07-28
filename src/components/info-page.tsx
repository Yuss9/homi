import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Brand } from "@/src/components/brand";
import { SignOutButton } from "@/src/components/sign-out-button";
import { getOptionalSession } from "@/src/server/authorization";
import type { ReactNode } from "react";

export async function InfoPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  const session = await getOptionalSession();
  const verified = Boolean(session?.user.emailVerified);
  const accountHref = verified ? "/dashboard" : "/verify-email";

  return (
    <div className="marketing-page">
      <header className="site-header">
        <div className="nav-wrap">
          <Link href="/">
            <Brand connected={Boolean(session)} />
          </Link>
          <div className="nav-actions">
            {session ? (
              <>
                <SignOutButton className="text-link session-sign-out" />
                <Link className="button button-small" href={accountHref}>
                  {verified ? "Open dashboard" : "Verify email"}{" "}
                  <ArrowRight size={15} />
                </Link>
              </>
            ) : (
              <>
                <Link className="text-link" href="/sign-in">
                  Sign in
                </Link>
                <Link className="button button-small" href="/sign-up">
                  Start your journal <ArrowRight size={15} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main">
        <section
          className="section-shell"
          style={{ paddingBlock: "110px 70px", maxWidth: 860 }}
        >
          <Link className="inline-link" href="/">
            <ArrowLeft size={15} /> Back to Homi
          </Link>
          <p className="section-kicker" style={{ marginTop: 60 }}>
            {eyebrow}
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(44px,7vw,76px)",
              lineHeight: 1,
              letterSpacing: "-4px",
              fontWeight: 620,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: "28px 0 0",
              color: "var(--ink-soft)",
              fontSize: 19,
              lineHeight: 1.7,
              maxWidth: 720,
            }}
          >
            {intro}
          </p>
        </section>
        <article
          className="section-shell"
          style={{
            maxWidth: 860,
            paddingBottom: 120,
            color: "var(--ink-soft)",
            lineHeight: 1.75,
            fontSize: 15,
          }}
        >
          {children}
        </article>
      </main>
    </div>
  );
}
