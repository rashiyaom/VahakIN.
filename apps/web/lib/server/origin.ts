// Browsers set Host from the destination and forbid scripts from changing it.
// Next dev bound to 0.0.0.0 can reconstruct request.url with that bind address.
export function requestOrigin(request: Request, development = process.env.NODE_ENV !== "production") {
  const url = new URL(request.url), host = request.headers.get("host");
  if (development && ["0.0.0.0", "[::]"].includes(url.hostname) && host) {
    try { const external = new URL(`${url.protocol}//${host}`); if (external.host === host && !external.username && !external.password) return external.origin; } catch { /* Use strict request URL below. */ }
  }
  return url.origin;
}
export function requestHasSameOrigin(request: Request, development = process.env.NODE_ENV !== "production") {
  const raw = request.headers.get("origin");
  if (!raw) return false;
  try {
    const origin = new URL(raw), destination = new URL(request.url);
    if (origin.origin !== raw || !["http:", "https:"].includes(origin.protocol)) return false;
    if (origin.origin === destination.origin) return true;
    // Keep the production comparison strict. No forwarded-host trust or wildcards.
    return development && ["0.0.0.0", "[::]"].includes(destination.hostname) && origin.protocol === destination.protocol && origin.host === request.headers.get("host");
  } catch { return false; }
}
