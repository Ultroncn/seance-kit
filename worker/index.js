// Serves dist/ as static assets with a per-app SPA fallback.
//
// Why a Worker: Workers static assets rejects _redirects SPA rewrites (API error 100324), and
// assets.not_found_handling = "single-page-application" only falls back to the ROOT index.html,
// which would show the landing page on /archive/ deep links. Unknown root URLs must still 404.

/** Each app owns a path prefix and its own index.html. */
export const APP_PREFIXES = ["/archive/", "/inbox/"];

/** True when the last path segment looks like a file (for example /archive/assets/x.js). */
function looksLikeFile(pathname) {
  const last = pathname.split("/").pop() ?? "";
  return last.includes(".");
}

export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    if (res.status !== 404) return res;

    // Only navigations fall back. A missing asset must stay a 404, not an HTML page.
    if (request.method !== "GET" && request.method !== "HEAD") return res;

    const { pathname } = new URL(request.url);
    const prefix = APP_PREFIXES.find((p) => pathname.startsWith(p));
    if (!prefix || looksLikeFile(pathname)) return res;

    // Ask for the app's folder, not ".../index.html": Cloudflare answers that with a 307 to the
    // folder, which would drop the deep link from the address bar.
    return env.ASSETS.fetch(new Request(new URL(prefix, request.url), request));
  },
};
