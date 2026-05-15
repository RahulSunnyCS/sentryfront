/**
 * Popup script — manages UI states and communicates with background service worker.
 */

const $ = (id) => document.getElementById(id);

const states = ['login', 'ready', 'scanning', 'results', 'error'];

function showState(name) {
  for (const s of states) {
    $(`state-${s}`).classList.toggle('hidden', s !== name);
  }
}

function truncateUrl(url) {
  if (url.length <= 50) return url;
  return url.slice(0, 47) + '…';
}

function renderGrade(grade) {
  const badge = $('grade-badge');
  badge.textContent = grade ?? '–';
  badge.className = `grade-badge grade-${(grade ?? 'f').toLowerCase()}`;
}

function renderFindings(summary) {
  const grid = $('findings-grid');
  const sevs = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  grid.innerHTML = sevs.map((sev) => `
    <div class="finding-chip sev-${sev.toLowerCase()}">
      <span class="chip-label">${sev}</span>
      <span class="chip-count">${summary?.[sev] ?? 0}</span>
    </div>
  `).join('');
}

function setStatusText(text) {
  $('scan-status-text').textContent = text;
}

let currentTab = null;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  if (!tab?.url || !tab.url.startsWith('http')) {
    showState('error');
    $('error-text').textContent = 'Cannot scan this page (not an http/https URL).';
    return;
  }

  // Show current URL
  $('current-url').textContent = truncateUrl(tab.url);

  // Check auth
  chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      showState('error');
      $('error-text').textContent = 'Extension error. Try reloading.';
      return;
    }

    if (!response.user) {
      showState('login');
      return;
    }

    const email = response.user.email ?? response.user.name ?? 'Logged in';
    const badge = $('user-badge');
    badge.textContent = email;
    badge.classList.remove('hidden');

    showState('ready');
  });
}

function startScan() {
  if (!currentTab) return;
  showState('scanning');
  setStatusText('Collecting page data…');

  chrome.runtime.sendMessage(
    { type: 'START_SCAN', tab: { id: currentTab.id, url: currentTab.url } },
    (response) => {
      if (chrome.runtime.lastError) {
        showState('error');
        $('error-text').textContent = 'Extension communication error.';
        return;
      }
      handleScanResponse(response);
    },
  );
  // Intermediate status updates arrive via the onMessage listener below.
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SCAN_PROGRESS') {
    updateProgress(message.status);
  }
});

function updateProgress(status) {
  const labels = {
    collecting: 'Collecting page data…',
    RUNNING: 'Running security modules…',
    scanning: 'Submitting to VibeSafe…',
    QUEUED: 'Queued for scanning…',
  };
  setStatusText(labels[status] ?? 'Scanning…');
}

function handleScanResponse(response) {
  if (!response) {
    showState('error');
    $('error-text').textContent = 'No response from extension.';
    return;
  }

  if (response.status === 'error') {
    showState('error');
    $('error-text').textContent = response.error ?? 'Scan failed.';
    return;
  }

  if (response.status === 'complete') {
    renderGrade(response.grade);
    renderFindings(response.summary);
    $('score-text').textContent = `Score: ${Math.round(response.score ?? 0)} / 100`;

    const apiBase = response.apiBase ?? 'https://vibesafe.io';
    $('view-report-link').href = `${apiBase}/scan/${response.scanId}`;

    showState('results');
    return;
  }

  // Intermediate status — update progress text
  updateProgress(response.status);
}

// Event listeners
$('btn-login').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_API_BASE' }, (res) => {
    const base = res?.apiBase ?? 'https://vibesafe.io';
    chrome.tabs.create({ url: `${base}/login` });
  });
});

$('btn-scan').addEventListener('click', startScan);
$('btn-retry').addEventListener('click', () => showState('ready'));
$('btn-rescan').addEventListener('click', () => showState('ready'));

init();
