const DEFAULT_API_BASE = 'https://vibesafe.io';

chrome.storage.sync.get(['apiBase'], (result) => {
  document.getElementById('api-base').value = result.apiBase || DEFAULT_API_BASE;
});

document.getElementById('btn-save').addEventListener('click', () => {
  const raw = document.getElementById('api-base').value.trim();
  let apiBase = raw || DEFAULT_API_BASE;

  // Normalize: strip trailing slash
  apiBase = apiBase.replace(/\/$/, '');

  chrome.storage.sync.set({ apiBase }, () => {
    const msg = document.getElementById('saved-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2500);
  });
});

document.getElementById('btn-open-app').addEventListener('click', () => {
  chrome.storage.sync.get(['apiBase'], (result) => {
    const base = result.apiBase || DEFAULT_API_BASE;
    chrome.tabs.create({ url: base });
  });
});
