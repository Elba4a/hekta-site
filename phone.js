// The phone shows the App Store captures, not a copy of the app.
//
// prototype.js drew 1.x in DOM and rotted the day 2.0 shipped. These frames are
// the raw captures under AppStoreAssets/Screenshots/<locale>/6.9/, re-shot for every
// release anyway, so refreshing the page is copying eight files (see
// docs/MARKETING_SITE.md). Each story block names its frame in data-screen; the block
// holding the viewport's centre line owns the phone. Below 961px the phone is inline
// and scrolls away, so the switcher under it is the only driver.
(() => {
  const frames = [...document.querySelectorAll('.shot')];
  const buttons = [...document.querySelectorAll('.switcher__btn')];
  if (!frames.length) return;

  const show = (name) => {
    for (const f of frames) f.classList.toggle('is-on', f.dataset.shot === name);
    for (const b of buttons) b.setAttribute('aria-selected', String(b.dataset.shot === name));
  };
  for (const b of buttons) b.addEventListener('click', () => show(b.dataset.shot));

  const blocks = [...document.querySelectorAll('[data-screen]')];
  const wide = window.matchMedia('(min-width: 961px)');
  let tops = [];
  let lastY = -1;
  const remeasure = () => {
    tops = blocks.map((b) => b.getBoundingClientRect().top + window.scrollY);
    lastY = -1;
  };
  const sync = () => {
    const y = window.scrollY;
    if (y === lastY || !wide.matches || !blocks.length) return;
    lastY = y;
    const centre = y + window.innerHeight / 2;
    // Before the first block the hero owns the phone; past the last block it holds.
    let held = frames[0].dataset.shot;
    blocks.forEach((b, i) => { if (centre >= tops[i]) held = b.dataset.screen; });
    show(held);
  };

  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', () => { remeasure(); sync(); });
  window.addEventListener('load', () => { remeasure(); sync(); });
  remeasure();
  sync();
})();
