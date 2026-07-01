import { Container, Eyebrow, Callout } from "../components/ui.jsx";

function Section({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <Container as="article" className="py-12 sm:py-16">
      <div className="max-w-2xl">
        <Eyebrow>Privacy</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">How your bill is handled</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          BillGuard is built to hold as little of your data as possible. Health-adjacent information deserves that.
        </p>
      </div>

      <div className="max-w-3xl">
        <Section title="Your upload is processed in memory, then discarded">
          <p>
            When you analyze a bill, the file is read in memory to extract text and billing codes, and then discarded
            when the request ends. BillGuard does <strong className="font-semibold text-ink">not</strong> save your bill
            image, the extracted text, or any personal or health information to disk or a database.
          </p>
        </Section>

        <Section title="No accounts, no tracking profiles">
          <p>
            There's no login and no stored history. Requests are rate-limited by IP address to prevent abuse, but IPs
            aren't tied to your bill contents or kept as a profile of you.
          </p>
        </Section>

        <Section title="Generating a dispute letter">
          <p>
            If you choose to generate a dispute letter, the verified overcharge details (billing codes, the amount
            charged, and the CMS reference rates) plus any name you enter are sent to Anthropic's Claude API to draft
            the letter. The bill image itself is never sent. If you'd rather not use a third-party service, you can stop
            after the results table and write your own letter.
          </p>
        </Section>

        <Callout tone="warn" title="Informational only" className="mt-10">
          BillGuard is not legal, medical, or financial advice, and is not affiliated with CMS, Medicare, or any insurer.
          Medicare reference rates are a benchmark, not a statement of what you owe. Verify against your own bill and
          plan before acting.
        </Callout>
      </div>
    </Container>
  );
}
