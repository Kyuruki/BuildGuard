import { Link } from "react-router-dom";

// Centered content column with consistent gutters.
export function Container({ as: As = "div", className = "", children }) {
  return <As className={`mx-auto w-full max-w-5xl px-5 sm:px-6 ${className}`}>{children}</As>;
}

// Small uppercase eyebrow that labels a section (encodes hierarchy, not decoration).
export function Eyebrow({ children, className = "" }) {
  return (
    <p className={`font-mono text-xs font-medium uppercase tracking-[0.18em] text-brand-700 ${className}`}>
      {children}
    </p>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55";
const buttonSizes = {
  md: "px-5 py-2.5 text-[0.95rem]",
  lg: "px-6 py-3 text-base",
};
const buttonVariants = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border border-line bg-paper text-ink hover:bg-paper-2",
  ghost: "text-brand-700 hover:bg-brand-50",
};

function classes(variant, size, className) {
  return `${buttonBase} ${buttonSizes[size]} ${buttonVariants[variant]} ${className}`;
}

// Renders as a real <button> or, with `to`, a router <Link>: same look, correct semantics.
export function Button({ to, href, variant = "primary", size = "md", className = "", children, ...rest }) {
  const cls = classes(variant, size, className);
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>;
  return <button className={cls} {...rest}>{children}</button>;
}

// A bordered aside for disclaimers / important context. tone drives color.
export function Callout({ tone = "neutral", title, children, className = "" }) {
  const tones = {
    neutral: "border-line bg-paper-2 text-ink-soft",
    info: "border-brand-100 bg-brand-50 text-ink-soft",
    warn: "border-warn/25 bg-warn-bg text-ink-soft",
  };
  return (
    <aside className={`rounded-[var(--radius-card)] border p-4 text-sm leading-relaxed ${tones[tone]} ${className}`}>
      {title && <p className="mb-1 font-semibold text-ink">{title}</p>}
      {children}
    </aside>
  );
}
