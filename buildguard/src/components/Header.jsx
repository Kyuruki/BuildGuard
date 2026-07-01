import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { NAV } from "../content.js";
import { Button, Container } from "./ui.jsx";
import BrandMark from "./BrandMark.jsx";

function navLinkClass({ isActive }) {
  return [
    "rounded-md px-1 py-1 text-sm font-medium transition-colors",
    isActive ? "text-brand-700" : "text-ink-soft hover:text-ink",
  ].join(" ");
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu whenever the route changes (covers link clicks AND
  // browser back/forward) — the recommended "adjust state during render" pattern,
  // no effect needed.
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);
    setOpen(false);
  }

  // Close on Escape while the menu is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 rounded-md text-ink" aria-label="BillGuard home">
          <BrandMark className="h-7 w-7 text-brand-600" />
          <span className="text-lg font-semibold tracking-tight">BillGuard</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
          <Button to="/analyze" size="md">Analyze a bill</Button>
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line text-ink md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
          </svg>
        </button>
      </Container>

      <nav id="mobile-nav" aria-label="Primary mobile" hidden={!open} className="border-t border-line bg-paper md:hidden">
        <Container className="flex flex-col gap-1 py-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2.5 text-base font-medium ${isActive ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-paper-2"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Button to="/analyze" size="lg" className="mt-2">Analyze a bill</Button>
        </Container>
      </nav>
    </header>
  );
}
