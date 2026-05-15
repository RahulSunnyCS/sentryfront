/**
 * Content script — collects page artifacts from the authenticated browser context.
 * Injected on demand (not automatically on every page load).
 */

async function collectArtifacts() {
  const html = document.documentElement.outerHTML;

  // Collect all <script src="..."> URLs from the live DOM
  const jsBundleUrls = Array.from(document.querySelectorAll('script[src]'))
    .map((el) => el.src)
    .filter((src) => src && src.startsWith('http'));

  // Also include URLs from the performance API (catches dynamically injected scripts)
  if (typeof performance !== 'undefined' && performance.getEntriesByType) {
    const perfScripts = performance
      .getEntriesByType('resource')
      .filter((e) => e.initiatorType === 'script')
      .map((e) => e.name)
      .filter((u) => u.startsWith('http'));
    for (const url of perfScripts) {
      if (!jsBundleUrls.includes(url)) jsBundleUrls.push(url);
    }
  }

  // Concatenate all inline <script> body content
  const inlineScriptContent = Array.from(
    document.querySelectorAll('script:not([src])'),
  )
    .map((el) => el.textContent ?? '')
    .join('\n');

  // Capture response headers via a HEAD request (same-origin → all headers accessible)
  let headers = {};
  let statusCode = 200;
  try {
    const res = await fetch(window.location.href, {
      method: 'HEAD',
      credentials: 'include',
      cache: 'no-cache',
    });
    statusCode = res.status;
    for (const [key, value] of res.headers.entries()) {
      headers[key.toLowerCase()] = value;
    }
  } catch {
    // HEAD may fail on some servers; fall back to empty headers — modules handle it gracefully
  }

  // localStorage and sessionStorage (best-effort; may throw in sandboxed iframes)
  let localStorageData;
  let sessionStorageData;
  try {
    localStorageData = Object.fromEntries(
      Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? '']),
    );
  } catch { /* sandboxed */ }
  try {
    sessionStorageData = Object.fromEntries(
      Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k) ?? '']),
    );
  } catch { /* sandboxed */ }

  // Service worker registrations
  let serviceWorkerRegistrations;
  try {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      serviceWorkerRegistrations = regs.map((r) => ({
        url: r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? '',
        scope: r.scope,
      })).filter((r) => r.url);
    }
  } catch { /* not supported */ }

  return {
    url: window.location.href,
    html,
    headers,
    statusCode,
    jsBundleUrls,
    inlineScriptContent,
    localStorageData,
    sessionStorageData,
    serviceWorkerRegistrations,
  };
}

// Listen for requests from the background service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'COLLECT_ARTIFACTS') {
    collectArtifacts()
      .then((artifacts) => sendResponse({ ok: true, artifacts }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // keep channel open for async response
  }
});
