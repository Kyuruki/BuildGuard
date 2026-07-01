// Single source of truth for site copy and structured data.
// Reused by pages, the layout (route titles), and Phase 4 JSON-LD (FAQ/steps).

export const SITE = {
  name: "BillGuard",
  tagline: "A second opinion on your medical bill.",
  description:
    "Upload a medical or dental bill and check its charges against official CMS Medicare reference rates. See likely overcharges and draft a dispute letter.",
  url: "https://billguard.kyuruki.cc",
};

// Primary nav (header). Privacy lives in the footer.
export const NAV = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/faq", label: "FAQ" },
  { to: "/about", label: "About" },
];

export const ROUTE_TITLES = {
  "/": "BillGuard — Check your medical bill against Medicare rates",
  "/analyze": "Analyze a bill — BillGuard",
  "/how-it-works": "How it works — BillGuard",
  "/faq": "FAQ — BillGuard",
  "/privacy": "Privacy — BillGuard",
  "/about": "About — BillGuard",
};

// The disclaimer, worn openly. Used in the footer, the tool, and Privacy.
export const DISCLAIMER =
  "BillGuard is an informational tool, not legal, medical, or financial advice. It is not affiliated with CMS, Medicare, or any insurer. Medicare reference rates are a benchmark, not a statement of what you owe — verify against your own bill and plan before acting.";

// How-it-works: a genuine ordered sequence, so numbered markers are earned.
export const STEPS = [
  {
    n: "01",
    title: "Upload your bill",
    body: "Add a photo or PDF of an itemized medical or dental bill. It's read in memory and never stored.",
  },
  {
    n: "02",
    title: "We read the codes and charges",
    body: "Optical character recognition pulls out the CPT/HCPCS codes and dollar amounts — plain pattern-matching, no AI guessing at your numbers.",
  },
  {
    n: "03",
    title: "We compare to CMS Medicare rates",
    body: "Each code is checked against two official CMS fee schedules — the Physician Fee Schedule and the Clinical Laboratory Fee Schedule.",
  },
  {
    n: "04",
    title: "See overcharges, draft a letter",
    body: "Every line shows what you were charged versus the Medicare reference rate. If there are overcharges, generate a dispute letter to send.",
  },
];

export const FAQ = [
  {
    q: "What does BillGuard actually do?",
    a: "It reads the billing codes and charges off your bill, looks each code up in official CMS Medicare fee schedules, and shows you where a charge sits well above that reference rate. If it finds overcharges, it can draft a dispute letter for you to review and send.",
  },
  {
    q: "How does it decide something is an overcharge?",
    a: "For each 5-digit CPT/HCPCS code on your bill, it compares the amount charged to the CMS Medicare reference rate for that same code. When the charge is meaningfully higher than the reference rate, the line is flagged. BillGuard only flags codes it can confirm in the CMS data.",
  },
  {
    q: "What are CMS Medicare reference rates?",
    a: "CMS (the Centers for Medicare & Medicaid Services) publishes standardized payment rates for medical procedures. They're a widely used benchmark for what a service costs. They are not a cap on what a provider may bill or what you owe — but a charge many times the reference rate is worth questioning.",
  },
  {
    q: "Is my bill stored anywhere?",
    a: "No. Your upload is processed in memory to read the text, then discarded. BillGuard does not save your bill image, the extracted text, or any personal or health information to disk or a database. There are no accounts.",
  },
  {
    q: "Why are some codes marked “Unverified”?",
    a: "Not every code appears in the CMS fee schedules BillGuard checks (for example, some facility fees or bundled items). When a code isn't in the data, BillGuard marks it Unverified rather than guessing — it never asserts an overcharge it can't confirm.",
  },
  {
    q: "Does an overcharge mean I was defrauded?",
    a: "No. A charge above the Medicare reference rate is common and can be entirely legitimate — negotiated rates, facility costs, and your specific plan all vary. A flag is a prompt to ask for an itemized justification, not an accusation.",
  },
  {
    q: "Can I really dispute a bill with the letter?",
    a: "The letter is a professional, first-person request for review and itemization that you can copy, edit, and send to your provider's billing department. It's a starting point you control — not a legal filing, and not a guarantee of an adjustment.",
  },
  {
    q: "What files can I upload?",
    a: "A PNG, JPEG, or PDF up to 20 MB (PDFs up to 30 pages). Clearer scans and photos read more accurately.",
  },
  {
    q: "Is BillGuard affiliated with Medicare or my insurer?",
    a: "No. BillGuard is an independent, informational tool. It is not affiliated with, endorsed by, or connected to CMS, Medicare, or any insurance company.",
  },
];
