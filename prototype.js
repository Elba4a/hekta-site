/* The prototype: a working slice of Hekta, inside the phone on the page.
 *
 * Four screens and one flow. Navigation is real — the tab bar switches screens,
 * the assistant presents over them, and Apply mutates the store, so going back to
 * Home shows a balance that actually changed. That round trip is the product's
 * whole claim ("you run it by talking to it"), and a screenshot cannot make it.
 *
 * The data below is synthetic and lifted verbatim from the App Store captures in
 * AppStoreAssets/Screenshots/en/6.9/ — same person, same amounts, same dates — so
 * the page never states a number the store listing does not already show.
 *
 * No framework. One state object, one render pass, plain DOM.
 */
(function () {
  'use strict';

  const mount = document.getElementById('app');
  if (!mount) return;

  // When the visitor last drove the phone themselves. Declared up here because both
  // the in-phone tab bar and the switcher below the device set it, and the scroll
  // driver reads it to know it has been outranked.
  let tappedAt = 0;

  // ── data ──────────────────────────────────────────────────────────────────
  const data = {
    name: 'Nour',
    currency: 'EGP',
    balance: 50144.50,
    left: 42286.00,
    pace: 17141.50,
    paceUsed: 0.69,
    alerts: [
      { t: 'Total',        d: 'Spending faster than the calendar — 69% used.' },
      { t: 'Food & Drink', d: 'Spending faster than the calendar — 69% used.' },
      { t: 'Groceries',    d: 'Spending faster than the calendar — 72% used.' },
    ],
    upcoming: {
      due: 3, total: 4685.00,
      rows: [
        { t: 'iPhone 17 Pro', s: 'Aug 24', v: 4500.00, badge: 'i',  tint: '#EAF1FB', fg: '#0860C2' },
        { t: 'Spotify',       s: 'Aug 25', v: 65.00,   badge: '♫',  tint: '#1DB954', fg: '#FFFFFF' },
        { t: 'iCloud+',       s: 'Aug 27', v: 120.00,  badge: '☁',  tint: '#EAF1FB', fg: '#0860C2' },
      ],
    },
    vault: [
      { name: 'Crypto', mark: '₿', tint: '#F3E8FF', fg: '#8B4FC7', add: 'Add crypto', sub: 702037.50,
        rows: [{ t: 'Bitcoin', s: '0.15 BTC', v: 702037.50, delta: 'Up EGP 252,037.50 (56%)', dir: 'up' }] },
      { name: 'Gold', mark: '$', tint: '#FBF0D9', fg: '#8A6A16', add: 'Add gold', sub: 180782.51,
        rows: [{ t: 'Gold — 21K bracelet', s: '50 g · 21K', v: 180782.51, delta: 'Down EGP 29,217.49 (13.9%)', dir: 'down' }] },
      { name: 'Stocks', mark: '↗', tint: '#E6F1FD', fg: '#0860C2', add: 'Add stock', sub: 135315.00,
        rows: [{ t: 'Apple Inc.', s: 'AAPL · NASDAQ', v: 135315.00, delta: 'Down EGP 8,685.00 (6%)', dir: 'down' }] },
    ],
    group: {
      title: 'Trip to Alexandria', currency: 'EGP', owed: 2149.99,
      balances: [
        { who: 'You',     init: 'YO', ring: '#A855F7', verb: 'is owed', v: 2149.99, dir: 'up' },
        { who: 'Youssef', init: 'YS', ring: '#22A559', verb: 'owes',    v: 2149.99, dir: 'down' },
      ],
      settle: { from: 'Youssef', to: 'You', v: 2149.99 },
      expenses: [
        { t: 'Gas', tag: 'Transport',    who: 'Youssef paid', v: 700.00 },
        { t: 'Seafood dinner', tag: 'Food & drinks', who: 'Islam paid', v: 1850.00 },
      ],
    },
  };

  // Each screen lights the room its own colour — stage.js eases toward it.
  const TINT = { home: '#4A90E8', people: '#3FB262', vault: '#D2A44E', assistant: '#0A84FF' };

  const state = { screen: 'home', thread: [], busy: false, used: [] };

  // ── helpers ───────────────────────────────────────────────────────────────
  const money = (n) => data.currency + ' ' + n.toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  const I = {
    eye:    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1.6 12S5.2 5.4 12 5.4 22.4 12 22.4 12 18.8 18.6 12 18.6 1.6 12 1.6 12Z"/><circle cx="12" cy="12" r="3.1"/></svg>',
    user:   '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.6a10.4 10.4 0 1 0 0 20.8 10.4 10.4 0 0 0 0-20.8Zm0 4.6a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6Zm0 14.4a7.7 7.7 0 0 1-5.5-2.3c1.2-1.8 3.2-2.9 5.5-2.9s4.3 1.1 5.5 2.9A7.7 7.7 0 0 1 12 20.6Z"/></svg>',
    plus:   '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9.3"/><path d="M12 8v8M8 12h8" stroke-linecap="round"/></svg>',
    swap:   '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5h14l-3-3M20.5 15.5h-14l3 3"/></svg>',
    scan:   '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M20 8.5V6a2 2 0 0 0-2-2h-2.5M4 15.5V18a2 2 0 0 0 2 2h2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5"/><rect x="8.5" y="8.5" width="7" height="7" rx="1.4"/></svg>',
    warn:   '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9.5"/><path d="M12 7v6" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.05" fill="currentColor" stroke="none"/></svg>',
    x:      '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    clock:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 6.8V12l3.4 2" stroke-linecap="round"/></svg>',
    chev:   '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    back:   '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    home:   '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2.8 10.6c-.3.3-.1.9.4.9H5v8.1c0 .5.4.9.9.9h3.4v-5.2h5.4v5.2h3.4c.5 0 .9-.4.9-.9v-8.1h1.8c.5 0 .7-.6.4-.9L12 3Z"/></svg>',
    people: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><circle cx="8.6" cy="8.2" r="3.3"/><circle cx="16.4" cy="9.2" r="2.7"/><path d="M2.4 18.6c0-3 2.8-4.9 6.2-4.9s6.2 1.9 6.2 4.9v.7H2.4v-.7Z"/><path d="M16.2 13.9c2.9.1 5.4 1.7 5.4 4.3v1.1h-4.9v-1.1c0-1.7-.6-3.1-1.6-4.1a7 7 0 0 1 1.1-.2Z"/></svg>',
    vault:  '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6 2.6 7.4v1.5h18.8V7.4L12 2.6Zm-6.6 8v7.2H3.1v2.2h17.8v-2.2h-2.3v-7.2h-2.2v7.2h-2.1v-7.2h-2.2v7.2H9v-7.2H6.8v7.2H5.4v-7.2Z"/></svg>',
    spark:  '<svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2l1.7 4.9 4.9 1.7-4.9 1.7L12 15.4l-1.7-4.9-4.9-1.7 4.9-1.7L12 2.2Z"/><path d="M18.6 14.4l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5Z"/><path d="M5.6 15.2l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z"/></svg>',
    mic:    '<svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor"><rect x="9" y="2.4" width="6" height="11.2" rx="3"/><path d="M5.4 11.4a6.6 6.6 0 0 0 13.2 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M12 18v3.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    add:    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>',
    hist:   '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 12a8.4 8.4 0 1 0 2.6-6.1"/><path d="M3.4 4.4v3.9h3.9"/><path d="M12 7.6V12l3 1.8"/></svg>',
    edit:   '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10v3Z"/></svg>',
    arrIn:  '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 10.6V15h4.4"/></svg>',
    arrOut: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 15l6-6M15 13.4V9h-4.4"/></svg>',
  };

  const statusBar = () =>
    '<div class="sb"><span>9:41</span><div class="sb__island"></div><div class="sb__right">'
    + '<svg width="19" height="13" viewBox="0 0 19 13" fill="currentColor"><rect x="0" y="9" width="3" height="4" rx="1"/><rect x="5" y="6.5" width="3" height="6.5" rx="1"/><rect x="10" y="3.5" width="3" height="9.5" rx="1"/><rect x="15" y="0.5" width="3" height="12.5" rx="1"/></svg>'
    + '<svg width="17" height="13" viewBox="0 0 17 13" fill="currentColor"><path d="M8.5 11.7 6.2 9.3a3.3 3.3 0 0 1 4.6 0l-2.3 2.4ZM3.7 6.9a6.8 6.8 0 0 1 9.6 0l-1.6 1.6a4.6 4.6 0 0 0-6.4 0L3.7 6.9ZM1.1 4.3a10.4 10.4 0 0 1 14.8 0l-1.6 1.6a8.2 8.2 0 0 0-11.6 0L1.1 4.3Z"/></svg>'
    + '<svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="0.6" y="0.6" width="21" height="11.8" rx="3.4" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.1"/><rect x="2.2" y="2.2" width="15" height="8.6" rx="2.1" fill="#30D158"/><path d="M23 4.4v4.2c1-.3 1.6-1 1.6-2.1S24 4.7 23 4.4Z" fill="currentColor" fill-opacity="0.4"/><path d="M10.4 2.6 6 7.3h2.6l-.7 3.4 4.4-4.9h-2.6l.7-3.2Z" fill="#0a3d16"/></svg>'
    + '</div></div>';

  // ── screens ───────────────────────────────────────────────────────────────
  function homeScreen() {
    const s = el('div', 'screen');
    s.id = 'sc-home';
    s.innerHTML = `
      <div class="app-head">
        <h1>Hi, ${data.name}</h1>
        <div class="app-head__tools">${I.eye}${I.user}</div>
      </div>

      <div class="anchor">
        <div class="anchor__label">Total balance</div>
        <div class="anchor__display" id="fig-balance">${money(data.balance)}</div>
        <hr class="hair">
        <div class="anchor__row">
          <span class="anchor__k">Left for you</span>
          <span class="anchor__v" id="fig-left">${money(data.left)}</span>
        </div>
        <div class="anchor__row">
          <span class="anchor__k">On pace</span>
          <span class="anchor__v anchor__v--quiet">${money(data.pace)}</span>
        </div>
        <div class="pace">
          <div class="pace__fill" style="inline-size:${(data.paceUsed * 100).toFixed(0)}%"></div>
          <div class="pace__mark" style="inset-inline-start:${(data.paceUsed * 100).toFixed(0)}%"></div>
        </div>
      </div>

      <!-- Spans, not buttons: these are part of the screen the prototype shows but
           they do nothing here, and a focusable control that does nothing is a trap
           for anyone tabbing through. The tab bar and the assistant are the live
           controls, and the caption under the phone says so. -->
      <div class="quick">
        <span>${I.plus}<span>Add transaction</span></span>
        <span>${I.swap}<span>Transfer</span></span>
        <span>${I.scan}<span>Scan</span></span>
      </div>

      <h2 class="sec-title">Needs your attention</h2>
      ${data.alerts.map((a) => `
        <div class="alert">
          <span class="alert__icon">${I.warn}</span>
          <div class="alert__body">
            <div class="alert__t">${a.t}</div>
            <div class="alert__d">${a.d}</div>
            <span class="alert__link">View budget</span>
          </div>
          <span class="alert__x">${I.x}</span>
        </div>`).join('')}

      <h2 class="sec-title">What's coming</h2>
      <p class="meta">${data.upcoming.due} due · ${money(data.upcoming.total)}</p>
      <div class="card">
        ${data.upcoming.rows.map((r) => `
          <div class="row">
            <span class="row__badge" style="background:${r.tint};color:${r.fg}">${r.badge}</span>
            <div class="row__body"><div class="row__t">${r.t}</div><div class="row__s">${r.s}</div></div>
            <div class="row__v">${money(r.v)}</div>
          </div>`).join('')}
      </div>

      <h2 class="sec-title">Daily money</h2>
      <div class="navgroup">
        ${['Transactions', 'Budgets', 'Subscriptions', 'Installments', 'Analytics'].map((t) => `
          <div class="navrow"><span class="navrow__t">${t}</span><span class="navrow__c">${I.chev}</span></div>`).join('')}
      </div>`;
    return s;
  }

  function vaultScreen() {
    const s = el('div', 'screen');
    s.id = 'sc-vault';
    s.innerHTML = data.vault.map((sec) => `
      <div class="sec-head">
        <span class="sec-head__l">
          <span class="dot" style="background:${sec.tint};color:${sec.fg}">${sec.mark}</span>${sec.name}
        </span>
        <span class="sec-head__a">+ ${sec.add}</span>
      </div>
      <p class="meta">Subtotal <span class="subtotal">${money(sec.sub)}</span></p>
      <p class="stale">${I.clock} Last updated Aug 20, 2026</p>
      <div class="card">
        ${sec.rows.map((r) => `
          <div class="row">
            <div class="row__body"><div class="row__t">${r.t}</div><div class="row__s">${r.s}</div></div>
            <div>
              <div class="row__v">${money(r.v)}</div>
              <div class="row__v row__v--${r.dir}" style="font-size:15px">${r.delta}</div>
            </div>
          </div>`).join('')}
      </div>`).join('')
      + '<p class="meta" style="margin-block-start:22px;color:var(--app-accent-text)">⊕ Add</p>';
    return s;
  }

  function peopleScreen() {
    const g = data.group;
    const s = el('div', 'screen');
    s.id = 'sc-people';
    s.innerHTML = `
      <div style="padding-block:6px 2px;color:var(--app-accent)">${I.back}</div>
      <h1 style="margin:6px 0 10px;font-size:30px;font-weight:700;letter-spacing:-0.6px">${g.title}</h1>
      <span class="chip" style="background:var(--app-surface);color:var(--app-text-primary)">${g.currency}</span>

      <div class="card" style="margin-block-start:16px;padding:16px">
        <div class="anchor__label">Your position</div>
        <div style="display:flex;align-items:center;gap:7px;color:var(--app-success);margin-block-start:4px">
          ${I.arrIn}<span style="font-size:17px">You are owed</span>
        </div>
        <div class="anchor__display" style="color:var(--app-success)">${money(g.owed)}</div>
      </div>

      <h2 class="sec-title">Balances</h2>
      <div class="card">
        ${g.balances.map((b) => `
          <div class="row">
            <span class="row__badge" style="box-shadow:inset 0 0 0 1.6px ${b.ring};color:${b.ring}">${b.init}</span>
            <div class="row__body"><div class="row__t">${b.who}</div></div>
            <div class="row__v row__v--${b.dir}" style="display:flex;align-items:center;gap:6px">
              ${b.dir === 'up' ? I.arrIn : I.arrOut}<span>${b.verb} ${money(b.v)}</span>
            </div>
            <span class="sec-head__a">Settle</span>
          </div>`).join('')}
      </div>

      <h2 class="sec-title">Suggested settlements</h2>
      <div class="card">
        <div class="row">
          <div class="row__body"><div class="row__t">${g.settle.from} → ${g.settle.to}</div></div>
          <div class="row__v">${money(g.settle.v)}</div>
        </div>
      </div>

      <h2 class="sec-title">Expenses</h2>
      <p class="meta">Jul 20, 2026</p>
      <div class="card">
        ${g.expenses.map((e) => `
          <div class="row">
            <div class="row__body">
              <div class="row__t">${e.t}
                <span style="font-size:14px;color:var(--app-text-secondary);border:1px solid var(--app-border);border-radius:6px;padding:1px 6px;margin-inline-start:6px">${e.tag}</span>
              </div>
              <div class="row__s">${e.who}</div>
            </div>
            <div class="row__v">${money(e.v)}</div>
          </div>`).join('')}
      </div>`;
    return s;
  }

  // ── the assistant ─────────────────────────────────────────────────────────
  const SCRIPTS = [
    {
      chip: 'I paid 320 for coffee at Cilantro',
      say:  'I paid 320 for coffee at Cilantro today from CIB Checking',
      reply: 'Coffee at Cilantro for 320 EGP from CIB Checking is prepared and awaiting your confirmation below.',
      proposal: {
        title: 'New transaction',
        amount: 320.00,
        fields: [
          ['Amount', money(320)], ['Account', 'CIB Checking'], ['Category', 'Food & Drink'],
          ['Date', 'Aug 21, 2026'], ['Merchant', 'Cilantro'],
        ],
      },
    },
    {
      chip: 'How much on restaurants in March?',
      say:  'How much did I spend on restaurants in March?',
      reply: 'You spent EGP 4,180.00 on Food & Drink in March 2026, across 23 transactions. That is 12% below your February total.',
    },
  ];

  function assistantScreen() {
    const s = el('div', 'modal');
    s.id = 'sc-assistant';
    s.innerHTML = `
      <div class="modal-head">
        <div style="display:flex;gap:9px">
          <span class="circle-btn">${I.hist}</span><span class="circle-btn">${I.edit}</span>
        </div>
        <span class="modal-head__t">Assistant</span>
        <button class="circle-btn" type="button" data-close="1" aria-label="Close the assistant">${I.x}</button>
      </div>
      <div class="thread" id="thread" role="log" aria-live="polite" aria-label="Assistant conversation"></div>
      <div class="prompts" id="prompts"></div>
      <div class="composer">
        <span style="color:var(--app-accent)">${I.add}</span>
        <span class="composer__hint" id="hint">Ask about your spending…</span>
        <span style="color:var(--app-accent)">${I.mic}</span>
      </div>`;
    return s;
  }

  function renderPrompts() {
    const box = document.getElementById('prompts');
    if (!box) return;
    box.innerHTML = '';
    SCRIPTS.forEach((s, i) => {
      const b = el('button', 'chip', s.chip);
      b.type = 'button';
      if (state.busy || state.used.includes(i)) b.disabled = true;
      b.addEventListener('click', () => run(i));
      box.appendChild(b);
    });
    if (state.used.length === SCRIPTS.length) {
      const b = el('button', 'chip', 'Start over');
      b.type = 'button';
      b.disabled = state.busy;
      b.addEventListener('click', reset);
      box.appendChild(b);
    }
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollThread = () => {
    const t = document.getElementById('thread');
    if (t) t.scrollTop = t.scrollHeight;
  };

  async function typeInto(hint, text) {
    hint.classList.add('is-typed', 'is-typing');
    if (reduced()) { hint.textContent = text; await wait(120); }
    else {
      hint.textContent = '';
      for (const ch of text) { hint.textContent += ch; await wait(22); }
      await wait(260);
    }
    hint.classList.remove('is-typing');
  }

  async function run(i) {
    if (state.busy) return;
    const script = SCRIPTS[i];
    const thread = document.getElementById('thread');
    const hint = document.getElementById('hint');
    if (!thread || !hint) return;

    state.busy = true;
    state.used.push(i);
    renderPrompts();

    await typeInto(hint, script.say);

    // send: the composer clears and the bubble posts. The composer decides nothing.
    hint.textContent = 'Ask about your spending…';
    hint.classList.remove('is-typed');
    thread.appendChild(el('div', 'bubble bubble--me bubble--in', script.say));
    scrollThread();
    await wait(reduced() ? 60 : 520);

    const dots = el('div', 'bubble bubble--it typing', '<i></i><i></i><i></i>');
    thread.appendChild(dots);
    scrollThread();
    await wait(reduced() ? 60 : 900);
    dots.remove();

    thread.appendChild(el('div', 'bubble bubble--it bubble--in', script.reply));
    scrollThread();

    if (script.proposal) {
      await wait(reduced() ? 40 : 320);
      const p = script.proposal;
      const card = el('div', 'proposal bubble--in',
        `<h3>${p.title}</h3><dl>${p.fields.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`);
      thread.appendChild(card);

      const acts = el('div', 'acts bubble--in');
      acts.innerHTML = '<button class="btn btn--fill" type="button" data-apply="1">Apply</button>'
        + '<div class="acts__pair"><button class="btn btn--plain" type="button" data-discard="1">Discard</button>'
        + '<button class="btn btn--plain" type="button">Edit</button></div>';
      thread.appendChild(acts);
      scrollThread();

      acts.querySelector('[data-apply]').addEventListener('click', () => {
        data.balance -= p.amount;
        data.left -= p.amount;
        card.remove(); acts.remove();
        thread.appendChild(el('div', 'bubble bubble--it bubble--in',
          `Saved. Your total balance is now ${money(data.balance)} — open Home to see it.`));
        scrollThread();
        refreshHomeFigures(true);
      });
      acts.querySelector('[data-discard]').addEventListener('click', () => {
        card.remove(); acts.remove();
        thread.appendChild(el('div', 'bubble bubble--it bubble--in',
          'Discarded. Nothing was saved.'));
        scrollThread();
      });
    }

    state.busy = false;
    renderPrompts();
  }

  function reset() {
    state.used = [];
    const t = document.getElementById('thread');
    if (t) t.innerHTML = '';
    renderPrompts();
  }

  function refreshHomeFigures(flash) {
    const b = document.getElementById('fig-balance');
    const l = document.getElementById('fig-left');
    if (b) b.textContent = money(data.balance);
    if (l) l.textContent = money(data.left);
    if (flash && b) {
      b.classList.add('is-fresh');
      setTimeout(() => b.classList.remove('is-fresh'), 1400);
    }
  }

  // ── shell ─────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'home',   label: 'Home',   icon: I.home },
    { id: 'people', label: 'People', icon: I.people },
    { id: 'vault',  label: 'Vault',  icon: I.vault },
  ];

  const screens = {
    home: homeScreen(),
    people: peopleScreen(),
    vault: vaultScreen(),
    assistant: assistantScreen(),
  };

  mount.innerHTML = statusBar();
  Object.values(screens).forEach((s) => { s.hidden = true; mount.appendChild(s); });

  const tabs = el('div', 'tabs');
  tabs.setAttribute('aria-label', 'App tab bar');
  tabs.setAttribute('role', 'group');
  const capsule = el('div', 'tabs__capsule');
  const tabButtons = {};
  TABS.forEach((t) => {
    const b = el('button', 'tab', `${t.icon}<span>${t.label}</span>`);
    b.type = 'button';
    b.addEventListener('click', () => go(t.id));
    tabButtons[t.id] = b;
    capsule.appendChild(b);
  });
  const ai = el('button', 'tab-ai', I.spark);
  ai.type = 'button';
  ai.setAttribute('aria-label', 'Open the assistant');
  ai.addEventListener('click', () => go('assistant'));
  tabButtons.assistant = ai;
  tabs.append(capsule, ai);
  mount.appendChild(tabs);

  const caption = document.getElementById('device-caption');

  // ── the switcher under the phone ─────────────────────────────────────────
  // Below 961px the page does not drive the phone (the device scrolls away rather
  // than staying pinned), so the in-phone tab bar is the only control — and at that
  // size it is a 12px target inside a scaled screen. This row sits outside the
  // device at full size and does the same job. It is present at every width;
  // styles.css hides it where the page is driving.
  const switcher = el('div', 'switcher');
  switcher.setAttribute('role', 'tablist');
  switcher.setAttribute('aria-label', 'Prototype screen');
  const switchButtons = {};
  [...TABS, { id: 'assistant', label: 'Assistant' }].forEach((t) => {
    const b = el('button', 'switcher__btn', t.label);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    // The phone's own tab bar carries the same three words. Two controls reading
    // "Home" in one tab order is ambiguous out loud, so the switcher says what it
    // does and the depicted bar keeps the app's wording.
    b.setAttribute('aria-label', 'Show the ' + t.label + ' screen');
    b.addEventListener('click', () => { tappedAt = Date.now(); go(t.id); });
    switchButtons[t.id] = b;
    switcher.appendChild(b);
  });

  function go(id) {
    state.screen = id;
    Object.entries(screens).forEach(([k, s]) => { s.hidden = k !== id; });
    Object.entries(tabButtons).forEach(([k, b]) => {
      if (k === id) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    Object.entries(switchButtons).forEach(([k, b]) => {
      b.setAttribute('aria-selected', String(k === id));
    });
    // the assistant presents full-screen over the tabs, as it does in the app
    tabs.hidden = id === 'assistant';
    if (id === 'home') refreshHomeFigures(false);
    if (id === 'assistant') renderPrompts();
    if (window.hektaStage) window.hektaStage.setTint(TINT[id]);
    if (caption) {
      caption.textContent = id === 'assistant'
        ? 'Tap a suggestion — nothing saves until you confirm'
        : 'Live prototype, on demo data — drive it';
    }
  }

  mount.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) go('home');
  });

  if (caption && caption.parentElement) {
    caption.parentElement.insertBefore(switcher, caption);
  }

  // ── fit the 440pt canvas to whatever width the glass ended up ────────────
  // The UI inside is authored at real iPhone points (440 x 956) and scaled to the
  // screen, so the numbers in app.css stay the ones the app itself uses.
  //
  // Convergence is belt and braces on purpose. A single measurement taken during
  // layout is measured too early: the observed failure was an app locked at scale
  // 0.5159 (227pt wide) inside a screen that had settled at 270 — sixteen percent of
  // the glass left empty down the right and bottom edges, which is exactly what a
  // wrong-looking phone looks like. ResizeObserver alone did not recover it. So:
  // observe, listen for resize and load, AND sample for a moment after boot.
  const screenBox = mount.parentElement;
  let lastW = 0;
  const fit = () => {
    const w = screenBox.clientWidth;
    if (!w || w === lastW) return;
    lastW = w;
    mount.style.setProperty('--app-scale', (w / 440).toFixed(4));
  };
  if (window.ResizeObserver) new ResizeObserver(fit).observe(screenBox);
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  // A bounded settle window — webfonts, the sticky column and the grid all land
  // within a few frames. It stops on its own; nothing samples forever.
  const settleUntil = performance.now() + 1200;
  (function settleFit() {
    fit();
    if (performance.now() < settleUntil) requestAnimationFrame(settleFit);
  })();

  // ── the page drives the phone ────────────────────────────────────────────
  // Each story block names the screen it is talking about; whichever block holds
  // the viewport's centre line owns the phone.
  //
  // Sampled two ways (see below), because each has a real environment where it
  // stays quiet: a scroll listener, and a rAF read that early-outs when scrollY
  // has not moved. IntersectionObserver was tried first and dropped — it never
  // fired at all in the harness used to verify this, and a navigation that
  // silently never happens is worse than one scrollY compare per frame.
  //
  // The visitor always outranks the page: tapping inside the phone pins their
  // choice until they scroll into a different block.
  let owner = null;
  let lastY = -1;
  let autoRan = false;
  mount.addEventListener('click', () => { tappedAt = Date.now(); });

  const blocks = [...document.querySelectorAll('[data-screen]')];
  if (blocks.length) {
    // Block offsets are measured once and re-measured only on resize. Reading a rect
    // per block on every scrolled frame is a forced layout during exactly the moment
    // the page is busiest — a fling — and these offsets cannot change without a
    // resize or a font swap.
    let tops = [];
    const remeasure = () => {
      tops = blocks.map((b) => b.getBoundingClientRect().top + window.scrollY);
    };

    const owning = () => {
      const centre = window.scrollY + window.innerHeight / 2;
      if (centre < tops[0]) return 'home';            // still in the hero
      // Otherwise the last block the centre line has passed keeps the phone. Past
      // the final block it HOLDS rather than snapping back to Home — the phone is
      // off screen by then, and a flip on the way out is a flicker, not a signal.
      let held = blocks[0].dataset.screen;
      for (let i = 0; i < blocks.length; i++) {
        if (centre >= tops[i]) held = blocks[i].dataset.screen;
      }
      return held;
    };

    // Only while the phone is pinned beside the story. Below that width it sits
    // inline under the hero and scrolls away, so a page-driven screen change would
    // happen off screen — there, the tab bar is the only driver, which is what the
    // caption tells the visitor.
    const wide = window.matchMedia('(min-width: 961px)');

    const sync = () => {
      const y = window.scrollY;
      if (y === lastY) return;
      lastY = y;
      if (!wide.matches) return;
      const want = owning();
      if (want === owner) return;
      owner = want;
      if (Date.now() - tappedAt < 6000) return;   // the visitor is driving
      go(want);
      // Scrolling into "just say it" and finding an empty chat proves nothing.
      // The first time the page drives the assistant, it runs the demo itself;
      // after that the chips replay it on demand.
      // The flag is spent when the demo actually STARTS, not when it is scheduled:
      // a visitor who scrolls straight past the block and back again should still
      // get it, and a scheduled-then-abandoned run must not eat the one chance.
      if (want === 'assistant' && !autoRan) {
        setTimeout(() => {
          if (autoRan || state.busy || state.used.length) return;
          if (state.screen !== 'assistant') return;
          autoRan = true;
          run(0);
        }, 700);
      }
    };

    // Both paths on purpose. The scroll event is the right tool and fires even
    // when rAF is throttled; the rAF sample covers a scroll the event pipeline
    // never reports (momentum handoff, a programmatic jump). Either alone has a
    // real environment where it stays silent, and `sync` is idempotent, so the
    // duplication costs a scrollY compare.
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', () => { remeasure(); lastY = -1; sync(); });
    // Late webfont or image loads reflow the story column and move every offset.
    window.addEventListener('load', () => { remeasure(); lastY = -1; sync(); });
    remeasure();
    (function watch() { requestAnimationFrame(watch); sync(); })();
  }

  window.hektaApp = { go };
  go('home');
})();
