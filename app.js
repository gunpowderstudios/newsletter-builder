(async () => {
  const parts = ['app.b64.0','app.b64.1','app.b64.2','app.b64.3','app.b64.4'];
  let encoded = '';
  for (const part of parts) {
    const res = await fetch(part, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not load ${part}`);
    encoded += (await res.text()).trim();
  }
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
  const source = new TextDecoder('utf-8').decode(bytes);
  (0, eval)(source);
})().catch(err => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;left:20px;right:20px;bottom:20px;background:#5b1f1f;color:#fff;padding:14px;border-radius:8px;z-index:9999;font-family:Arial,sans-serif">Gunpowder News Builder could not start: ${String(err.message || err)}</div>`);
});
