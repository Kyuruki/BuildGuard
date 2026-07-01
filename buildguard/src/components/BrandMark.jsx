// BillGuard mark: a shield (guard) whose interior forms a downward "check your
// charge" tick / ledger checkmark. Inherits currentColor. Decorative when paired
// with the wordmark, so it's aria-hidden at call sites.
export default function BrandMark({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" focusable="false">
      <path
        d="M12 2.5 4.5 5.2v6.3c0 4.6 3 8.1 7.5 10 4.5-1.9 7.5-5.4 7.5-10V5.2L12 2.5Z"
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="M12 2.5 4.5 5.2v6.3c0 4.6 3 8.1 7.5 10 4.5-1.9 7.5-5.4 7.5-10V5.2L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 12.2l2.4 2.4 4.6-5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
