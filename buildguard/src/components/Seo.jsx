import { useLocation } from "react-router-dom";
import { PAGE_META, DEFAULT_META, SITE } from "../content.js";

// Per-route document metadata. React 19 hoists <title>/<meta>/<link> rendered
// anywhere in the tree into <head>, so a single <Seo/> in the layout keeps title,
// description, canonical, and social tags in sync with the current route — no
// external head-management library needed.
export default function Seo() {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] || DEFAULT_META;
  const url = SITE.url + (pathname === "/" ? "" : pathname);
  const ogImage = `${SITE.url}/og.png`;

  return (
    <>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={ogImage} />
    </>
  );
}
