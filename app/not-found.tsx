import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/src/components/brand";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      id="main"
      className="auth-main"
      style={{ minHeight: "100svh", textAlign: "center" }}
    >
      <div className="auth-card">
        <span style={{ display: "inline-flex", marginBottom: 25 }}>
          <Brand large />
        </span>
        <p className="section-kicker">404</p>
        <h1>This page isn’t home.</h1>
        <p className="auth-subtitle">
          The address may have changed, or you may not have access to this
          private record.
        </p>
        <Link className="button button-large" href="/">
          <ArrowLeft size={17} /> Back to Homi
        </Link>
      </div>
    </main>
  );
}
