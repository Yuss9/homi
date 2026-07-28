export function Brand({
  large = false,
  connected = false,
}: {
  large?: boolean;
  connected?: boolean;
}) {
  return (
    <span className={`brand${large ? " brand-large" : ""}`}>
      <span
        className={`brand-dot${connected ? " brand-dot-connected" : ""}`}
        aria-hidden="true"
      />
      Homi
      {connected && <span className="sr-only"> — Connected</span>}
    </span>
  );
}
