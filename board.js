/* The board: the flap headline, and the device's tilt.
 *
 * The headline is written in the HTML as plain text inside .flap__line elements —
 * a client with no JS reads the sentence normally. On load we split each line into
 * per-character cells and let them settle once, like a departures board reaching
 * its destination. Once. It never loops; a looping board is a toy.
 */
(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,’';
  const DIGITS  = '0123456789';
  // A rate scrambling through Q and K on its way to a number reads as a glitch, not
  // a board. The alphabet follows the character the cell is landing on.
  const alphabetFor = (ch) => (DIGITS.indexOf(ch) !== -1 ? DIGITS : LETTERS);

  // ── flap headline ─────────────────────────────────────────────────────────
  // Narrow cells for punctuation only. Written as explicit code points so an
  // HTML entity can never leak in here and quietly make digits narrow.
  const TIGHT = ['.', ',', ':', '$', '/', '\u2192'];

  // Turn one element's text into a row of cells. Returns the animatable cells.
  function cellify(line, accentFrom = -1) {
    const text = line.textContent;
    line.textContent = '';
    const cells = [];
    [...text].forEach((ch, i) => {
      const cell = document.createElement('span');
      const isSpace = ch === ' ';
      const isTight = TIGHT.indexOf(ch) !== -1;
      cell.className = 'flap__cell'
        + (isSpace ? ' flap__cell--space' : '')
        + (isTight ? ' flap__cell--tight' : '')
        + (accentFrom >= 0 && i >= accentFrom ? ' flap__cell--accent' : '');
      const glyph = document.createElement('span');
      glyph.className = 'flap__glyph';
      glyph.textContent = ch;
      cell.appendChild(glyph);
      line.appendChild(cell);
      // Spaces and punctuation are not flaps. A decimal point spinning through Q on
      // its way back to a decimal point is a glitch; it belongs to the frame.
      // `idx` is the character's position in the ORIGINAL string, so a caller
      // retargeting these cells can index its new value directly.
      if (!isSpace && !isTight) cells.push({ glyph, final: ch, idx: i });
    });
    return cells;
  }

  function buildFlap(root) {
    const cells = [];
    root.querySelectorAll('.flap__line').forEach((line) => {
      cells.push(...cellify(line, Number(line.dataset.accentFrom ?? -1)));
    });
    return cells;
  }

  function settle(cells, step = 26, lead = 90) {
    // Each cell spins through a few glyphs and lands, staggered left to right.
    // One rAF loop drives every cell, so the cost is one timer, not N.
    const start = performance.now();
    cells.forEach((c, i) => {
      c.done = false;
      c.at = lead + i * step;                 // when this cell stops, in ms
      c.next = 0;
      c.alphabet = alphabetFor(c.final);
      c.glyph.textContent = c.alphabet[(i * 7) % c.alphabet.length];
    });
    const last = cells.length ? cells[cells.length - 1].at : 0;

    const land = () => cells.forEach((c) => { c.glyph.textContent = c.final; c.done = true; });

    // A timer guard, because requestAnimationFrame does not run in a background tab
    // and a link opened in one would otherwise sit on random glyphs until it is
    // focused — possibly forever. setTimeout is throttled there but still fires, so
    // the words land whether or not anyone is watching. The rAF path clears it.
    const guard = setTimeout(land, last + 700);

    (function tick(now) {
      const t = now - start;
      let live = false;
      for (const c of cells) {
        if (c.done) continue;
        if (t >= c.at) { c.glyph.textContent = c.final; c.done = true; continue; }
        live = true;
        if (t >= c.next) {
          c.glyph.textContent = c.alphabet[(Math.random() * c.alphabet.length) | 0];
          c.next = t + 42;
        }
      }
      if (live && t < last + 200) requestAnimationFrame(tick);
      else { clearTimeout(guard); land(); }
    })(start);
  }

  // Fire `fn` the first time `el` is close enough to be looked at. One shared
  // trigger, because everything on this page that animates does so once, when the
  // visitor reaches it — a board that settles at the bottom of the document while
  // the visitor is still reading the hero has animated for nobody.
  function whenSeen(el, fn) {
    let fired = false;
    const check = () => {
      if (fired) return;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.85 || r.bottom < 0) return;
      fired = true;
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      fn();
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();
    return check;
  }

  document.querySelectorAll('.flap').forEach((flap) => {
    const cells = buildFlap(flap);
    if (reduce.matches) { cells.forEach((c) => { c.glyph.textContent = c.final; }); return; }
    // The hero's headline is the page's opening move and settles immediately; every
    // other flap line waits until it is on screen.
    if (flap.closest('.hero-block')) settle(cells);
    else whenSeen(flap, () => settle(cells));
  });

  // Section numbers and prices are cells too — same grammar, no animation on load
  // (they are not the headline, and three boards settling at once is noise).
  document.querySelectorAll('[data-flap]:not(.flap)').forEach((el) => {
    if (el.dataset.flapTo === undefined) cellify(el);
  });

  // ── the rate flip ────────────────────────────────────────────────────────
  // The board's one piece of data motion, and the argument of the whole section:
  // the "Today" column lands on a different number while the record beside it does
  // not move. It runs ONCE, when the board is first scrolled to, and never loops.
  const flips = [...document.querySelectorAll('[data-flap-to]')];
  if (flips.length) {
    flips.forEach((el) => { el.__cells = cellify(el); });

    const board = document.querySelector('.rateboard');
    const run = () => {
      flips.forEach((el, row) => {
        const to = el.dataset.flapTo;
        const cells = el.__cells;
        // Same digit count by construction — the values are authored to match, so a
        // mismatch is an authoring error and is left visible rather than papered over.
        cells.forEach((c) => { c.done = false; c.final = to[c.idx] ?? c.final; });
        if (reduce.matches) cells.forEach((c) => { c.glyph.textContent = c.final; c.done = true; });
        else setTimeout(() => settle(cells, 34, 40), row * 140);
      });
    };

    if (board) whenSeen(board, run);
  }

  // ── device tilt ───────────────────────────────────────────────────────────
  // Pointer-driven, spring-damped, and it stops entirely on a coarse pointer:
  // a phone has no cursor to follow, and a tilt that only fires on touch fights
  // the visitor's own scrolling.
  const device = document.querySelector('.device');
  const fine = window.matchMedia('(pointer: fine)');

  if (device && fine.matches && !reduce.matches) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;

    window.addEventListener('pointermove', (e) => {
      const w = window.innerWidth, h = window.innerHeight;
      tx = ((e.clientY / h) - 0.5) * -9;      // rotateX follows the cursor's height
      ty = ((e.clientX / w) - 0.5) * 15;      // rotateY follows its width
      if (!raf) raf = requestAnimationFrame(spring);
    }, { passive: true });

    function spring() {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      device.style.setProperty('--tilt-x', cx.toFixed(2) + 'deg');
      device.style.setProperty('--tilt-y', cy.toFixed(2) + 'deg');
      raf = (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01)
        ? requestAnimationFrame(spring)
        : 0;
    }
  }
})();
