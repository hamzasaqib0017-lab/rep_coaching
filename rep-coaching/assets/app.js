// Rep Coaching app — renders every tab from APP (scripts/assemble.rb), DIM_CONTENT_LIB and DIM_INSIGHTS (from content.json).
// Scores are the dashboard's combined 0–10 per-dimension rep averages. Priorities are personal (2026-10-08):
// engine weight × (10 − score) × (team rank ÷ team size)², so a skill climbs the list when it matters, the rep is far
// from a perfect 10, and the rep sits near the bottom of the team on it. The dashboard's own rule (weight × gap)
// gave all 11 reps the same top three. Coaching text per skill quotes the rep's own calls (APP.ev).
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f2 = v => Number(v).toFixed(2);
  const f1 = v => Number(v).toFixed(1);
  const band = v => v < 4 ? 'weak' : (v < 6 ? 'building' : 'strong');
  const BAND_LABEL = { weak: 'Weak', building: 'Building', strong: 'Strong' };
  const BAND_COLOR = { weak: 'var(--weak)', building: 'var(--building)', strong: 'var(--strong)' };
  const $ = id => document.getElementById(id);

  const DIMS = APP.dims;
  const MEDDIC = DIMS.filter(d => d.fw === 'meddic');
  const SANDLER = DIMS.filter(d => d.fw === 'sandler');
  const FW_NAME = { meddic: 'MEDDIC', sandler: 'Sandler' };
  const REPS = APP.reps;                                   // sorted by MEDDIC + Sandler, best first
  const TEAM = {};
  DIMS.forEach(d => { TEAM[d.label] = REPS.reduce((s, r) => s + r.scores[d.label], 0) / REPS.length; });
  const TEAM_M = REPS.reduce((s, r) => s + r.m, 0) / REPS.length;
  const TEAM_S = REPS.reduce((s, r) => s + r.s, 0) / REPS.length;

  const N = REPS.length;
  const rankOf = (label, v) => REPS.filter(x => x.scores[label] > v).length + 1;          // 1 = best on the team
  const BEST = {};
  DIMS.forEach(d => { BEST[d.label] = REPS.slice().sort((a, b) => b.scores[d.label] - a.scores[d.label])[0]; });
  // Every skill for one rep, highest priority first; weight-0 skills (Upfront Contract) sort last.
  const ranked = r => DIMS.map(d => {
    const v = r.scores[d.label], rank = rankOf(d.label, v);
    return { d, v, rank, p: d.weight * (10 - v) * Math.pow(rank / N, 2) };
  }).sort((a, b) => (b.d.weight > 0) - (a.d.weight > 0) || b.p - a.p);
  const priorities = r => ranked(r).slice(0, 3);
  const ordinal = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fdate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : esc(s); };

  // ── tooltip for heat cells and bars ──
  const tip = $('tip');
  document.addEventListener('mouseover', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.innerHTML = t.dataset.tip; tip.hidden = false;
  });
  document.addEventListener('mousemove', e => {
    if (tip.hidden) return;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + tip.offsetWidth > innerWidth - 10) x = e.clientX - tip.offsetWidth - 14;
    if (y + tip.offsetHeight > innerHeight - 10) y = e.clientY - tip.offsetHeight - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });

  // ── tabs (hash routing so a tab can be linked or screenshotted directly) ──
  const TABS = ['start', 'frameworks', 'weights', 'team', 'coaching', 'build'];
  function show(tab, anchor) {
    if (!TABS.includes(tab)) tab = 'start';
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (location.hash.replace('#', '') !== tab) history.replaceState(null, '', '#' + tab);
    if (anchor) { const el = $(anchor); if (el) setTimeout(() => el.scrollIntoView(), 30); }
    else window.scrollTo(0, 0);
  }
  document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
  // Switch tab through its nav button so listeners on the buttons (the hover glossary) run too.
  function goTab(tab, anchor) {
    const btn = document.querySelector(`nav.tabs button[data-tab="${tab}"]`);
    if (btn) btn.click();
    show(tab, anchor);
  }
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => goTab(b.dataset.go, b.dataset.anchor)));

  // ═════════════ TEAM SUMMARY: four numbers, each opens an explanation below the row ═════════════
  let openStat = null;
  function teamFacts() {
    const weakest = DIMS.slice().sort((a, b) => TEAM[a.label] - TEAM[b.label])[0];
    const counts = {};
    REPS.forEach(r => { const top = priorities(r)[0].d.label; counts[top] = (counts[top] || 0) + 1; });
    const [topFix, topN] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const plans = new Set(REPS.map(r => priorities(r).map(x => x.d.label).sort().join())).size;
    return { weakest, counts, topFix, topN, plans };
  }

  function renderStart() {
    $('start-eyebrow').textContent = `Rep coaching system · ${REPS.length} reps · 13 dimensions`;
    const f = teamFacts();
    const stats = [
      { k: 'meddic', v: `${f1(TEAM_M)}<small> /10</small>`, l: 'Team MEDDIC average', d: 'How well the team uncovers the six facts about the buyer.' },
      { k: 'sandler', v: `${f1(TEAM_S)}<small> /10</small>`, l: 'Team Sandler average', d: 'How well the team runs the seven steps of the conversation.' },
      { k: 'weakest', v: `${esc(f.weakest.label)}<small> ${f1(TEAM[f.weakest.label])}</small>`, l: 'Weakest team skill', d: `The lowest-scoring of the 13 skills across all ${N} reps.` },
      { k: 'fix', v: `${f.topN}<small> of ${N}</small>`, l: `Reps whose #1 fix is ${esc(f.topFix)}`, d: `Plans are personal: ${f.plans} different top-three plans across ${N} reps.` }
    ];
    $('start-stats').innerHTML = stats.map(s => `<button type="button" class="stat${openStat === s.k ? ' open' : ''}" data-stat="${s.k}" aria-expanded="${openStat === s.k}" aria-controls="stat-detail"><div class="v num">${s.v}</div><div class="l">${s.l}</div><div class="d">${s.d}</div><span class="more">${openStat === s.k ? 'Hide ▴' : 'What this means ▾'}</span></button>`).join('');
    $('start-stats').querySelectorAll('button.stat').forEach(b => b.addEventListener('click', () => {
      openStat = openStat === b.dataset.stat ? null : b.dataset.stat;
      renderStart();
    }));
    renderStatDetail(f);
  }

  function repBars(valueOf, label) {
    return REPS.slice().sort((a, b) => valueOf(a) - valueOf(b)).map(r => {
      const v = valueOf(r), b = band(v);
      return `<div class="bar-row" data-tip="${esc(`<b>${esc(r.rep)}</b><br>${esc(label)}: <b>${f2(v)}</b>`)}"><span>${esc(r.rep)}</span><span class="bar-track"><span class="bar-fill" style="width:${(v * 10).toFixed(1)}%;background:${BAND_COLOR[b]}"></span></span><span class="bar-val num">${f1(v)}</span></div>`;
    }).join('');
  }

  function frameworkDetail(fw, f) {
    const list = fw === 'meddic' ? MEDDIC : SANDLER;
    const avg = fw === 'meddic' ? TEAM_M : TEAM_S;
    const byTeam = list.slice().sort((a, b) => TEAM[a.label] - TEAM[b.label]);
    const low = byTeam.slice(0, 2), high = byTeam[byTeam.length - 1];
    const heavy = list.slice().sort((a, b) => b.weight - a.weight)[0];
    const share = Math.round(avg * 10);
    const what = fw === 'meddic'
      ? `On a typical deal the team gathers about ${share}% of the buyer facts MEDDIC asks for. The deal looks real, but key facts are missing when it reaches the forecast.`
      : `On a typical call the team runs about ${share}% of the Sandler steps well. Conversations go smoothly, but some steps get skipped or rushed.`;
    return `<h3>${FW_NAME[fw]} average: ${f1(avg)} out of 10</h3><div class="sd-grid"><div>
      <h5>What it means</h5><p>${what}</p>
      <h5>Where the gap is</h5><p>Weakest across the team: <b>${esc(low[0].label)}</b> (${f1(TEAM[low[0].label])}) and <b>${esc(low[1].label)}</b> (${f1(TEAM[low[1].label])}). Strongest: <b>${esc(high.label)}</b> (${f1(TEAM[high.label])}). ${low.some(d => d === heavy) || low.some(d => d.weight >= 20) ? `That matters, because ${esc(heavy.label)} carries the biggest ${FW_NAME[fw]} weight (${heavy.weight}%).` : ''}</p>
      <h5>What to do about it</h5><ul><li>Run one team session on <b>${esc(low[0].label)}</b>: ${esc((DIM_INSIGHTS[low[0].label] || {}).practice || '')}</li><li>Pair the lowest reps on the right with the highest for a call review.</li><li>Check each rep's own plan on the Rep Coaching tab; their top three already reflect this.</li></ul>
    </div><div class="sd-bars"><h5>Each rep's ${FW_NAME[fw]} average</h5>${repBars(r => fw === 'meddic' ? r.m : r.s, FW_NAME[fw] + ' average')}</div></div>`;
  }

  function renderStatDetail(f) {
    const el = $('stat-detail');
    if (!openStat) { el.hidden = true; el.innerHTML = ''; return; }
    const color = { meddic: 'var(--indigo)', sandler: 'var(--coral)', weakest: 'var(--amber)', fix: 'var(--sage)' }[openStat];
    el.style.setProperty('--c', color);
    let html = '';
    if (openStat === 'meddic' || openStat === 'sandler') html = frameworkDetail(openStat, f);
    if (openStat === 'weakest') {
      const d = f.weakest, ins = DIM_INSIGHTS[d.label] || {}, c = DIM_CONTENT_LIB[d.label] || { qs: [] };
      const under4 = REPS.filter(r => r.scores[d.label] < 4).length;
      html = `<h3>${esc(d.label)} is the team's weakest skill: ${f1(TEAM[d.label])} out of 10</h3><div class="sd-grid"><div>
        <h5>What it means</h5><p>${esc(d.plain)} ${under4} of ${N} reps score under 4 on it, so this is a team habit, not one rep's problem. ${esc(ins.why_low || '')}</p>
        <h5>Why it tends to matter</h5><p>${esc(d.reason)}</p>
        <h5>Team drill</h5><p class="drill">${esc(ins.practice || '')}</p>
        ${(c.qs || []).length ? `<h5>Questions every rep should ask</h5><ul>${c.qs.slice(0, 3).map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
      </div><div class="sd-bars"><h5>Each rep's ${esc(d.label)} score</h5>${repBars(r => r.scores[d.label], d.label)}</div></div>`;
    }
    if (openStat === 'fix') {
      const rows = REPS.map(r => { const p = priorities(r)[0]; return `<div class="fix-row"><span>${esc(r.rep)}</span><span><span class="pill ${p.d.fw}">${esc(p.d.label)}</span> <span class="num" style="color:var(--muted);font-size:13px">${f2(p.v)} · ${ordinal(p.rank)} of ${N}</span></span></div>`; }).join('');
      const others = Object.entries(f.counts).filter(([k]) => k !== f.topFix).map(([k, n]) => `${esc(k)} (${n})`).join(', ');
      html = `<h3>${f.topN} of ${N} reps share the same #1 fix: ${esc(f.topFix)}</h3><div class="sd-grid"><div>
        <h5>What it means</h5><p>Each rep's #1 fix is the skill that costs them the most deals, judged on three things: how much it moves the odds of winning, how far they are from a perfect 10, and where they rank on the team. ${f.topN} reps land on ${esc(f.topFix)}; the rest are spread across ${others || 'other skills'}.</p>
        <h5>What to do about it</h5><ul><li>Coach ${esc(f.topFix)} as a group with the ${f.topN} reps who share it; it saves ${f.topN - 1} separate sessions.</li><li>Coach everyone else one-to-one on their own #1.</li><li>Open any rep on the Rep Coaching tab for their full plan, with excerpts from their own calls.</li></ul>
      </div><div><h5>Every rep's #1 fix</h5><div class="fix-list">${rows}</div></div></div>`;
    }
    el.innerHTML = html; el.hidden = false;
  }

  // ═════════════ REP COACHING ═════════════
  let selected = REPS[0].rep;
  try { const saved = localStorage.getItem('bw-coach-rep'); if (saved && REPS.some(r => r.rep === saved)) selected = saved; } catch (e) {}

  function select(rep, scroll) {
    selected = rep;
    try { localStorage.setItem('bw-coach-rep', rep); } catch (e) {}
    renderPicker(); renderProfile(); renderHeat();
    if (scroll) $('profile').scrollIntoView({ block: 'start' });
  }

  function renderPicker() {
    $('picker').innerHTML = REPS.map(r =>
      `<button type="button" class="chip${r.rep === selected ? ' active' : ''}" data-rep="${esc(r.rep)}" aria-pressed="${r.rep === selected}"><strong>${esc(r.rep)}</strong><span class="num">MEDDIC ${f1(r.m)} · Sandler ${f1(r.s)}</span></button>`).join('');
    $('picker').querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => select(c.dataset.rep)));
  }

  function barRow(d, v) {
    const b = band(v), t = TEAM[d.label];
    const tipHtml = `<b>${esc(d.label)}</b> · ${FW_NAME[d.fw]}<br>${esc(selected)}: <b>${f2(v)}</b> (${BAND_LABEL[b]})<br>Team average: ${f2(t)}<br>Engine weight: ${d.weight}%`;
    return `<div class="bar-row" data-tip="${esc(tipHtml)}"><span>${esc(d.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${(v * 10).toFixed(1)}%;background:${BAND_COLOR[b]}"></span><span class="bar-tick" style="left:calc(${(t * 10).toFixed(1)}% - 1.5px)"></span></span><span class="bar-val num">${f2(v)}</span></div>`;
  }

  // ── coaching for one rep on one skill, built from their own calls ──
  function standing(x, r) {
    const t = TEAM[x.d.label], best = BEST[x.d.label];
    const delta = x.v - t;
    return { t, best, delta, isBest: best.rep === r.rep,
      lift: x.d.weight / 10 * Math.max(best.scores[x.d.label] - x.v, 0) };
  }

  function verdict(x, r) {
    const s = standing(x, r);
    if (x.d.weight === 0) return 'Does not predict wins in this data. Keep it light: agree the agenda in the first minute, then move on.';
    if (s.isBest) return `The team's best at this. Keep doing it, and show others how you do it.`;
    if (x.rank <= 3) return `Top three on the team (${ordinal(x.rank)}). A strength to protect.`;
    if (s.delta <= -0.3) return `${f1(-s.delta)} below the team average, ${ordinal(x.rank)} of ${N}. Next in line after your top three.`;
    if (x.v >= 6) return `Strong habit and around the team average. Maintain.`;
    return `Around the team average (${ordinal(x.rank)} of ${N}). Small, steady gains here.`;
  }

  function callSnippet(c, label) {
    return `<div class="call"><div class="call-meta"><span>${fdate(c.date)}</span><span>${esc(c.account)}</span><span class="call-score s${c.score}">${c.score}/5 ${label || ''}</span></div>
      <p class="call-what">${esc(c.what)}</p>${c.note ? `<p class="call-note"><b>Coach's note</b>${esc(c.note)}</p>` : ''}</div>`;
  }

  function goodExample(x, r) {
    const e = (APP.ev[r.rep] || {})[x.d.label] || {};
    // never hold up the same call as both the weak example (left) and the good one (right)
    const sameAsWeak = e.best && (e.worst || []).some(w => w.date === e.best.date && w.account === e.best.account);
    if (e.best && e.best.score >= 3 && !sameAsWeak) {
      return `<h5>You've done it before</h5><div class="call good"><div class="call-meta"><span>${fdate(e.best.date)}</span><span>${esc(e.best.account)}</span><span class="call-score s${e.best.score}">${e.best.score}/5</span></div><p class="call-what">${esc(e.best.what)}</p></div><p class="hint">Do on every call what you did on this one.</p>`;
    }
    const peer = (APP.ex[x.d.label] || []).find(p => p.rep !== r.rep);
    if (!peer) return '';
    return `<h5>What good sounds like · from ${esc(peer.rep)}</h5><div class="call good"><div class="call-meta"><span>${fdate(peer.date)}</span><span>${esc(peer.account)}</span><span class="call-score s${peer.score}">${peer.score}/5</span></div><p class="call-what">${esc(peer.what)}</p></div><p class="hint">Your best call on this skill scored ${e.best ? e.best.score : 0}/5. Ask ${esc(peer.rep.split(' ')[0])} to walk you through this one.</p>`;
  }

  function coachBody(x, r, full) {
    const c = DIM_CONTENT_LIB[x.d.label] || { what: '', fix: '', qs: [] };
    const ins = DIM_INSIGHTS[x.d.label] || {};
    const e = (APP.ev[r.rep] || {})[x.d.label] || { n: 0, worst: [] };
    const qs = (c.qs || []).slice(0, full ? 3 : 2);
    const pattern = e.n
      ? `On <b>${e.absent} of your ${e.n}</b> recorded calls this barely came up (0–1 of 5). On <b>${e.strong}</b> it was strong (4–5). Your average call score: <b>${e.avg}/5</b>.`
      : 'No recorded calls for this rep yet; coaching below is from the team library.';
    const worst = (e.worst || []).slice(0, full ? 2 : 1);
    return `<div class="coach-grid">
      <div>
        <h5>What your calls show</h5><p class="pattern">${pattern}</p>
        ${worst.map(w => callSnippet(w)).join('')}
      </div>
      <div>
        ${goodExample(x, r)}
        <h5>${x.v < 6 ? 'Likely cause' : 'How to push it further'}</h5><p>${esc(x.v < 6 ? ins.why_low : ins.how_extend)}</p>
        <h5>This week's drill</h5><p class="drill">${esc(ins.practice || c.fix.replace(/<[^>]+>/g, ''))}</p>
        ${qs.length ? `<h5>Ask on your next call</h5><ul class="asks">${qs.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>
    ${full ? '' : `<p class="measures"><b>What it measures.</b> ${c.what}</p>`}`;
  }

  function topCard(x, i, r) {
    const s = standing(x, r), b = band(x.v);
    const why = `${esc(x.d.label)} carries ${x.d.weight}% of the ${FW_NAME[x.d.fw]} weight, you are ${f1(10 - x.v)} points from a perfect 10, and you rank ${ordinal(x.rank)} of ${N} on the team.`;
    const target = s.isBest
      ? `You already lead the team here; the next step is consistency, not catching up.`
      : `Closing the gap to ${esc(s.best.rep)} (${f1(s.best.scores[x.d.label])}) is worth about <b>+${f1(s.lift)} points</b> of ${FW_NAME[x.d.fw]} win chance on a typical deal.`;
    return `<article class="coach-card c${i}">
      <header>
        <span class="n">#${i + 1}</span>
        <div class="coach-title"><h3>${esc(x.d.label)} <span class="pill ${x.d.fw}">${FW_NAME[x.d.fw]}</span></h3>
          <div class="facts"><span class="score-chip h-${b} num">${f2(x.v)}</span><span>${ordinal(x.rank)} of ${N} on the team</span><span>Team average ${f1(s.t)}</span><span>Best: ${esc(s.best.rep)} ${f1(s.best.scores[x.d.label])}</span></div></div>
      </header>
      <p class="why"><b>Why it's #${i + 1}.</b> ${why} ${target}</p>
      ${coachBody(x, r, true)}
    </article>`;
  }

  function restRow(x, r) {
    const s = standing(x, r), b = band(x.v);
    const sign = s.delta >= 0 ? '+' : '−';
    return `<details class="dim"><summary>
        <span class="score-chip h-${b} num">${f2(x.v)}</span>
        <span class="dim-name">${esc(x.d.label)} <span class="pill ${x.d.fw}">${FW_NAME[x.d.fw]}</span></span>
        <span class="dim-rank num">${ordinal(x.rank)} of ${N}</span>
        <span class="dim-delta num ${Math.abs(s.delta) < 0.05 ? '' : s.delta > 0 ? 'up' : 'down'}">${Math.abs(s.delta) < 0.05 ? 'level with team' : `${sign}${f1(Math.abs(s.delta))} vs team`}</span>
        <span class="dim-verdict">${esc(verdict(x, r))}</span>
      </summary><div class="dim-body2">${coachBody(x, r, false)}</div></details>`;
  }

  function renderProfile() {
    const r = REPS.find(x => x.rep === selected);
    const rank = REPS.indexOf(r) + 1;
    const all = ranked(r);
    const tileTxt = (v, team) => v >= team ? `${f1(v - team)} above team` : `${f1(team - v)} below team`;
    const sortWeak = list => list.slice().sort((a, b) => r.scores[a.label] - r.scores[b.label]);
    $('profile').innerHTML = `
      <div class="profile-top">
        <div><h2>${esc(r.rep)}</h2><div class="meta">${esc(r.division)} · ${r.opps} deals owned · ${r.scored} scored from calls or emails · ${r.with_calls} with recorded calls</div><span class="rank">#${rank} of ${N} on combined MEDDIC + Sandler</span></div>
        <div class="tiles">
          <div class="tile m"><div class="v num">${f1(r.m)}<small> /10</small></div><div class="l">MEDDIC</div><div class="t">${tileTxt(r.m, TEAM_M)}</div></div>
          <div class="tile s"><div class="v num">${f1(r.s)}<small> /10</small></div><div class="l">Sandler</div><div class="t">${tileTxt(r.s, TEAM_S)}</div></div>
        </div>
      </div>
      <div class="profile-body">
        <p class="label">Your top 3 this week · ranked for ${esc(r.rep.split(' ')[0])}, not the team</p>
        <p class="rule-note">Each skill is ranked by how much it moves the odds of winning, how far you are from a perfect 10, and where you sit on the team. Being near the bottom of the team on a skill counts most.</p>
        ${all.slice(0, 3).map((x, i) => topCard(x, i, r)).join('')}
        <div class="bars-grid">
          <div><p class="label">MEDDIC skills · weakest first</p>${sortWeak(MEDDIC).map(d => barRow(d, r.scores[d.label])).join('')}</div>
          <div><p class="label">Sandler skills · weakest first</p>${sortWeak(SANDLER).map(d => barRow(d, r.scores[d.label])).join('')}</div>
        </div>
        <div class="legend"><span><i style="background:var(--weak)"></i>Under 4</span><span><i style="background:var(--building)"></i>4–6</span><span><i style="background:var(--strong)"></i>6+</span><span><i class="tick"></i>Team average</span></div>
        <p class="label" style="margin-top:32px">The other ${all.length - 3} skills · in priority order, each coached from your calls</p>
        ${all.slice(3).map(x => restRow(x, r)).join('')}
      </div>`;
  }

  function renderHeat() {
    const cell = (r, d) => {
      const v = r.scores[d.label], b = band(v);
      const tipHtml = `<b>${esc(r.rep)}</b><br>${esc(d.label)}: <b>${f2(v)}</b> (${BAND_LABEL[b]})<br>Team average: ${f2(TEAM[d.label])}`;
      return `<td class="h-${b} num" data-col="${DIMS.indexOf(d)}" data-tip="${esc(tipHtml)}">${f1(v)}</td>`;
    };
    const head = `<thead><tr><th></th><th class="fw m" colspan="${MEDDIC.length}">MEDDIC</th><th class="fw s" colspan="${SANDLER.length}">Sandler</th></tr>
      <tr><th style="text-align:left">Rep</th>${DIMS.map((d, i) => `<th data-col="${i}">${esc(d.label)}<span class="w num">${d.weight}%</span></th>`).join('')}</tr></thead>`;
    const rows = REPS.map(r => `<tr><td class="rep" data-rep="${esc(r.rep)}" tabindex="0">${esc(r.rep)}</td>${DIMS.map(d => cell(r, d)).join('')}</tr>`).join('');
    const team = `<tr class="team"><td class="rep">Team average</td>${DIMS.map(d => `<td class="num" data-col="${DIMS.indexOf(d)}" data-tip="${esc(`<b>Team average</b><br>${esc(d.label)}: <b>${f2(TEAM[d.label])}</b>`)}">${f1(TEAM[d.label])}</td>`).join('')}</tr>`;
    $('heat').innerHTML = head + `<tbody>${rows}${team}</tbody>`;
    // Crosshair: hovering a score lights up its rep (row) and skill (column) headers.
    const heat = $('heat');
    const clearHl = () => heat.querySelectorAll('.hl,.hcell').forEach(e => e.classList.remove('hl', 'hcell'));
    heat.onmouseover = e => {
      const td = e.target.closest('td[data-col]'); clearHl(); if (!td) return;
      td.classList.add('hcell');
      const rep = td.parentElement.querySelector('td.rep'); if (rep) rep.classList.add('hl');
      const th = heat.querySelector(`th[data-col="${td.dataset.col}"]`); if (th) th.classList.add('hl');
    };
    heat.onmouseleave = clearHl;
    $('heat').querySelectorAll('td.rep[data-rep]').forEach(td => {
      const go = () => { goTab('coaching'); select(td.dataset.rep, true); };
      td.addEventListener('click', go);
      td.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  // ═════════════ MEDDIC & SANDLER 101 ═════════════
  function letterCard(d, i, mark) {
    const c = DIM_CONTENT_LIB[d.label] || { qs: [] };
    const ask = (c.qs || [])[0];
    const share = d.weight / Math.max(...DIMS.map(x => x.weight)) * 100;
    const wonLost = d.anti
      ? `In ${esc(APP.company.name)}'s data, won deals scored this slightly <em>lower</em> than lost deals${d.won ? ` (${d.won} vs ${d.lost} per call)` : ''}, so the engine gives it no weight. Still good practice; it just doesn't predict the result.`
      : d.won ? `Per call, won deals average ${d.won} and lost deals ${d.lost} on the 0–5 scale. One extra point moves the predicted chance of winning by about ${f1(d.weight / 10)} percentage points.`
      : `Not enough closed deals with calls yet to compare won and lost calls. One extra point is worth about ${f1(d.weight / 10)} percentage points at the current weight.`;
    return `<article class="letter-card" id="dim-${d.key}">
      <div class="lc-top"><span class="big-letter c${i % 7}">${esc(mark)}</span><div><h4>${esc(d.label)}<span class="pill ${d.fw}">${FW_NAME[d.fw]}</span></h4><div class="plain">${esc(d.plain)}</div></div></div>
      <div class="lc-body">
        <div><p class="label" style="margin-bottom:6px">The question it answers</p><div>${esc(d.question)}</div></div>
        ${ask ? `<div class="lc-q">${esc(ask)}</div>` : ''}
        <div><p class="label" style="margin-bottom:8px">What the score sounds like</p><div class="ladder">
          ${['1', '3', '5'].map(k => `<div class="rung r${k}"><b>${k}</b><span>${esc(d.ex[k] || '')}</span></div>`).join('')}
        </div></div>
        <div class="weight"><div class="weight-row"><span>Engine weight</span><span class="num">${d.weight}%</span></div>
          <div class="weight-track"><span class="weight-fill" style="width:${share.toFixed(1)}%"></span></div>
          <div class="weight-note">${wonLost}</div></div>
      </div></article>`;
  }

  function renderFrameworks() {
    $('overlap').innerHTML = (APP.overlaps || []).map(o => `<div class="ov"><div class="ov-pair"><span class="a">${esc(o.a)}</span><i>≈</i><span class="b">${esc(o.b)}</span></div><p>${o.text}</p></div>`).join('');
    $('meddic-cards').innerHTML = MEDDIC.map((d, i) => letterCard(d, i, d.letter)).join('');
    $('sandler-cards').innerHTML = SANDLER.map((d, i) => letterCard(d, i + 1, String(i + 1))).join('') +
      `<article class="letter-card rule"><div><span class="kicker">The submarine rule</span><h4>Seal it before you open the next one.</h4></div><p>Rapport and an upfront contract earn the right to ask about pain. Pain earns the right to talk budget. Budget and decision earn the right to present. Postsell stops the deal sinking between calls.</p><button type="button" id="to-quiz">Test yourself ↓</button></article>`;
    $('to-quiz').addEventListener('click', () => $('quiz').scrollIntoView({ block: 'center' }));
    $('sub-rail').innerHTML = SANDLER.map((d, i) => `<a href="#dim-${d.key}" class="c${(i + 1) % 7}" aria-label="Step ${i + 1}: ${esc(d.label)}">${i + 1}</a>`).join('');
    $('sub-names').innerHTML = SANDLER.map(d => `<span>${esc(d.label)}</span>`).join('');
    $('sub-rail').querySelectorAll('a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const el = document.querySelector(a.getAttribute('href')); if (el) el.scrollIntoView({ block: 'center' }); }));

    const eb = DIMS.slice().sort((a, b) => b.weight - a.weight)[0];
    $('weight-example').textContent = `${eb.label}: weight ${eb.weight}% → +1 point ≈ +${f1(eb.weight / 10)} points of win chance`;
    const r = REPS[REPS.length - 1], p = priorities(r)[0];
    $('prio-example').innerHTML = `Example: ${esc(r.rep)} scores ${f2(p.v)} on ${esc(p.d.label)} and ranks ${ordinal(p.rank)} of ${N}. ${p.d.weight} × ${f1(10 - p.v)} × (${p.rank} ÷ ${N})² = <strong>${Math.round(p.p)}</strong>, the largest of their 13, so it is their #1 priority. Every rep gets their own top three.`;

    const max = Math.max(...DIMS.map(d => d.weight));
    $('wchart').innerHTML = DIMS.slice().sort((a, b) => b.weight - a.weight).map(d =>
      `<div class="wrow" data-tip="${esc(`<b>${esc(d.label)}</b> · ${FW_NAME[d.fw]}<br>Engine weight ${d.weight}%<br>+1 point ≈ +${f1(d.weight / 10)} pts win chance`)}"><span>${esc(d.label)}</span><span class="wtrack"><span class="wbar ${d.fw}" style="width:${Math.max(d.weight / max * 100, 0.8).toFixed(1)}%"></span></span><span class="wval num">${d.weight}%</span></div>`).join('')
      + `<p class="weight-note" style="margin-top:12px">Weights add up to 100 inside each method, so a MEDDIC weight compares with other MEDDIC skills, and a Sandler weight with other Sandler skills.</p>`;
    renderQuiz();
  }

  // ═════════════ ENGINE WEIGHTS (from the closed deals in the user's own data) ═════════════
  function renderWeights() {
    const h = APP.history;
    $('ew-title').textContent = h.period ? `${h.deals} closed deals, ${h.period}.` : `${h.deals} closed deals.`;
    $('ew-source').textContent = h.note || '';
    const top = DIMS.slice().sort((a, b) => b.weight - a.weight)[0];
    $('ew-rule').innerHTML = `Rule of thumb: one extra point on a skill (out of 10) adds about <strong>weight ÷ 10</strong> percentage points to the chance of winning. ${esc(top.label)} at ${top.weight} means one more point is worth about ${f1(top.weight / 10)} points of win chance.`;
    const kpis = [
      { v: `${h.deals}`, l: 'Closed deals with scores', d: `Won or lost deals that have call or email scores${h.period ? `, ${h.period}` : ''}.` },
      { v: `${h.won}<small> won</small>`, l: h.base_wr == null ? 'Win rate –' : `Win rate ${h.base_wr}%`, d: `${h.lost} closed deals were lost.` },
      { v: `${h.calls.toLocaleString()}`, l: 'Recorded calls scored', d: 'Each one scored 0–5 on all 13 dimensions.' },
      { v: `${h.emails.toLocaleString()}`, l: 'Email threads scored', d: 'One per deal, merged with the call scores into one 0–10 score per deal.' }
    ];
    $('ew-kpis').innerHTML = kpis.map(s => `<div class="stat"><div class="v num">${s.v}</div><div class="l">${s.l}</div><div class="d">${s.d}</div></div>`).join('');

    const lo = 10, hi = 75, pos = v => ((v - lo) / (hi - lo) * 100).toFixed(1);
    const group = fw => {
      const list = DIMS.filter(d => d.fw === fw).sort((a, b) => b.weight - a.weight);
      return `<div class="dumb-head"><span><span class="fw-badge ${fw === 'meddic' ? 'm' : 's'}" style="background:var(--${fw === 'meddic' ? 'indigo' : 'coral'})">${FW_NAME[fw]}</span></span><span></span><span style="text-align:right">Weak → strong</span></div>` +
        list.map(d => {
          if (d.weak_wr == null || d.strong_wr == null) return `<div class="dumb-row"><span>${esc(d.label)}</span><span class="dumb-track"></span><span class="dumb-val">too few deals</span></div>`;
          const a = Math.min(d.weak_wr, d.strong_wr), b = Math.max(d.weak_wr, d.strong_wr);
          const tipHtml = `<b>${esc(d.label)}</b> · weight ${d.weight}%<br>Skill weak: won ${d.weak_wr}% of deals<br>Skill strong: won ${d.strong_wr}% of deals`;
          return `<div class="dumb-row" data-tip="${esc(tipHtml)}"><span>${esc(d.label)}</span><span class="dumb-track"><span class="dumb-line" style="left:${pos(a)}%;width:${(pos(b) - pos(a)).toFixed(1)}%"></span><span class="dumb-dot w" style="left:${pos(d.weak_wr)}%"></span><span class="dumb-dot s" style="left:${pos(d.strong_wr)}%"></span></span><span class="dumb-val num"><b>${d.weak_wr}%</b> → <b>${d.strong_wr}%</b></span></div>`;
        }).join('');
    };
    $('ew-dumbbell').innerHTML = group('meddic') + group('sandler') +
      `<div class="dumb-axis"><span></span><div><span>${lo}% win rate</span><span>${hi}%</span></div><span></span></div>
       <div class="legend"><span><i style="background:var(--weak);border-radius:50%"></i>Deals where the skill was weak (under 4)</span><span><i style="background:var(--strong);border-radius:50%"></i>Deals where it was strong (6+)</span><span>Overall win rate: ${h.base_wr}%</span></div>`;

    const cards = fw => DIMS.filter(d => d.fw === fw).sort((a, b) => b.weight - a.weight).map(d =>
      `<article class="ew-card ${fw}"><header><h4>${esc(d.label)}</h4><span class="wt num">${d.weight}%</span></header><p>${esc(d.reason)}</p>
        <div class="ew-stats"><span>Weak: won <b>${d.weak_wr == null ? '–' : d.weak_wr + '%'}</b></span><span>Strong: won <b>${d.strong_wr == null ? '–' : d.strong_wr + '%'}</b></span><span>+1 point ≈ <b>${d.anti ? '0' : '+' + f1(d.weight / 10)}</b> pts win chance</span></div></article>`).join('');
    $('ew-cards').innerHTML = ['meddic', 'sandler'].map(fw =>
      `<div class="ew-group"><span class="fw-badge ${fw === 'meddic' ? 'm' : 's'}" style="background:var(--${fw === 'meddic' ? 'indigo' : 'coral'})">${FW_NAME[fw]}</span><div class="ew-grid">${cards(fw)}</div></div>`).join('');
  }

  // ── Build Your Own: the system as a flow tree that splits and joins (inline SVG) ──
  // Inputs fan in to the master table; scoring splits into MEDDIC and Sandler; they join into the per-deal
  // combine (fed by engine weights); per-rep averages and checks follow; the result splits into the two views.
  function renderTree() {
    const k = APP.counts, n = v => Number(v).toLocaleString(), H = 52;
    const N = {
      calls:   [20, 30, 180, 'Call transcripts', `${n(k.calls)} calls`, 'indigo'],
      crm:     [20, 100, 180, 'CRM deals', `${n(k.deals)} deals`, 'indigo'],
      email:   [20, 170, 180, 'Email threads', `${n(k.threads)} deals`, 'indigo'],
      master:  [270, 100, 180, 'Master table', 'a row per deal and per call', 'navy'],
      score:   [510, 100, 170, 'AI scoring', 'one prompt, every call', 'coral'],
      meddic:  [750, 55, 170, 'MEDDIC', '6 skills', 'indigo', 'frameworks'],
      sandler: [750, 145, 170, 'Sandler', '7 skills', 'coral', 'frameworks'],
      combine: [60, 300, 190, 'Combine per deal', 'call + email → 0–10', 'amber'],
      weights: [60, 392, 190, 'Engine weights', 'learned from won vs lost', 'amber', 'weights'],
      perrep:  [330, 300, 190, 'Average per rep', `${k.reps} reps × 13 skills`, 'sage'],
      checks:  [600, 300, 180, 'Safety checks', 'table and page', 'sage'],
      team:    [870, 255, 190, 'Team Summary', 'every rep, every skill', 'indigo', 'team'],
      coach:   [870, 345, 190, 'Rep Coaching', 'top three per rep', 'coral', 'coaching']
    };
    const node = ([x, y, w, t, s, c, go]) => `<g class="fnode${go ? ' link' : ''}"${go ? ` data-leaf-go="${go}" tabindex="0" role="link" aria-label="${esc(t)}: open the ${esc(t)} tab"` : ''}>
      <rect x="${x}" y="${y}" width="${w}" height="${H}" rx="10" class="fn-box"/>
      <rect x="${x}" y="${y}" width="5" height="${H}" rx="2" style="fill:var(--${c})"/>
      <text x="${x + 16}" y="${y + 22}" class="fn-t">${esc(t)}${go ? ' ↗' : ''}</text>
      <text x="${x + 16}" y="${y + 40}" class="fn-s">${esc(s)}</text></g>`;
    const line = d => `<path d="${d}" class="fe"/>`;
    const arrow = d => `<path d="${d}" class="fe" marker-end="url(#fa)"/>`;
    const edges = [
      line('M200,56 H235 V126'), line('M200,196 H235 V126'), arrow('M200,126 H266'),          // inputs join
      arrow('M450,126 H506'),                                                                // table → scoring
      line('M680,126 H715'), line('M715,81 V171'), arrow('M715,81 H746'), arrow('M715,171 H746'), // split
      line('M920,81 H960'), line('M920,171 H960'), arrow('M960,81 V235 H155 V296'),          // join → combine
      arrow('M155,392 V356'),                                                                // weights → combine
      arrow('M250,326 H326'), arrow('M520,326 H596'),                                        // combine → rep → checks
      line('M780,326 H825'), line('M825,281 V371'), arrow('M825,281 H866'), arrow('M825,371 H866') // split
    ].join('');
    $('tree').innerHTML = `<svg class="flow" viewBox="0 0 1080 460" role="img" aria-labelledby="flow-title">
      <title id="flow-title">How the ${esc(APP.company.name)} rep coaching system flows: three inputs join into a master table, AI scoring splits into MEDDIC and Sandler, they join into a per-deal combined score informed by engine weights, then a per-rep average and safety checks, which split into Team Summary and Rep Coaching.</title>
      <defs><marker id="fa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="fa-head"/></marker></defs>
      ${edges}${Object.values(N).map(node).join('')}</svg>`;
    $('tree').querySelectorAll('[data-leaf-go]').forEach(el => {
      const go = () => goTab(el.dataset.leafGo);
      el.addEventListener('click', go);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  // ═════════════ BUILD YOUR OWN ═════════════
  function renderBuild() {
    const s = APP.sample;
    if (!s) { $('schema-table').innerHTML = '<tbody><tr><td>No calls scored yet, so there is no sample deal to show.</td></tr></tbody>'; $('walk').innerHTML = ''; $('prompt-sample').textContent = ''; $('output-sample').textContent = ''; return; }
    const trunc = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
    const cols = ['Deal ID', 'Call date', 'Rep', 'Account', 'Stage', 'Economic Buyer score', 'Economic Buyer reason', 'Economic Buyer coaching note', 'Postsell score', '… 11 more skills'];
    const base = [s.id, '<span class="blank">blank</span>', esc(s.owner), esc(s.account), esc(s.stage), '', '', '', '', ''];
    const callRows = s.calls.map(c => [s.id, fdate(c.date), esc(s.owner), esc(s.account), '', `<b>${c.eb}</b>`, esc(trunc(c.eb_why, 90)), esc(trunc(c.eb_note, 90)), `<b>${c.ps}</b>`, '…']);
    $('schema-table').innerHTML = `<thead><tr><th class="kind">Row</th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
      <tr class="crm"><td class="kind"><span class="rk crm">CRM row</span></td>${base.map(v => `<td>${v}</td>`).join('')}</tr>
      ${callRows.map((r, i) => `<tr><td class="kind"><span class="rk call">Call ${i + 1}</span></td>${r.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>`;

    const comb = (1 - (1 - s.eb_call / 5) * (1 - s.eb_email / 5)) * 10;
    const steps = [
      { n: 1, t: 'Score the call', b: `${s.eb_call}<small>/5</small>`, p: `On a call with ${esc(s.account)}, the model scored Economic Buyer ${s.eb_call} out of 5 and wrote why: <em>"${esc(trunc(s.calls[s.calls.length - 1].eb_why, 140))}"</em>` },
      { n: 2, t: 'Score the emails', b: `${s.eb_email}<small>/5</small>`, p: `The same rules on the deal's email thread gave ${s.eb_email} out of 5: <em>"${esc(trunc(s.eb_email_why, 140))}"</em>` },
      { n: 3, t: 'Combine them', b: `${f1(comb)}<small>/10</small>`, p: `(1 − (1 − ${s.eb_call}÷5) × (1 − ${s.eb_email}÷5)) × 10 = <b>${f1(comb)}</b>. When the call and the emails both show the skill, the deal scores higher than either source alone.` },
      { n: 4, t: 'Average per rep', b: `${s.rep_deals}<small> deals</small>`, p: `Do the same for every deal ${esc(s.owner.split(' ')[0])} owns, then average. That average is ${esc(s.owner.split(' ')[0])}'s Economic Buyer cell in the Team Summary grid.` }
    ];
    $('walk').innerHTML = steps.map((x, i) => `<div class="walk-step"><span class="wn">${x.n}</span><h4>${x.t}</h4><div class="wb num">${x.b}</div><p>${x.p}</p></div>${i < steps.length - 1 ? '<div class="walk-arrow" aria-hidden="true">→</div>' : ''}`).join('');

    const eb = DIMS.find(d => d.label === 'Economic Buyer');
    $('prompt-sample').textContent =
`## ECONOMIC BUYER  (MEDDIC · engine weight ${eb.weight}%)
Question: ${eb.question}
Listen for: ${trunc(eb.look_for, 220)}
Examples:
  1 = ${eb.ex['1']}
  3 = ${eb.ex['3']}
  5 = ${eb.ex['5']}
Return: meddic_economic_buyer_score (whole number 0-5),
        meddic_economic_buyer_reasoning (2-3 sentences, quote the call),
        meddic_economic_buyer_coaching_note (one next step for the rep).`;
    const c = s.calls[s.calls.length - 1];
    $('output-sample').textContent = JSON.stringify({
      'Opportunity ID': s.id, call_date: c.date,
      meddic_economic_buyer_score: c.eb,
      meddic_economic_buyer_reasoning: c.eb_why,
      meddic_economic_buyer_coaching_note: c.eb_note,
      sandler_postsell_score: c.ps,
      '…': '11 more skills, each with score, reasoning and coaching note'
    }, null, 2);
  }

  // ── quiz: describe a score-5 call, pick the skill ──
  const quiz = { order: [], i: 0, right: 0, done: 0 };
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function renderQuiz() {
    if (!quiz.order.length) quiz.order = shuffle(DIMS.slice());
    if (quiz.i >= quiz.order.length) {
      $('quiz').innerHTML = `<div class="quiz-top"><span class="eyebrow" style="margin:0">Round complete</span><span class="score num">${quiz.right} / ${quiz.done}</span></div>
        <div class="quiz-q">${quiz.right >= 10 ? 'Coach-level. You could run the next team 1:1.' : quiz.right >= 7 ? 'Solid. Skim the cards above for the ones you missed.' : 'Good start. The letter cards above have everything you need.'}</div>
        <button type="button" class="quiz-next" id="quiz-again">Play again</button>`;
      $('quiz-again').addEventListener('click', () => { Object.assign(quiz, { order: [], i: 0, right: 0, done: 0 }); renderQuiz(); });
      return;
    }
    const d = quiz.order[quiz.i];
    const others = shuffle(DIMS.filter(x => x !== d)).slice(0, 2);
    const opts = shuffle([d, ...others]);
    $('quiz').innerHTML = `<div class="quiz-top"><span class="eyebrow" style="margin:0">Round ${quiz.i + 1} of ${quiz.order.length} · a perfect 5 looks like…</span><span class="score num">${quiz.right} / ${quiz.done}</span></div>
      <div class="quiz-q">"${esc(d.ex['5'] || d.question)}"</div>
      <div class="quiz-opts">${opts.map(o => `<button type="button" data-k="${o.key}">${esc(o.label)} <span class="pill ${o.fw}" style="margin-left:6px">${FW_NAME[o.fw]}</span></button>`).join('')}</div>
      <div class="quiz-fb" id="quiz-fb" aria-live="polite"></div>`;
    $('quiz').querySelectorAll('.quiz-opts button').forEach(b => b.addEventListener('click', () => {
      const ok = b.dataset.k === d.key;
      quiz.done++; if (ok) quiz.right++;
      $('quiz').querySelectorAll('.quiz-opts button').forEach(x => { x.disabled = true; if (x.dataset.k === d.key) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      $('quiz').querySelector('.score').textContent = `${quiz.right} / ${quiz.done}`;
      $('quiz-fb').innerHTML = `${ok ? '<strong>Yes.</strong>' : `<strong>Not quite. It's ${esc(d.label)}.</strong>`} ${esc(d.plain)} <br><button type="button" class="quiz-next" id="quiz-next">${quiz.i + 1 < quiz.order.length ? 'Next round →' : 'See score →'}</button>`;
      $('quiz-next').addEventListener('click', () => { quiz.i++; renderQuiz(); });
    }));
  }

  // ── boot ──
  $('gen-at').textContent = `Data generated ${APP.generated_at}.`;
  renderStart(); renderPicker(); renderProfile(); renderHeat(); renderFrameworks(); renderWeights(); renderBuild(); renderTree();
  const h = location.hash.replace('#', '');
  if (h && h !== 'start') show(h);
  window.__coach = { REPS, DIMS, TEAM, priorities, select, show };
})();
