/* KeyKeeper classroom demo: real AES-GCM via Web Crypto; keys stay in memory. */
const state = { keys: [], audit: [], cipher: null, toastTimer: null };
const $ = (id) => document.getElementById(id);
const el = {
  total: $('stat-total'), active: $('stat-active'), retired: $('stat-retired'), navCount: $('nav-key-count'), vaultCount: $('vault-count'),
  table: $('key-table'), tableEmpty: $('table-empty'), select: $('key-select'), audit: $('activity-list'), noActive: $('no-active-note'),
  encrypt: $('encrypt-button'), message: $('message-input'), result: $('cipher-result'), cipherText: $('cipher-text'), cipherMeta: $('cipher-meta'),
  decrypt: $('decrypt-button'), decrypted: $('decrypted-result'), toast: $('toast'), confirmDialog: $('confirm-dialog'), infoDialog: $('info-dialog')
};
const statusLabel = { active: 'Active', rotated: 'Rotated', expired: 'Expired', deactivated: 'Deactivated' };
function stamp(date = new Date()) { return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function shortId() { return crypto.randomUUID().split('-')[0].toUpperCase(); }
function activeKey() { return state.keys.find(k => k.status === 'active') || null; }
function toast(message) { el.toast.textContent = message; el.toast.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600); }
function log(action, detail, icon = '⚿', kind = '') { state.audit.unshift({ action, detail, icon, kind, at: new Date() }); renderAudit(); }

async function makeKey({ quiet = false } = {}) {
  try {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const entry = { id: shortId(), cryptoKey: key, created: new Date(), usage: 0, status: 'active' };
    state.keys.unshift(entry);
    log('Key generated', `<b>KEY-${entry.id}</b> created with AES-256-GCM.`);
    render();
    if (!quiet) toast(`Key KEY-${entry.id} generated and ready.`);
    return entry;
  } catch (e) {
    toast('Web Crypto is unavailable here. Run this app through localhost.');
  }
}

async function encryptMessage() {
  const key = state.keys.find(k => k.id === el.select.value && k.status === 'active');
  const message = el.message.value.trim();
  if (!key) return toast('Choose or generate an active key first.');
  if (!message) return toast('Type a message to encrypt.');
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key.cryptoKey, new TextEncoder().encode(message));
    const bytes = new Uint8Array(encrypted);
    const encoded = btoa(String.fromCharCode(...iv, ...bytes));
    key.usage++;
    state.cipher = { keyId: key.id, payload: encoded, iv: Array.from(iv), data: Array.from(bytes) };
    el.cipherText.textContent = encoded;
    el.cipherMeta.textContent = `Encrypted with KEY-${key.id} · AES-256-GCM · ${bytes.length} bytes`;
    el.result.classList.remove('hidden'); el.decrypted.classList.add('hidden');
    log('Message encrypted', `Protected using <b>KEY-${key.id}</b>.`, '▣', 'encrypt');
    render(); toast('Message encrypted successfully.');
  } catch (e) { toast('Encryption failed. Please try again.'); }
}

async function decryptMessage() {
  if (!state.cipher) return toast('Encrypt a message first.');
  const key = state.keys.find(k => k.id === el.select.value);
  if (!key || key.id !== state.cipher.keyId) {
    el.decrypted.textContent = 'This is not the key that encrypted this message. Select KEY-' + state.cipher.keyId + ' to decrypt it.';
    el.decrypted.classList.remove('hidden'); el.decrypted.style.background = '#fff5e8'; el.decrypted.style.color = '#a87228';
    return toast('Wrong key selected. The message remains protected.');
  }
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(state.cipher.iv) }, key.cryptoKey, new Uint8Array(state.cipher.data));
    el.decrypted.textContent = 'Decrypted: ' + new TextDecoder().decode(plain);
    el.decrypted.style.background = ''; el.decrypted.style.color = '';
    el.decrypted.classList.remove('hidden');
    log('Message decrypted', `Recovered with <b>KEY-${key.id}</b>.`, '⌕', 'encrypt');
    toast('Message decrypted with the matching key.');
  } catch (e) { toast('Decryption failed: message or key is invalid.'); }
}

function rotateKey(keyId = null) {
  const old = keyId ? state.keys.find(k => k.id === keyId && k.status === 'active') : activeKey();
  if (!old) { makeKey(); return; }
  $('dialog-title').textContent = 'Rotate active key?';
  $('dialog-copy').textContent = `KEY-${old.id} will be marked rotated and a fresh key will become active. The old key stays available to decrypt messages it encrypted.`;
  $('dialog-confirm').textContent = 'Rotate key';
  el.confirmDialog.showModal();
  $('dialog-confirm').onclick = async (event) => {
    event.preventDefault(); el.confirmDialog.close(); old.status = 'rotated';
    const fresh = await makeKey({ quiet: true });
    log('Key rotated', `<b>KEY-${old.id}</b> retired; <b>KEY-${fresh.id}</b> is now active.`, '⟳');
    render(); toast(`Rotated to KEY-${fresh.id}. Older messages can still be decrypted.`);
  };
}

