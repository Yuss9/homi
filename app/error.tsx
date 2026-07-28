"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="auth-main" style={{ minHeight: "70svh" }}><div className="auth-card" role="alert"><p className="section-kicker">Something went wrong</p><h1>Homi hit a snag.</h1><p className="auth-subtitle">Your data is safe. Try the request again, or come back in a moment.</p><button className="button button-large" onClick={reset}>Try again</button></div></main>;
}

