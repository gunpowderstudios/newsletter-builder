(() => {
  'use strict';

  const SIDE_KEY = 'gunpowder-news-mary-side-padding-v1';
  const DEFAULT_SIDE = 28;
  const frame = document.getElementById('previewFrame');

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function currentSidePadding() {
    const select = document.getElementById('maryIntroSidePadding');
    return select ? Number(select.value) || DEFAULT_SIDE : DEFAULT_SIDE;
  }

  function findMaryIntro(doc) {
    if (!doc) return null;
    const explicit = doc.querySelector('.mary-intro');
    if (explicit) return explicit;
    return [...doc.querySelectorAll('td.mobile-pad > div')].find(div => {
      const td = div.parentElement;
      return td && !td.querySelector('h1') && !td.querySelector('img');
    }) || null;
  }

  function applySidePadding(doc) {
    const mary = findMaryIntro(doc);
    if (!mary) return;
    const cell = mary.parentElement;
    if (!cell || cell.tagName !== 'TD') return;

    const topBottomSelect = document.getElementById('maryIntroPadding');
    const vertical = topBottomSelect ? Number(topBottomSelect.value) || 24 : 24;
    const side = currentSidePadding();

    cell.style.paddingTop = `${vertical}px`;
    cell.style.paddingBottom = `${vertical}px`;
    cell.style.paddingLeft = `${side}px`;
    cell.style.paddingRight = `${side}px`;
  }

  function patchPreview() {
    try {
      applySidePadding(frame && frame.contentDocument);
    } catch (_) {}
  }

  function serialisePreview() {
    try {
      const doc = frame && frame.contentDocument;
      if (!doc) return '';
      applySidePadding(doc);
      return '<!doctype html>\n' + doc.documentElement.outerHTML;
    } catch (_) {
      return frame ? frame.srcdoc : '';
    }
  }

  function replaceOutputButton(id, handler) {
    const oldButton = document.getElementById(id);
    if (!oldButton || !oldButton.parentNode) return;
    const button = oldButton.cloneNode(true);
    oldButton.parentNode.replaceChild(button, oldButton);
    button.addEventListener('click', handler);
  }

  const paddingSelect = document.getElementById('maryIntroPadding');
  if (paddingSelect) {
    const label = paddingSelect.closest('label');
    const title = label && label.querySelector('span');
    if (title) title.textContent = 'Top/bottom padding';

    const grid = label && label.parentElement;
    if (grid) {
      grid.style.gridTemplateColumns = '1fr 150px 170px 150px';
      const sideLabel = document.createElement('label');
      sideLabel.className = 'field';
      sideLabel.innerHTML = `
        <span>Side padding</span>
        <select id="maryIntroSidePadding" style="width:100%;border:1px solid #493724;background:#0f0d0b;color:#f5f0e6;border-radius:7px;padding:11px 12px;outline:none;">
          <option value="16">16px</option>
          <option value="24">24px</option>
          <option value="28">28px</option>
          <option value="32">32px</option>
          <option value="40">40px</option>
          <option value="48">48px</option>
        </select>`;
      grid.appendChild(sideLabel);

      const sideSelect = sideLabel.querySelector('select');
      let saved = DEFAULT_SIDE;
      try { saved = Number(localStorage.getItem(SIDE_KEY)) || DEFAULT_SIDE; } catch (_) {}
      sideSelect.value = String(saved);
      if (!sideSelect.value) sideSelect.value = String(DEFAULT_SIDE);

      sideSelect.addEventListener('change', () => {
        try { localStorage.setItem(SIDE_KEY, sideSelect.value); } catch (_) {}
        patchPreview();
      });
    }
  }

  const version = document.querySelector('.version');
  if (version) version.textContent = 'v1.9';

  if (frame) frame.addEventListener('load', patchPreview);
  if (paddingSelect) paddingSelect.addEventListener('change', patchPreview);

  replaceOutputButton('copyHtmlBtn', async () => {
    const html = serialisePreview();
    try {
      await navigator.clipboard.writeText(html);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = html;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast('Brevo HTML copied.');
  });

  replaceOutputButton('downloadHtmlBtn', () => {
    const html = serialisePreview();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gunpowder-news-${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  });

  patchPreview();
})();
