import { lazy, Suspense, useEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Seo from "./components/Seo.jsx";
import Home from "./pages/Home.jsx";
import { PAGE_META, DEFAULT_META } from "./content.js";

// Home (the landing route) is eager so the first paint has full content; lazy-loading
// it would render a short fallback, then push the footer down on load (a big layout
// shift). The rest are code-split.
const HowItWorks = lazy(() => import("./pages/HowItWorks.jsx"));
const Faq = lazy(() => import("./pages/Faq.jsx"));
const Privacy = lazy(() => import("./pages/Privacy.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Analyzer = lazy(() => import("./pages/Analyzer.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

function PageFallback() {
  // Reserve most of the viewport so a lazy route swapping in doesn't jump the footer.
  return (
    <div className="mx-auto flex min-h-[75svh] max-w-5xl items-center justify-center px-5" role="status" aria-live="polite">
      <span className="text-sm text-muted">Loading…</span>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const mainRef = useRef(null);
  const announceRef = useRef(null);
  const hasMounted = useRef(false);

  // <title> is owned by <Seo/> (React 19 metadata). On client-side NAVIGATIONS (not
  // the initial load), announce the page, move focus to <main>, and reset scroll.
  // Skipping this on first mount keeps the skip link and header reachable on load.
  useEffect(() => {
    if (hasMounted.current) {
      const title = (PAGE_META[location.pathname] || DEFAULT_META).title;
      if (announceRef.current) announceRef.current.textContent = title;
      if (mainRef.current) mainRef.current.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    hasMounted.current = true;
  }, [location.pathname]);

  return (
    <div className="flex min-h-svh flex-col">
      <Seo />
      <a
        href="#main"
        className="sr-only rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>

      <Header />

      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analyze" element={<Analyzer />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      <Footer />

      {/* Polite live region announces route changes for screen-reader users. */}
      <div ref={announceRef} aria-live="polite" className="sr-only" />
    </div>
  );
}
