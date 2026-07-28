export default function Loading() {
  return <main className="app-main" aria-live="polite" aria-busy="true"><div style={{ height: 35, width: 260, background: "var(--line)", borderRadius: 10, opacity: .65 }} /><div className="dash-grid" style={{ marginTop: 35 }}><div className="dash-card" style={{ minHeight: 260 }} /><div className="dash-card" style={{ minHeight: 260 }} /></div><span className="sr-only">Loading Homi</span></main>;
}

