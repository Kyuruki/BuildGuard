import { Container, Eyebrow, Button } from "../components/ui.jsx";

export default function About() {
  return (
    <Container as="article" className="py-12 sm:py-16">
      <div className="max-w-2xl">
        <Eyebrow>About</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Medical bills shouldn't be a mystery
        </h1>
      </div>

      <div className="mt-8 max-w-2xl space-y-5 text-lg leading-relaxed text-ink-soft">
        <p>
          Most people have no way to tell whether a medical charge is fair. The codes are opaque, the prices are
          invisible until the bill arrives, and the same procedure can cost wildly different amounts.
        </p>
        <p>
          BillGuard exists to give you one honest reference point: what Medicare pays for the same code. It's not the
          whole story — but it's a solid place to start a conversation with a billing department, backed by public data
          rather than a hunch.
        </p>
        <p>
          It's deliberately small and transparent. It reads your bill, compares codes to official CMS fee schedules, and
          shows its work — no accounts, no stored data, no AI guessing at your numbers. The only AI involved writes the
          optional dispute letter, from figures BillGuard has already verified.
        </p>
      </div>

      <dl className="mt-12 grid max-w-3xl gap-6 sm:grid-cols-3">
        {[
          ["Independent", "Not affiliated with CMS, Medicare, or any insurer."],
          ["Transparent", "Rates come from public CMS fee schedules — codes it can't confirm are marked Unverified."],
          ["Private", "Processed in memory and discarded. Nothing you upload is stored."],
        ].map(([term, desc]) => (
          <div key={term} className="rounded-[var(--radius-card)] border border-line p-6">
            <dt className="font-mono text-xs font-medium uppercase tracking-widest text-brand-700">{term}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{desc}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12">
        <Button to="/analyze" size="lg">Analyze a bill</Button>
      </div>
    </Container>
  );
}
