// ─── prelab.js — shared across all prelab pages ──────────────────────────────
// Requires: js/client.js loaded first
// Requires page to define: PRELAB_ID, DASHBOARD_MILESTONES, MAX_SECTION
// Requires page to have: sectionDone, unlockedUpTo, goTo(), markDone()

let currentUser = null
const activityTimers = {}

// ── Top nav ───────────────────────────────────────────────────────────────────
function injectTopNav(dashboardPath = '../dashboard.html', indexPath = '../index.html') {
  const bar = document.createElement('div')
  bar.style.cssText = 'position:fixed;top:0;right:0;z-index:200;display:flex;align-items:center;gap:8px;padding:10px 16px;'
  bar.innerHTML = `
    <span id="save-indicator" style="font-size:11px;color:#aaa;display:none;"></span>
    <span id="top-user-email" style="font-size:12px;color:#888;"></span>
    <a href="${dashboardPath}" style="font-size:12px;padding:5px 12px;background:white;border:1.5px solid #e0e8f5;border-radius:8px;color:#1a55a8;text-decoration:none;font-weight:500;box-shadow:0 1px 4px rgba(0,0,0,0.08);">← Dashboard</a>
    <button onclick="doLogout()" style="font-size:12px;padding:5px 12px;background:white;border:1.5px solid #e0e0e0;border-radius:8px;color:#666;cursor:pointer;font-weight:500;box-shadow:0 1px 4px rgba(0,0,0,0.08);">Log out</button>
  `
  document.body.insertBefore(bar, document.body.firstChild)
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function initAuth(onReady) {
  const { data: { session } } = await db.auth.getSession()
  if (!session) { window.location.href = '../index.html'; return }
  currentUser = session.user

  const emailEl = document.getElementById('top-user-email')
  if (emailEl) emailEl.textContent = currentUser.email

  await restoreProgress()
  attachAutoSave()
  await loadActivityResponses()

  // Check if already submitted — show green state on submit button
  const { data: sub } = await db.from('progress')
    .select('id').eq('user_id', currentUser.id)
    .eq('prelab_id', PRELAB_ID).eq('section_id', 'submitted').maybeSingle()
  if (sub) markSubmitted()

  if (onReady) onReady()
}

function markSubmitted() {
  const btn = document.getElementById('final-submit-btn')
  const status = document.getElementById('submit-status')
  if (btn) { btn.textContent = '✓ Submitted!'; btn.style.background = 'var(--success)'; btn.disabled = true; }
  if (status) { status.style.display = 'block'; status.style.color = 'var(--success)'; status.textContent = `${PRELAB_LABEL} marked complete. Your instructor can see your submission.` }
}

// ── Progress save / restore ───────────────────────────────────────────────────
async function restoreProgress() {
  const { data } = await db.from('progress')
    .select('section_id')
    .eq('user_id', currentUser.id)
    .eq('prelab_id', PRELAB_ID)

  if (!data || data.length === 0) return
  const completed = new Set(data.map(r => r.section_id))

  completed.forEach(sid => {
    if (!sid.startsWith('section-')) return
    const n = parseInt(sid.replace('section-', ''))
    if (isNaN(n)) return
    sectionDone.add(n)
    const navDot = document.querySelector('.nav-item[data-section="'+n+'"]')
    if (navDot) { navDot.classList.add('done'); navDot.style.color = 'var(--success)'; }
    const nextBtn = document.getElementById('next-'+n)
    if (nextBtn) nextBtn.removeAttribute('disabled')
  })

  while (sectionDone.has(unlockedUpTo)) unlockedUpTo++
  if (unlockedUpTo > 0) goTo(Math.min(unlockedUpTo, MAX_SECTION))
}

async function saveProgress(sectionN) {
  if (!currentUser) return
  const rows = [{ user_id: currentUser.id, prelab_id: PRELAB_ID, section_id: 'section-' + sectionN }]
  if (typeof DASHBOARD_MILESTONES !== 'undefined' && DASHBOARD_MILESTONES[sectionN]) {
    rows.push({ user_id: currentUser.id, prelab_id: PRELAB_ID, section_id: DASHBOARD_MILESTONES[sectionN] })
  }
  for (const row of rows) {
    const { error } = await db.from('progress').insert(row)
    if (error && error.code !== '23505') console.error('Progress save error:', error)
  }
}

// ── Activity auto-save ────────────────────────────────────────────────────────
async function autoSaveField(fieldId, value) {
  const ind = document.getElementById('save-indicator')
  if (ind) { ind.style.display = 'inline'; ind.textContent = 'Saving...'; ind.style.color = '#aaa'; }
  clearTimeout(activityTimers[fieldId])
  activityTimers[fieldId] = setTimeout(async () => {
    if (!currentUser) return
    const { error } = await db.from('activity_responses').upsert({
      user_id: currentUser.id,
      prelab_id: PRELAB_ID,
      field_id: fieldId,
      response: value,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,prelab_id,field_id' })
    if (ind) {
      if (error) { ind.textContent = 'Save failed'; ind.style.color = '#c0392b'; }
      else { ind.textContent = '✓ Saved'; ind.style.color = '#2e7d32'; setTimeout(() => { ind.style.display = 'none' }, 2000) }
    }
    if (error) console.error('Activity save error:', fieldId, error)
  }, 800)
}

async function loadActivityResponses() {
  const { data } = await db.from('activity_responses')
    .select('field_id, response')
    .eq('user_id', currentUser.id)
    .eq('prelab_id', PRELAB_ID)
  if (!data) return
  data.forEach(r => {
    const el = document.getElementById(r.field_id)
    if (!el) return
    el.value = r.response
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function attachAutoSave() {
  document.querySelectorAll('textarea[id], input[type="text"][id]').forEach(el => {
    el.addEventListener('input', () => autoSaveField(el.id, el.value))
  })
}

// ── Final submit ──────────────────────────────────────────────────────────────
async function submitPrelab() {
  const btn = document.getElementById('final-submit-btn')
  const status = document.getElementById('submit-status')
  btn.disabled = true
  btn.textContent = 'Submitting...'
  const { error } = await db.from('progress').insert({
    user_id: currentUser.id, prelab_id: PRELAB_ID, section_id: 'submitted'
  })
  if (error && error.code !== '23505') {
    btn.disabled = false
    btn.textContent = `Submit ${PRELAB_LABEL} ✓`
    status.style.display = 'block'
    status.style.color = 'var(--danger)'
    status.textContent = 'Something went wrong — try again.'
    return
  }
  markSubmitted()
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function doLogout() {
  await db.auth.signOut()
  window.location.href = '../index.html'
}