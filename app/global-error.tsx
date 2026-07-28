"use client";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main style={{ minHeight:"100vh",display:"grid",placeItems:"center",fontFamily:"system-ui",padding:24 }}><div><h1>Homi is temporarily unavailable.</h1><p>Please try again. No changes were lost.</p><button onClick={reset}>Try again</button></div></main></body></html>;
}

