// ─── quiz.js — shared across all quiz pages ───────────────────────────────────
// Requires: js/client.js loaded first
// Requires page to define: QUIZ_ID, QUESTIONS, EXPLANATIONS
// QUESTIONS shape: [{ q, opts: [], ans: 0-based index }]
// EXPLANATIONS shape: ['explanation for q0', 'for q1', ...]

let currentUser = null
const userAnswers = []

// ── Auth ──────────────────────────────────────────────────────────────────────
async function initQuizAuth(dashboardPath = '../dashboard.html', indexPath = '../index.html') {
  const { data: { session } } = await db.auth.getSession()
  if (!session) { window.location.href = indexPath; return }
  currentUser = session.user

  const emailEl = document.getElementById('user-email')
  if (emailEl) emailEl.textContent = currentUser.email

  // Reset answers array
  userAnswers.length = 0
  for (let i = 0; i < QUESTIONS.length; i++) userAnswers.push(null)

  // Check if already submitted
  const { data } = await db.from('quiz_results')
    .select('score, total, submitted_at, answers')
    .eq('user_id', currentUser.id)
    .eq('quiz_id', QUIZ_ID)
    .order('submitted_at', { ascending: false })
    .limit(1)

  buildQuiz()

  if (data && data.length > 0) {
    const r = data[0]
    const pct = Math.round((r.score / r.total) * 100)
    const date = new Date(r.submitted_at).toLocaleDateString()
    const prevScoreEl = document.getElementById('prev-score-text')
    if (prevScoreEl) prevScoreEl.textContent = `You scored ${r.score}/${r.total} (${pct}%) on ${date}. Correct answers are shown below.`
    const alreadyEl = document.getElementById('already-submitted')
    if (alreadyEl) alreadyEl.style.display = 'block'
    const submitRow = document.getElementById('submit-row')
    if (submitRow) submitRow.style.display = 'none'

    // Show correct answers + student's previous answers
    const prevAnswers = r.answers || []
    QUESTIONS.forEach((q, qi) => {
      q.opts.forEach((_, oi) => {
        const el = document.getElementById(`opt-${qi}-${oi}`)
        if (!el) return
        el.classList.add('disabled')
        if (oi === q.ans) {
          el.classList.add('correct')
          if (EXPLANATIONS && EXPLANATIONS[qi]) {
            const exp = document.createElement('div')
            exp.style.cssText = 'font-size:12px;margin-top:6px;padding:8px 12px;background:rgba(15,110,86,0.08);border-radius:6px;color:var(--success);'
            exp.textContent = '✓ ' + EXPLANATIONS[qi]
            el.appendChild(exp)
          }
        } else if (prevAnswers[qi] === oi && oi !== q.ans) {
          el.classList.add('wrong')
        }
      })
    })
  }
}

// ── Build quiz HTML ───────────────────────────────────────────────────────────
function buildQuiz() {
  const body = document.getElementById('quiz-body')
  if (!body) return
  body.innerHTML = QUESTIONS.map((q, qi) => `
    <div class="question-card" id="qcard-${qi}">
      <div class="q-number">Question ${qi + 1} of ${QUESTIONS.length}</div>
      <div class="q-text">${q.q}</div>
      ${q.opts.map((opt, oi) => `
        <div class="option" id="opt-${qi}-${oi}" onclick="selectAnswer(${qi}, ${oi})">
          <div class="opt-letter">${'ABCD'[oi]}</div>
          <span>${opt}</span>
        </div>
      `).join('')}
    </div>
  `).join('')
}

function selectAnswer(qi, oi) {
  QUESTIONS[qi].opts.forEach((_, i) => document.getElementById(`opt-${qi}-${i}`).classList.remove('selected'))
  userAnswers[qi] = oi
  document.getElementById(`opt-${qi}-${oi}`).classList.add('selected')
}

// ── Submit ────────────────────────────────────────────────────────────────────
async function submitQuiz() {
  const unanswered = userAnswers.filter(a => a === null).length
  if (unanswered > 0) { alert(`Please answer all questions. You have ${unanswered} unanswered.`); return }

  const btn = document.getElementById('submit-btn')
  btn.disabled = true
  btn.textContent = 'Submitting...'

  let score = 0
  QUESTIONS.forEach((q, qi) => { if (userAnswers[qi] === q.ans) score++ })

  // Reveal correct/wrong
  QUESTIONS.forEach((q, qi) => {
    q.opts.forEach((_, oi) => {
      const el = document.getElementById(`opt-${qi}-${oi}`)
      el.classList.add('disabled')
      el.classList.remove('selected')
      if (oi === q.ans) el.classList.add('correct')
      else if (oi === userAnswers[qi] && userAnswers[qi] !== q.ans) el.classList.add('wrong')
    })
  })

  await db.from('quiz_results').insert({
    user_id: currentUser.id,
    quiz_id: QUIZ_ID,
    score,
    total: QUESTIONS.length,
    answers: [...userAnswers]
  })

  document.getElementById('submit-row').style.display = 'none'
  const pct = Math.round((score / QUESTIONS.length) * 100)
  document.getElementById('score-big').textContent = `${score}/${QUESTIONS.length}`
  document.getElementById('score-label').textContent = `${pct}% — ${pct >= 80 ? 'Great work! 🎉' : pct >= 60 ? 'Good effort — review the sections you missed.' : 'Review the prelab and check in with your instructor.'}`
  document.getElementById('score-bar').style.width = pct + '%'
  const card = document.getElementById('results-card')
  card.classList.add('show')
  card.scrollIntoView({ behavior: 'smooth' })
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function doLogout() {
  await db.auth.signOut()
  window.location.href = '../index.html'
}