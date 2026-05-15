/**
 * Background service worker — orchestrates scan requests from the popup.
 *
 * Responsibilities:
 * - Inject content script and collect page artifacts
 * - Fetch cookies for the current tab via chrome.cookies API
 * - POST artifacts to /api/v1/extension-scan
 * - Poll for scan completion and relay results back to popup
 */

const DEFAULT_API_BASE = 'https://vibesafe.io';
const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_ATTEMPTS = 40; // 40 × 3s = 120s max

async function getApiBase() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiBase'], (result) => {
      resolve(result.apiBase || DEFAULT_API_BASE);
    });
  });
}

async function getChromeCookies(tabUrl) {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ url: tabUrl }, (cookies) => {
      resolve(
        (cookies || []).map((c) => ({
          name: c.name,
          value: c.value,
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite ?? null,
          domain: c.domain ?? null,
          path: c.path ?? null,
        })),
      );
    });
  });
}

async function injectAndCollect(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  }).catch(() => {}); // ignore if already injected

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'COLLECT_ARTIFACTS' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error ?? 'Content script collection failed'));
        return;
      }
      resolve(response.artifacts);
    });
  });
}

// Broadcast a status update to any open popup
function broadcastStatus(status, extra = {}) {
  chrome.runtime.sendMessage({ type: 'SCAN_PROGRESS', status, ...extra }).catch(() => {});
}

async function pollScan(scanId, apiBase) {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${apiBase}/api/v1/scans/${scanId}`, {
      credentials: 'include',
    });
    if (!res.ok) continue;

    const data = await res.json();
    broadcastStatus(data.status, { scanId });

    if (['COMPLETED', 'FAILED', 'TIMEOUT'].includes(data.status)) {
      return data;
    }
  }
  throw new Error('Scan timed out waiting for results');
}

async function startScan(tab, sendResponse) {
  try {
    const apiBase = await getApiBase();

    // 1. Collect page artifacts from content script
    broadcastStatus('collecting');
    const artifacts = await injectAndCollect(tab.id);

    // 2. Merge in browser-managed cookies (includes HttpOnly)
    const cookies = await getChromeCookies(tab.url);
    artifacts.cookies = cookies;

    // 3. Submit to extension-scan API
    broadcastStatus('scanning');
    const submitRes = await fetch(`${apiBase}/api/v1/extension-scan`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(artifacts),
    });

    if (submitRes.status === 401) {
      sendResponse({ status: 'error', error: 'Not authenticated. Please log in to VibeSafe.' });
      return;
    }
    if (submitRes.status === 402) {
      const body = await submitRes.json();
      sendResponse({ status: 'error', error: body.error ?? 'Scan quota exhausted.' });
      return;
    }
    if (!submitRes.ok) {
      const body = await submitRes.json().catch(() => ({}));
      sendResponse({ status: 'error', error: body.error ?? `Server error ${submitRes.status}` });
      return;
    }

    const { id: scanId } = await submitRes.json();

    // 4. Poll until done
    broadcastStatus('QUEUED', { scanId });
    const result = await pollScan(scanId, apiBase);

    sendResponse({
      status: 'complete',
      scanId,
      grade: result.grade,
      score: result.score,
      summary: typeof result.summary === 'string' ? JSON.parse(result.summary) : result.summary,
      targetUrl: result.targetUrl,
      apiBase,
    });
  } catch (err) {
    sendResponse({ status: 'error', error: String(err) });
  }
}

async function checkAuth(apiBase) {
  try {
    const res = await fetch(`${apiBase}/api/auth/session`, { credentials: 'include' });
    if (!res.ok) return null;
    const session = await res.json();
    return session?.user ?? null;
  } catch {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START_SCAN') {
    startScan(message.tab, sendResponse);
    return true; // keep message channel open for async sendResponse
  }

  if (message.type === 'CHECK_AUTH') {
    getApiBase().then((base) => checkAuth(base)).then((user) => sendResponse({ user }));
    return true;
  }

  if (message.type === 'GET_API_BASE') {
    getApiBase().then((base) => sendResponse({ apiBase: base }));
    return true;
  }
});
