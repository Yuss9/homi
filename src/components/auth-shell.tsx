import Link from "next/link";
import { Brand } from "@/src/components/brand";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="auth-page">
      <aside className="auth-aside">
        <Link href="/">
          <Brand />
        </Link>
        <div className="auth-quote">
          <h2>
            The quiet place
            <br />
            for everything home.
          </h2>
          <p>
            Maintenance, warranties, manuals, and the small details that make
            your home easier to care for.
          </p>
        </div>
        <small>Private by default · No advertising trackers</small>
      </aside>
      <section className="auth-main">{children}</section>
    </main>
  );
}
