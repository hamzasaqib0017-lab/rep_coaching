// ── Hover glossary ───────────────────────────────────────────────────────────
// Underlines every technical term (from build/glossary.rb) wherever it appears in the active tab and
// shows a callout with its meaning on hover, keyboard focus, or tap. Spliced in by step 6 of
// build_dashboard.rb; the JSON placeholder on the GL line is replaced with the term list at build time.
//
// Design notes
//  - Matching is case-sensitive and whole-word so "Stage", "Heat", "Budget" only light up in their
//    label form, not every time the ordinary word is used in prose.
//  - One callout per term per block (a table row, a KPI card, a paragraph, a heading). A term that
//    appears three times in one paragraph is underlined once; re-underlining it adds nothing.
//  - Tabs render their content on demand, so a MutationObserver re-annotates whatever the renderers
//    add. Only the active panel is touched: annotating hidden panels would cost time for nothing.
//  - The callout is one fixed-position element reused for every term, positioned below the term
//    and flipped above it when there is no room.
(function () {
  const GL = __GLOSSARY_JSON__;
  if (!Array.isArray(GL) || !GL.length) return;

  const map = new Map(); const keys = [];
  GL.forEach((g, i) => g.m.forEach(m => { if (!map.has(m)) { map.set(m, i); keys.push(m); } }));
  keys.sort((a, b) => b.length - a.length);
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RE = new RegExp('(^|[^A-Za-z0-9_])(' + keys.map(escRe).join('|') + ')(?![A-Za-z0-9_])', 'g');

  const SKIP_SEL = 'script,style,textarea,input,select,option,button,canvas,code,pre,.gl-term,#gl-tip,[data-gl-skip],nav.tabs,header';
  const BLOCK_SEL = 'tr,li,p,h1,h2,h3,h4,summary,.kpi-card,.analysis,.field,.tab-question,.chart-block,.full-block,details';

  function annotate(root) {
    if (!root || root.nodeType !== 1 || !root.isConnected) return 0;
    if (root.closest(SKIP_SEL)) return 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || !n.nodeValue || n.nodeValue.length < 3) return NodeFilter.FILTER_REJECT;
        if (p.closest(SKIP_SEL)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = []; let n;
    while ((n = walker.nextNode())) nodes.push(n);
    const seen = new WeakMap();
    let added = 0;
    for (const node of nodes) {
      const text = node.nodeValue;
      RE.lastIndex = 0;
      if (!RE.test(text)) continue;
      RE.lastIndex = 0;
      const block = node.parentElement.closest(BLOCK_SEL) || node.parentElement;
      let set = seen.get(block);
      if (!set) {
        set = new Set();
        block.querySelectorAll('.gl-term').forEach(e => set.add(+e.dataset.gl));
        seen.set(block, set);
      }
      const frag = document.createDocumentFragment();
      let last = 0, m, changed = false;
      while ((m = RE.exec(text))) {
        const idx = map.get(m[2]);
        if (set.has(idx)) continue;
        set.add(idx);
        const start = m.index + m[1].length;
        frag.appendChild(document.createTextNode(text.slice(last, start)));
        const s = document.createElement('span');
        s.className = 'gl-term'; s.dataset.gl = idx; s.tabIndex = 0; s.textContent = m[2];
        frag.appendChild(s);
        last = start + m[2].length; changed = true; added++;
      }
      if (!changed) continue;
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
    return added;
  }

  // ── callout ──
  const tip = document.createElement('div');
  tip.id = 'gl-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  tip.innerHTML = '<div class="gl-tip-term"></div><div class="gl-tip-def"></div><div class="gl-tip-where"></div>';
  document.body.appendChild(tip);
  let current = null;

  function position(el) {
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = r.left; if (x + tw > vw - 12) x = vw - 12 - tw; if (x < 12) x = 12;
    let y = r.bottom + 8, above = false;
    if (y + th > vh - 12 && r.top - 8 - th > 12) { y = r.top - 8 - th; above = true; }
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    tip.classList.toggle('above', above);
  }
  function show(el) {
    const g = GL[+el.dataset.gl]; if (!g) return;
    current = el;
    tip.children[0].textContent = g.t;
    tip.children[1].textContent = g.d;
    tip.children[2].textContent = 'Appears in: ' + g.w;
    tip.hidden = false;
    position(el);
  }
  function hide() { tip.hidden = true; current = null; }
  const termOf = e => (e.target && e.target.closest) ? e.target.closest('.gl-term') : null;

  document.addEventListener('mouseover', e => { const t = termOf(e); if (t && t !== current) show(t); });
  document.addEventListener('mouseout', e => {
    const t = termOf(e); if (!t || t !== current) return;
    const to = e.relatedTarget; if (to && (to === tip || tip.contains(to))) return;
    hide();
  });
  tip.addEventListener('mouseleave', hide);
  document.addEventListener('focusin', e => { const t = termOf(e); if (t) show(t); });
  document.addEventListener('focusout', e => { if (termOf(e)) hide(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', () => { if (current) position(current); }, { passive: true });
  window.addEventListener('resize', () => { if (current) position(current); });
  // Touch: no hover, so a tap toggles the callout. On hover devices clicks pass through untouched
  // so table rows that deep-link to the Data Log keep working.
  document.addEventListener('click', e => {
    const t = termOf(e);
    if (!t) { if (current && !tip.contains(e.target)) hide(); return; }
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) {
      e.preventDefault(); e.stopPropagation();
      current === t ? hide() : show(t);
    }
  }, true);

  // ── keep up with the renderers ──
  const main = document.querySelector('main') || document.body;
  const activePanel = () => document.querySelector('.tab-panel.active');
  const dirty = new Set(); let pending = null;
  const observer = new MutationObserver(muts => {
    for (const m of muts) m.addedNodes.forEach(n => {
      if (n.nodeType === 1) schedule(n);
      else if (n.nodeType === 3 && n.parentElement) schedule(n.parentElement);
    });
  });
  function flush() {
    pending = null;
    const roots = [...dirty]; dirty.clear();
    const panel = activePanel();
    roots.forEach(r => { if (r.isConnected && panel && panel.contains(r)) annotate(r); });
    observer.takeRecords(); // drop the records our own replacements just produced
  }
  function schedule(root) {
    dirty.add(root);
    if (!pending) pending = setTimeout(flush, 120);
  }
  // Tabs that re-render on click are covered by the observer. Tabs whose text is static (Rep
  // Pipeline is charts over fixed headings) never mutate, so each panel gets exactly one whole-panel
  // pass the first time it is shown; repeating it would cost 0.5 s per click on the Data Log.
  document.querySelectorAll('button[data-tab]').forEach(b => b.addEventListener('click', () => {
    setTimeout(() => { const p = activePanel(); if (p && !p.dataset.glDone) { p.dataset.glDone = '1'; schedule(p); } }, 80);
  }));

  const landing = activePanel(); if (landing) { landing.dataset.glDone = '1'; annotate(landing); }
  observer.observe(main, { childList: true, subtree: true });
  window.__glossary = { annotate, show, hide, terms: GL, count: () => document.querySelectorAll('.gl-term').length };
})();
