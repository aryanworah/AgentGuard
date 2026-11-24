const sample = { name: "John", age: 25, email: "john@example.com", status: "success" };
const textarea = document.querySelector('#agent-response');
const schemaList = document.querySelector('#schema-list');
const defaults = [{ name: 'name', type: 'string' }, { name: 'age', type: 'number' }, { name: 'email', type: 'string' }, { name: 'status', type: 'string' }];
let fields = structuredClone(defaults);

function renderFields() {
  schemaList.innerHTML = fields.map((field, index) => `<div class="schema-row"><span class="field-name">${escapeHtml(field.name)}</span><select class="type-select" data-index="${index}" aria-label="${escapeHtml(field.name)} type">${['string','number','integer','boolean','array','object'].map(type => `<option ${field.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select><span class="required">required</span><button class="remove-field" data-remove="${index}" aria-label="Remove ${escapeHtml(field.name)}">×</button></div>`).join('');
  schemaList.querySelectorAll('.type-select').forEach(el => el.onchange = () => fields[el.dataset.index].type = el.value);
  schemaList.querySelectorAll('.remove-field').forEach(el => el.onclick = () => { fields.splice(Number(el.dataset.remove), 1); renderFields(); });
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function updateEditor() {
  const value = textarea.value;
  document.querySelector('#char-count').textContent = `${value.length} character${value.length === 1 ? '' : 's'}`;
  document.querySelector('#line-numbers').innerHTML = Array.from({length: Math.max(1, value.split('\n').length)}, (_, i) => i + 1).join('<br>');
  const state = document.querySelector('#json-state');
  try { if (!value.trim()) throw new Error(); JSON.parse(value); state.textContent = 'Valid JSON'; state.previousElementSibling?.classList.add('valid'); }
  catch { state.textContent = value.trim() ? 'Invalid JSON' : 'Waiting for input'; }
}
function showToast(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
function resultTime() { return new Intl.DateTimeFormat(undefined, {hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date()); }
function renderReport(result) {
  document.querySelector('#empty-state').classList.add('hidden');
  const report = document.querySelector('#report'); report.classList.remove('hidden');
  document.querySelector('#run-time').textContent = `RUN AT ${resultTime().toUpperCase()}`;
  const summary = document.querySelector('#report-summary'); summary.className = `report-summary ${result.status === 'PASS' ? 'pass' : ''}`;
  summary.innerHTML = `<span class="result-badge">${result.status === 'PASS' ? 'ALL CHECKS PASSED' : 'REVIEW REQUIRED'}</span><div><span class="report-label">Overall result</span><strong>${result.status}</strong></div><div class="summary-stat"><span class="report-label">Total checks</span><strong>${result.total}</strong></div><div class="summary-stat"><span class="report-label">Passed</span><strong>${result.passed}<span> / ${result.total}</span></strong></div><div class="summary-stat"><span class="report-label">Failed</span><strong>${result.failed}</strong></div>`;
  document.querySelector('#check-list').innerHTML = result.checks.map(check => `<div class="check-row ${check.status.toLowerCase()}"><span class="check-mark">${check.status === 'PASS' ? '✓' : '!'}</span><span class="check-name">${escapeHtml(check.name)}</span><span class="check-detail">${escapeHtml(check.detail)}</span></div>`).join('');
  const failed = result.checks.filter(c => c.status === 'FAIL');
  document.querySelector('#recommendation-list').innerHTML = failed.length ? failed.map(c => `<div class="recommendation">${escapeHtml(c.recommendation)}</div>`).join('') : '<div class="recommendation good">Your response meets every configured requirement.</div>';
  document.querySelector('#results').scrollIntoView({behavior:'smooth', block:'nearest'});
}
async function verify() {
  const button = document.querySelector('#run-verify'); button.disabled = true; button.innerHTML = '<span class="run-symbol">◌</span> Checking response…';
  try {
    const response = await fetch('/api/verify', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({response:textarea.value, required_fields:fields.map(f=>f.name), expected_types:Object.fromEntries(fields.map(f=>[f.name,f.type])), expected_values:{status:document.querySelector('#expected-status').value}}) });
    if (!response.ok) throw new Error('Could not reach the verification service.');
    renderReport(await response.json());
  } catch(error) { showToast(error.message); }
  finally { button.disabled = false; button.innerHTML = '<span class="run-symbol">▶</span> Run verification <span class="button-shortcut">⌘ ↵</span>'; }
}
textarea.value = JSON.stringify(sample, null, 2); updateEditor(); renderFields();
textarea.addEventListener('input', updateEditor);
document.querySelector('#run-verify').addEventListener('click', verify);
document.querySelector('#load-sample').addEventListener('click', () => { textarea.value = JSON.stringify(sample, null, 2); updateEditor(); showToast('Sample response loaded'); });
document.querySelector('#reset-schema').addEventListener('click', () => { fields = structuredClone(defaults); document.querySelector('#expected-status').value = 'success'; renderFields(); showToast('Schema reset to defaults'); });
document.querySelector('#add-field').addEventListener('click', () => { const name = `field_${fields.length + 1}`; fields.push({name,type:'string'}); renderFields(); const row = schemaList.lastElementChild; row.querySelector('.field-name').outerHTML = `<input class="field-name field-name-input" aria-label="Field name" value="${name}" style="width:100%;border:0;background:transparent">`; row.querySelector('input').addEventListener('input', e => fields[fields.length - 1].name = e.target.value.trim()); row.querySelector('input').focus(); });
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') verify(); });
