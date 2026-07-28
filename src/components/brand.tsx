export function Brand({ large = false }: { large?: boolean }) {
  return (
    <span className={`brand${large ? " brand-large" : ""}`}>
      <span className="brand-dot" aria-hidden="true" />
      Homi
    </span>
  );
}
