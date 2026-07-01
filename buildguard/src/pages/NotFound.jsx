import { Container, Button } from "../components/ui.jsx";

export default function NotFound() {
  return (
    <Container as="section" className="py-24 text-center sm:py-32">
      <p className="font-mono text-sm font-medium uppercase tracking-widest text-brand-700">404</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Page not found</h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-ink-soft">
        That page doesn't exist. Let's get you back on track.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Button to="/" size="lg">Go home</Button>
        <Button to="/analyze" variant="secondary" size="lg">Analyze a bill</Button>
      </div>
    </Container>
  );
}
