// Turns whatever a user pasted (or a model returned) into a clickable
// absolute URL, or null. LinkedIn links are reduced to their canonical form
// so share-sheet tracking params (?utm_source=...) don't break or clutter them.
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  if (/(^|\.)linkedin\.com$/i.test(url.hostname)) {
    const path = url.pathname.replace(/\/+$/, "");
    return `https://www.linkedin.com${path}`;
  }
  if (url.pathname === "/" && !url.search && !url.hash) return url.origin;
  return url.toString();
}

export function linkedInSearchUrl(name: string, company?: string | null) {
  const keywords = [name, company].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}
