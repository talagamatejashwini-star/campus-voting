// ─── API Helpers ─────────────────────────────────────────────────
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

const GET  = url       => api('GET',    url);
const POST = (url, b)  => api('POST',   url, b);
const DEL  = url       => api('DELETE', url);

// ─── State ───────────────────────────────────────────────────────
let currentUser = null;
let myVotedIds  = [];

// ─── Init ────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const sess = await GET('/api/session');
  if (sess.role === 'student') {
    currentUser = sess.student;
    document.getElementById('navStudentName').textContent = currentUser.name;
    showPage('studentPage');
    await loadVoteTab();
  } else if (sess.role === 'admin') {
    showPage('adminPage');
    await loadAdminPage();
  }
});

// ─── Page Routing ────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ─── Login Tab Switch ────────────────────────────────────────────
function switchLoginTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', i===(tab==='student'?0:1)));
  document.getElementById('studentLoginForm').style.display = tab==='student' ? 'block' : 'none';
  document.getElementById('adminLoginForm').style.display   = tab==='admin'   ? 'block' : 'none';
}

// ─── Login ───────────────────────────────────────────────────────
async function loginStudent() {
  const id   = document.getElementById('studentId').value.trim();
  const name = document.getElementById('studentName').value.trim();
  const dept = document.getElementById('studentDept').value;
  const err  = document.getElementById('studentError');
  if (!id || !name || !dept) { err.style.display='block'; return; }
  err.style.display = 'none';
  const res = await POST('/api/login/student', { id, name, dept });
  if (res.ok) {
    currentUser = res.user;
    document.getElementById('navStudentName').textContent = name;
    showPage('studentPage');
    await loadVoteTab();
    showToast(`Welcome, ${name}! 🎉`, 'success');
  }
}

async function loginAdmin() {
  const username = document.getElementById('adminUser').value.trim();
  const password = document.getElementById('adminPass').value.trim();
  const err = document.getElementById('adminError');
  const res = await POST('/api/login/admin', { username, password });
  if (res.ok) {
    err.style.display = 'none';
    showPage('adminPage');
    await loadAdminPage();
    showToast('Admin logged in! 🛡️', 'success');
  } else {
    err.style.display = 'block';
  }
}

async function logout() {
  await POST('/api/logout');
  currentUser = null;
  myVotedIds  = [];
  showPage('loginPage');
  showToast('Logged out.', 'success');
}

// ─── Student: Tab Switch ─────────────────────────────────────────
async function showStudentTab(tab) {
  document.querySelectorAll('.nav-tab').forEach((b,i) => b.classList.toggle('active', i===(tab==='vote'?0:1)));
  document.getElementById('voteTab').style.display    = tab==='vote'    ? 'block' : 'none';
  document.getElementById('resultsTab').style.display = tab==='results' ? 'block' : 'none';
  if (tab === 'results') await renderResultsTab();
}