function retireKey(keyId, status) {
  const key = state.keys.find(k => k.id === keyId);
  if (!key || key.status !== 'active') return;
  key.status = status;
  const action = status === 'expired' ? 'Key expired' : 'Key deactivated';
  log(action, `<b>KEY-${key.id}</b> can no longer encrypt new messages.`, '◴', 'retire');
  render(); toast(`KEY-${key.id} marked ${status}.`);
}

function render() {
  const active = state.keys.filter(k => k.status === 'active').length;
  const retired = state.keys.filter(k => k.status !== 'active').length;
  el.total.textContent = state.keys.length; el.active.textContent = active; el.retired.textContent = retired;
  el.navCount.textContent = state.keys.length; el.vaultCount.textContent = `${state.keys.length} ${state.keys.length === 1 ? 'key' : 'keys'}`;
  el.table.innerHTML = state.keys.map(k => `
    <tr><td><span class="key-name"><span class="key-symbol">⚿</span><span>KEY-${k.id}<small class="key-sub">Non-exportable key</small></span></span></td>
      <td><span class="algo-pill">AES-256-GCM</span></td><td>${stamp(k.created)}</td><td>${k.usage} ${k.usage === 1 ? 'operation' : 'operations'}</td>
      <td><span class="status-pill status-${k.status}">${statusLabel[k.status]}</span></td><td><span class="row-actions">${k.status === 'active' ? `<button class="row-action" data-action="rotate" data-id="${k.id}" title="Rotate this key">Rotate</button><button class="row-action" data-action="expire" data-id="${k.id}" title="Simulate expiry">Expire</button><button class="row-action" data-action="deactivate" data-id="${k.id}" title="Deactivate this key">Off</button>` : `<button class="row-action" data-action="use" data-id="${k.id}" title="Select this key">Select</button>`}</span></td></tr>`).join('');
  el.tableEmpty.classList.toggle('hidden', state.keys.length > 0);
  const candidates = state.keys.filter(k => k.status === 'active' || (state.cipher && k.id === state.cipher.keyId));
  el.select.innerHTML = candidates.length ? candidates.map(k => `<option value="${k.id}" ${state.cipher?.keyId === k.id ? 'selected' : ''}>KEY-${k.id} — ${k.status === 'active' ? 'Active' : 'Previous key'}</option>`).join('') : '<option value="">No keys available</option>';
  el.encrypt.disabled = !active; el.encrypt.style.opacity = active ? '' : '.5'; el.noActive.classList.toggle('hidden', !!active);
  $('rotate-current').disabled = !active; $('rotate-current').style.opacity = active ? '' : '.55';
}

function renderAudit() {
  el.audit.innerHTML = state.audit.length ? state.audit.slice(0, 12).map(a => `<div class="activity-item"><span class="activity-icon ${a.kind}">${a.icon}</span><span class="activity-copy"><b>${a.action}.</b> ${a.detail}</span><time class="activity-time">${stamp(a.at)}</time></div>`).join('') : '<div class="activity-empty">Activity will appear here as you use the demo.</div>';
}

document.querySelectorAll('#new-key-top,#new-key-vault,#empty-generate').forEach(button => button.addEventListener('click', () => makeKey()));
el.encrypt.addEventListener('click', encryptMessage);
el.decrypt.addEventListener('click', decryptMessage);
$('rotate-current').addEventListener('click', () => rotateKey());
$('copy-cipher').addEventListener('click', async () => { if (!state.cipher) return; try { await navigator.clipboard.writeText(state.cipher.payload); toast('Encrypted text copied.'); } catch { toast('Clipboard access unavailable.'); } });
$('help-button').addEventListener('click', () => el.infoDialog.showModal());
$('clear-activity').addEventListener('click', () => { state.audit = []; renderAudit(); toast('Audit log cleared for this demo.'); });
el.table.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]'); if (!button) return;
  const { action, id } = button.dataset;
  if (action === 'rotate') rotateKey(id);
  if (action === 'expire') retireKey(id, 'expired');
  if (action === 'deactivate') retireKey(id, 'deactivated');
  if (action === 'use') { el.select.value = id; toast(`Selected KEY-${id}.`); }
});
makeKey({ quiet: true }).then(() => { log('Demo session started', 'A temporary AES-256-GCM key is ready.', '✦'); render(); });
