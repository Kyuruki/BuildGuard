import { Container, Eyebrow, Button } from "../components/ui.jsx";
import { FAQ } from "../content.js";

const FAQ_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
});

export default function Faq() {
  return (
    <Container as="article" className="py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_JSONLD }} />
      <div className="max-w-2xl">
        <Eyebrow>FAQ</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Questions, answered plainly</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          What BillGuard does, what it doesn't, and how your bill is handled.
        </p>
      </div>

      {/* Native <details> — keyboard-operable and screen-reader friendly with no JS. */}
      <div className="mt-10 max-w-3xl divide-y divide-line border-y border-line">
        {FAQ.map((item, i) => (
          <details key={i} className="group">
            <summary className="flex list-none cursor-pointer items-center justify-between gap-4 py-5 text-left font-semibold text-ink marker:content-[''] [&::-webkit-details-marker]:hidden">
              <span>{item.q}</span>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 flex-shrink-0 text-brand-600 transition-transform group-open:rotate-45"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </summary>
            <p className="max-w-prose pb-5 leading-relaxed text-ink-soft">{item.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-12">
        <Button to="/analyze" size="lg">Analyze a bill</Button>
      </div>
    </Container>
  );
}