// ─── Vote Tab ────────────────────────────────────────────────────
async function loadVoteTab() {
  const [events, myVotes, stats] = await Promise.all([
    GET('/api/events'),
    GET('/api/my-votes'),
    GET('/api/stats')
  ]);
  myVotedIds = myVotes;

  document.getElementById('totalEventsCount').textContent = stats.events;
  document.getElementById('totalVotesCount').textContent  = stats.votes;
  document.getElementById('myVotesCount').textContent     = myVotes.length;

  const maxV = Math.max(...events.map(e => e.votes || 0), 1);
  const grid = document.getElementById('eventsGrid');

  if (!events.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>No events yet. Check back later!</p></div>`;
    return;
  }

  grid.innerHTML = events.map((evt, i) => {
    const voted = myVotedIds.includes(evt.id);
    const pct   = Math.round((evt.votes / maxV) * 100);
    return `
      <div class="event-card" style="animation-delay:${i*0.08}s">
        <span class="event-tag tag-${evt.category}">${evt.category}</span>
        <div class="event-title">${evt.name}</div>
        <div class="event-meta">
          <span>📅 <b>${fmtDate(evt.date)}</b></span>
          <span>📍 <b>${evt.venue}</b></span>
          <span>📝 ${evt.desc}</span>
        </div>
        <div class="vote-bar-wrap">
          <div class="vote-bar-label"><span>${evt.votes} votes</span><span>${pct}%</span></div>
          <div class="vote-bar-bg"><div class="vote-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <button class="btn-vote ${voted?'voted':''}" ${voted?'disabled':''} onclick="castVote('${evt.id}')">
          ${voted ? '✅ Voted!' : '🗳️ Cast Vote'}
        </button>
      </div>`;
  }).join('');
}

async function castVote(evtId) {
  const res = await POST(`/api/vote/${evtId}`);
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast('🎉 Vote cast successfully!', 'success');
  await loadVoteTab();
}

// ─── Results Tab ─────────────────────────────────────────────────
async function renderResultsTab() {
  const events = (await GET('/api/events')).sort((a,b) => b.votes - a.votes);
  const maxV   = Math.max(...events.map(e => e.votes || 0), 1);
  const totalV = events.reduce((s,e) => s+(e.votes||0), 0);
  const fills    = ['fill-gold','fill-silver','fill-bronze','fill-default'];
  const rankSyms = ['🥇','🥈','🥉'];
  const rankCls  = ['gold','silver','bronze'];
  const grid = document.getElementById('resultsGrid');

  if (!events.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">📊</div><p>No results yet!</p></div>`;
    return;
  }

  grid.innerHTML = events.map((evt, i) => {
    const pct  = Math.round((evt.votes/maxV)*100);
    const vPct = totalV>0 ? Math.round((evt.votes/totalV)*100) : 0;
    return `
      <div class="result-card" style="animation-delay:${i*0.08}s">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div class="result-rank ${rankCls[i]||''}">${rankSyms[i]||`#${i+1}`}</div>
          <span class="event-tag tag-${evt.category}">${evt.category}</span>
        </div>
        <div class="event-title">${evt.name}</div>
        <div class="event-meta">
          <span>📅 <b>${fmtDate(evt.date)}</b></span>
          <span>📍 <b>${evt.venue}</b></span>
        </div>
        <div class="result-votes">${evt.votes} <span style="font-size:13px;color:var(--muted)">(${vPct}% of votes)</span></div>
        <div class="result-bar-bg"><div class="result-bar-fill ${fills[Math.min(i,3)]}" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

// ─── Admin Page ───────────────────────────────────────────────────
async function loadAdminPage() {
  await Promise.all([renderAdminEvents(), updateAdminStats()]);
}

async function addEvent() {
  const name  = document.getElementById('evtName').value.trim();
  const cat   = document.getElementById('evtCategory').value;
  const date  = document.getElementById('evtDate').value;
  const venue = document.getElementById('evtVenue').value.trim();
  const desc  = document.getElementById('evtDesc').value.trim();
  const err   = document.getElementById('evtError');
  const succ  = document.getElementById('evtSuccess');

  if (!name||!date||!venue||!desc) { err.style.display='block'; succ.style.display='none'; return; }
  err.style.display = 'none';

  const res = await POST('/api/events', { name, category: cat, date, venue, desc });
  if (res.ok) {
    ['evtName','evtDate','evtVenue','evtDesc'].forEach(id => document.getElementById(id).value='');
    succ.style.display='block';
    setTimeout(()=>succ.style.display='none', 3000);
    await loadAdminPage();
    showToast('Event added! ✅', 'success');
  }
}

async function deleteEvent(id) {
  if (!confirm('Delete this event and its votes?')) return;
  await DEL(`/api/events/${id}`);
  await loadAdminPage();
  showToast('Event deleted.', 'error');
}

async function renderAdminEvents() {
  const events = await GET('/api/events');
  const list   = document.getElementById('adminEventsList');
  if (!events.length) {
    list.innerHTML = `<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px">No events yet!</div>`;
    return;
  }
  list.innerHTML = events.map(evt => `
    <div class="admin-event-item">
      <div class="admin-event-info">
        <div class="title">${evt.name}</div>
        <div class="sub">${evt.category} &bull; ${fmtDate(evt.date)} &bull; ${evt.venue} &bull; <b style="color:var(--accent)">${evt.votes} votes</b></div>
      </div>
      <button class="btn-danger" onclick="deleteEvent('${evt.id}')">Delete</button>
    </div>`).join('');
}

async function updateAdminStats() {
  const stats = await GET('/api/stats');
  document.getElementById('adminTotalEvents').textContent   = stats.events;
  document.getElementById('adminTotalVotes').textContent    = stats.votes;
  document.getElementById('adminTotalStudents').textContent = stats.voters;
}

// ─── Helpers ─────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return 'TBD';
  return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}
