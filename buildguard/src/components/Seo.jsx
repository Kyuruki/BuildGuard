import { useLocation } from "react-router-dom";
import { PAGE_META, SITE } from "../content.js";

// Per-route <title> + canonical via React 19 native metadata. The static description +
// OG/Twitter brand defaults live in index.html (so no-JS social unfurlers get a valid
// card); keeping them out of here avoids duplicate tags. Unknown routes (client-side
// 404) get noindex + a home canonical so junk URLs aren't indexed as soft-404s.
export default function Seo() {
  const { pathname } = useLocation();
  const known = Object.prototype.hasOwnProperty.call(PAGE_META, pathname);
  const title = known ? PAGE_META[pathname].title : "Page not found | BillGuard";
  const canonical = known ? SITE.url + (pathname === "/" ? "" : pathname) : SITE.url;

  return (
    <>
      <title>{title}</title>
      <link rel="canonical" href={canonical} />
      {!known && <meta name="robots" content="noindex" />}
    </>
  );
}
