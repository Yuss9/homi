const steps = [
  {
    number: "01",
    title: "Keep the home running",
    description: "Use Maintenance, Files and Providers for everyday care and completed work.",
  },
  {
    number: "02",
    title: "Stay supplied",
    description: "Use Stock and QR labels for consumables, spare parts and equipment access.",
  },
  {
    number: "03",
    title: "Plan ahead",
    description: "Use Assets & budgets and Renovations for replacement and project decisions.",
  },
  {
    number: "04",
    title: "Protect what matters",
    description: "Use Insurance to keep room-by-room values and export a private report.",
  },
];

export function OperationsGuide() {
  return (
    <section
      className="operations-guide"
      aria-labelledby="operations-guide-title"
      data-reveal
    >
      <div className="operations-guide-inner">
        <div className="operations-guide-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.pexels.com/photos/5591909/pexels-photo-5591909.jpeg?auto=compress&cs=tinysrgb&w=1200"
            alt="Hands cleaning a kitchen counter during everyday home care"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="operations-guide-head">
          <div>
            <small>How to use this workspace</small>
            <h2 id="operations-guide-title">One place, four simple jobs.</h2>
            <p>
              Start with the outcome you need. The tiles below then open only the
              tools for that job, so you never need to understand every feature
              at once.
            </p>
          </div>
        </div>
        <div className="operations-guide-steps">
          {steps.map((step) => (
            <article className="operations-guide-step" key={step.number}>
              <span>{step.number}</span>
              <strong>{step.title}</strong>
              <small>{step.description}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
