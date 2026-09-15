(() => {
  'use strict';

  const VERSION = '1.1';
  const DEFAULT_SITE = 'https://www.gunpowderstudios.co.uk';
  const MAX_SELECTED = 4;
  const STORAGE_KEY = 'gunpowder-news-builder-v1';

  const state = {
    posts: [],
    selected: [],
    usedIds: new Set(),
    intro: '',
    siteUrl: DEFAULT_SITE,
    previewMode: 'desktop'
  };

  const el = id => document.getElementById(id);
  const siteUrl = el('siteUrl');
  const refreshBtn = el('refreshBtn');
  const latestFourBtn = el('latestFourBtn');
  const hideUsed = el('hideUsed');
  const storyList = el('storyList');
  const fetchStatus = el('fetchStatus');
  const maryIntro = el('maryIntro');
  const selectedList = el('selectedList');
  const selectedCount = el('selectedCount');
  const copyHtmlBtn = el('copyHtmlBtn');
  const downloadHtmlBtn = el('downloadHtmlBtn');
  const clearDraftBtn = el('clearDraftBtn');
  const previewFrame = el('previewFrame');
  const previewStage = el('previewStage');
  const desktopBtn = el('desktopBtn');
  const mobileBtn = el('mobileBtn');
  const toast = el('toast');

  function toastMsg(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastMsg.timer);
    toastMsg.timer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function decodeEntities(html = '') {
    const t = document.createElement('textarea');
    t.innerHTML = html;
    return t.value;
  }

  function stripHtml(html = '') {
    const d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || d.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function smartTeaser(html, max = 330) {
    const text = stripHtml(html);
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const boundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    if (boundary > max * 0.55) return cut.slice(0, boundary + 1);
    return cut.replace(/\s+\S*$/, '') + '…';
  }

  function getFeaturedImage(post) {
    // Prefer the first image actually used in the article body. On some posts
    // the WordPress featured-media image is a decorative/transparent asset,
    // which can look like a huge blank gap in an email preview.
    const html = post?.content?.rendered || '';
    if (html) {
      const holder = document.createElement('div');
      holder.innerHTML = html;
      const bodyImage = holder.querySelector('img');
      if (bodyImage) {
        const bodySrc = bodyImage.getAttribute('src');
        if (bodySrc) return bodySrc;
      }
    }

    const media = post?._embedded?.['wp:featuredmedia']?.[0];
    const sizes = media?.media_details?.sizes || {};
    return sizes.large?.source_url || sizes.medium_large?.source_url || media?.source_url || '';
  }

  function normalizePost(post) {
    const title = decodeEntities(post?.title?.rendered || 'Untitled story');
    const excerptHtml = post?.excerpt?.rendered || post?.content?.rendered || '';
    return {
      id: String(post.id),
      title,
      link: post.link,
      image: getFeaturedImage(post),
      teaser: smartTeaser(excerptHtml),
      button: 'READ MORE →',
      date: post.date || ''
    };
  }

  async function fetchPosts() {
    const base = siteUrl.value.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(base)) {
      toastMsg('Enter a valid WordPress URL.');
      return;
    }
    state.siteUrl = base;
    fetchStatus.textContent = 'Loading WordPress posts…';
    refreshBtn.disabled = true;
    try {
      const endpoint = `${base}/wp-json/wp/v2/posts?per_page=12&_embed=1`;
      const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`WordPress returned ${res.status}`);
      const posts = await res.json();
      state.posts = posts.map(normalizePost);

      // Keep any wording the user has edited, but refresh the story image from
      // WordPress. This also repairs drafts saved by v1.0 that used an odd
      // featured-media asset and appeared as a large blank area in preview.
      state.selected = state.selected.map(saved => {
        const fresh = state.posts.find(post => post.id === saved.id);
        return fresh ? { ...saved, image: fresh.image || saved.image } : saved;
      });

      fetchStatus.textContent = `Loaded ${state.posts.length} newest posts.`;
      renderAll();
    } catch (err) {
      console.error(err);
      fetchStatus.textContent = 'Could not load posts.';
      storyList.innerHTML = `
        <div class="selected-empty">
          Could not read the WordPress REST API.<br><br>
          <strong>${escapeHtml(err.message)}</strong><br><br>
          Check that the site URL is correct and that WordPress allows public REST requests.
        </div>`;
    } finally {
      refreshBtn.disabled = false;
    }
  }

  function renderStories() {
    const posts = hideUsed.checked ? state.posts.filter(p => !state.usedIds.has(p.id)) : state.posts;
    if (!posts.length) {
      storyList.innerHTML = '<div class="selected-empty">No stories to show.</div>';
      return;
    }
    storyList.innerHTML = posts.map(p => {
      const selected = state.selected.some(s => s.id === p.id);
      const used = state.usedIds.has(p.id);
      return `
        <article class="story-card ${selected ? 'selected' : ''} ${used ? 'used' : ''}" data-id="${escapeAttr(p.id)}">
          ${p.image ? `<img class="story-thumb" src="${escapeAttr(p.image)}" alt="">` : '<div class="story-thumb"></div>'}
          <div>
            <h3>${escapeHtml(p.title)}</h3>
            <div class="story-meta">${p.date ? new Date(p.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : ''}${used ? ' · marked used' : ''}</div>
          </div>
          <div class="story-actions">
            <button class="button small select-story" data-id="${escapeAttr(p.id)}">${selected ? 'Remove' : 'Add'}</button>
            <button class="button small mark-used" data-id="${escapeAttr(p.id)}">${used ? 'Unmark used' : 'Mark used'}</button>
          </div>
        </article>`;
    }).join('');

    storyList.querySelectorAll('.select-story').forEach(btn => btn.addEventListener('click', () => toggleSelected(btn.dataset.id)));
    storyList.querySelectorAll('.mark-used').forEach(btn => btn.addEventListener('click', () => toggleUsed(btn.dataset.id)));
  }

  function toggleSelected(id) {
    const index = state.selected.findIndex(s => s.id === id);
    if (index >= 0) {
      state.selected.splice(index, 1);
    } else {
      if (state.selected.length >= MAX_SELECTED) {
        toastMsg('Four stories maximum. Remove one first.');
        return;
      }
      const post = state.posts.find(p => p.id === id);
      if (post) state.selected.push({ ...post });
    }
    renderAll();
  }

  function toggleUsed(id) {
    if (state.usedIds.has(id)) state.usedIds.delete(id);
    else state.usedIds.add(id);
    renderStories();
    saveState();
  }

  function selectLatestFour() {
    const available = state.posts.filter(p => !state.usedIds.has(p.id));
    state.selected = available.slice(0, MAX_SELECTED).map(p => ({ ...p }));
    renderAll();
    if (!state.selected.length) toastMsg('No unused stories available.');
  }

  function renderSelected() {
    selectedCount.textContent = `${state.selected.length} / ${MAX_SELECTED}`;
    if (!state.selected.length) {
      selectedList.innerHTML = '<div class="selected-empty">Choose stories above. They will appear here and in the live preview.</div>';
      return;
    }

    selectedList.innerHTML = state.selected.map((s, i) => `
      <article class="selected-card" data-id="${escapeAttr(s.id)}">
        <div class="selected-card-header">
          <strong>${i + 1}. ${escapeHtml(s.title)}</strong>
          <div class="order-actions">
            <button class="button small move-up" data-index="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="button small move-down" data-index="${i}" ${i === state.selected.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="button small danger remove-selected" data-index="${i}">Remove</button>
          </div>
        </div>
        <div class="selected-card-body">
          <label class="field">
            <span>Title</span>
            <input type="text" class="edit-title" data-index="${i}" value="${escapeAttr(s.title)}">
          </label>
          <label class="field">
            <span>Preview text</span>
            <textarea rows="4" class="edit-teaser" data-index="${i}">${escapeHtml(s.teaser)}</textarea>
          </label>
          <div class="selected-grid">
            <label class="field">
              <span>Article URL</span>
              <input type="url" class="edit-link" data-index="${i}" value="${escapeAttr(s.link)}">
            </label>
            <label class="field">
              <span>Button text</span>
              <input type="text" class="edit-button" data-index="${i}" value="${escapeAttr(s.button)}">
            </label>
          </div>
          <label class="field">
            <span>Featured image URL</span>
            <input type="url" class="edit-image" data-index="${i}" value="${escapeAttr(s.image)}">
          </label>
        </div>
      </article>`).join('');

    selectedList.querySelectorAll('.move-up').forEach(b => b.addEventListener('click', () => moveStory(Number(b.dataset.index), -1)));
    selectedList.querySelectorAll('.move-down').forEach(b => b.addEventListener('click', () => moveStory(Number(b.dataset.index), 1)));
    selectedList.querySelectorAll('.remove-selected').forEach(b => b.addEventListener('click', () => removeStory(Number(b.dataset.index))));

    bindLiveEdit('.edit-title', 'title');
    bindLiveEdit('.edit-teaser', 'teaser');
    bindLiveEdit('.edit-link', 'link');
    bindLiveEdit('.edit-button', 'button');
    bindLiveEdit('.edit-image', 'image');
  }

  function bindLiveEdit(selector, key) {
    selectedList.querySelectorAll(selector).forEach(input => {
      input.addEventListener('input', () => {
        const i = Number(input.dataset.index);
        if (state.selected[i]) state.selected[i][key] = input.value;
        renderPreview();
        saveState();
      });
    });
  }

  function moveStory(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= state.selected.length) return;
    [state.selected[index], state.selected[target]] = [state.selected[target], state.selected[index]];
    renderAll();
  }

  function removeStory(index) {
    state.selected.splice(index, 1);
    renderAll();
  }

  function renderAll() {
    renderStories();
    renderSelected();
    renderPreview();
    saveState();
  }

  function renderPreview() {
    const html = buildBrevoHtml();
    previewFrame.srcdoc = html;
    const storyHeight = Math.max(0, state.selected.length - 1) * 520;
    previewFrame.style.height = `${1080 + storyHeight + Math.min(state.intro.length, 1000) * 0.22}px`;
  }

  function paragraphize(text) {
    return text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p style="margin:0 0 14px 0;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function buildBrevoHtml() {
    const intro = state.intro.trim();
    const stories = state.selected.map((s, i) => {
      const image = s.image ? `
        <a href="${escapeAttr(s.link)}" target="_blank" style="text-decoration:none;">
          <img src="${escapeAttr(s.image)}" alt="${escapeAttr(s.title)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:0;margin:0;">
        </a>` : '';
      return `
      <tr>
        <td style="padding:0 28px 34px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;border-top:${i === 0 ? '0' : '1px solid #2d261f'};padding-top:${i === 0 ? '0' : '28px'};">
            <tr><td style="padding-top:${i === 0 ? '0' : '28px'};">${image}</td></tr>
            <tr>
              <td style="padding-top:20px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.3;letter-spacing:2px;text-transform:uppercase;color:#d88312;font-weight:bold;margin-bottom:8px;">Latest Adventure</div>
                <h2 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:#ffffff;font-weight:bold;">${escapeHtml(s.title)}</h2>
                <p style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7;color:#f2f2f2;">${escapeHtml(s.teaser)}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td bgcolor="#d88312" style="background:#d88312;border:1px solid #f1ad45;border-radius:3px;">
                      <a href="${escapeAttr(s.link)}" target="_blank" style="display:inline-block;padding:13px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;letter-spacing:.6px;color:#100d09;text-decoration:none;">${escapeHtml(s.button || 'READ MORE →')}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    }).join('');

    const introBlock = intro ? `
      <tr>
        <td style="padding:0 28px 30px 28px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7;color:#f2f2f2;">${paragraphize(intro)}</div>
        </td>
      </tr>` : '';

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gunpowder News</title>
<style>
  body{margin:0;padding:0;background:#000000;} table{border-collapse:collapse;} img{border:0;} a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;}
  @media only screen and (max-width:620px){.email-wrap{width:100%!important}.mobile-pad{padding-left:16px!important;padding-right:16px!important}.hero-title{font-size:30px!important}.story-title{font-size:24px!important}}
</style>
</head>
<body bgcolor="#000000" style="margin:0;padding:0;background:#000000;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#000000" style="width:100%;background:#000000;">
<tr><td align="center">
<table role="presentation" width="600" class="email-wrap" cellspacing="0" cellpadding="0" border="0" bgcolor="#000000" style="width:600px;max-width:600px;background:#000000;">
  <tr>
    <td class="mobile-pad" style="padding:34px 28px 28px 28px;text-align:center;border-bottom:1px solid #2d261f;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.3;letter-spacing:3px;text-transform:uppercase;color:#d88312;font-weight:bold;margin-bottom:8px;">News from the Wasted Wizard Tavern</div>
      <h1 class="hero-title" style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.15;color:#ffffff;font-weight:bold;">GUNPOWDER NEWS</h1>
      <p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#cfc5b7;">Dungeon dispatches, new games, strange discoveries and occasional treasure.</p>
    </td>
  </tr>
  ${introBlock}
  ${stories || `<tr><td style="padding:40px 28px;color:#9b8f80;font-family:Arial,Helvetica,sans-serif;text-align:center;">Choose up to four stories in the builder.</td></tr>`}
  <tr>
    <td class="mobile-pad" style="padding:24px 28px 34px 28px;border-top:1px solid #2d261f;text-align:center;">
      <p style="margin:0 0 7px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#d88312;font-weight:bold;">Gunpowder Studios</p>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8d8377;">This email was sent to {{ contact.EMAIL }}.<br>You received it because you subscribed to Gunpowder Studios news.</p>
      <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;"><a href="{{ mirror }}" style="color:#d88312;text-decoration:underline;">View in browser</a> &nbsp;|&nbsp; <a href="{{ unsubscribe }}" style="color:#d88312;text-decoration:underline;">Unsubscribe</a></p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  }

  async function copyHtml() {
    const html = buildBrevoHtml();
    try {
      await navigator.clipboard.writeText(html);
      toastMsg('Brevo HTML copied.');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = html;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toastMsg('Brevo HTML copied.');
    }
  }

  function downloadHtml() {
    const blob = new Blob([buildBrevoHtml()], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gunpowder-news-${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearDraft() {
    if (!confirm('Clear Mary’s intro and all selected stories?')) return;
    state.selected = [];
    state.intro = '';
    maryIntro.value = '';
    renderAll();
  }

  function saveState() {
    const payload = {
      selected: state.selected,
      usedIds: [...state.usedIds],
      intro: state.intro,
      siteUrl: state.siteUrl,
      previewMode: state.previewMode
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.selected = Array.isArray(saved.selected) ? saved.selected : [];
      state.usedIds = new Set(Array.isArray(saved.usedIds) ? saved.usedIds : []);
      state.intro = typeof saved.intro === 'string' ? saved.intro : '';
      state.siteUrl = typeof saved.siteUrl === 'string' ? saved.siteUrl : DEFAULT_SITE;
      state.previewMode = saved.previewMode === 'mobile' ? 'mobile' : 'desktop';
    } catch (e) {
      console.warn('Could not restore draft', e);
    }
    siteUrl.value = state.siteUrl;
    maryIntro.value = state.intro;
    setPreviewMode(state.previewMode);
  }

  function setPreviewMode(mode) {
    state.previewMode = mode;
    previewStage.classList.toggle('mobile', mode === 'mobile');
    previewStage.classList.toggle('desktop', mode !== 'mobile');
    desktopBtn.classList.toggle('active', mode === 'desktop');
    mobileBtn.classList.toggle('active', mode === 'mobile');
    saveState();
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  }
  function escapeAttr(value = '') { return escapeHtml(value); }

  refreshBtn.addEventListener('click', fetchPosts);
  latestFourBtn.addEventListener('click', selectLatestFour);
  hideUsed.addEventListener('change', renderStories);
  maryIntro.addEventListener('input', () => { state.intro = maryIntro.value; renderPreview(); saveState(); });
  copyHtmlBtn.addEventListener('click', copyHtml);
  downloadHtmlBtn.addEventListener('click', downloadHtml);
  clearDraftBtn.addEventListener('click', clearDraft);
  desktopBtn.addEventListener('click', () => setPreviewMode('desktop'));
  mobileBtn.addEventListener('click', () => setPreviewMode('mobile'));

  loadState();
  renderSelected();
  renderPreview();
  fetchPosts();
})();
