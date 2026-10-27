// Video preview layer: picks vertical (phone) or wide (desktop) files, lazy-loads section clips,
// muted autoplay while in view, "Tap for sound" unmutes one clip at a time, full tour in a modal.
(() => {
  const mq = matchMedia('(max-width: 760px)');
  const orient = () => (mq.matches ? 'v' : 'w');
  const figs = [...document.querySelectorAll('figure.vid')];
  const vids = figs.map(f => f.querySelector('video'));

  function setSrc(v, keepTime) {
    const o = orient();
    if (v.dataset.o === o) return;
    const base = v.dataset[o];
    const t = keepTime && v.dataset.o ? v.currentTime : 0;
    const wasPlaying = !v.paused;
    v.dataset.o = o;
    v.poster = base + '.jpg';
    v.src = base + '.mp4';
    v.preload = 'auto';
    if (t) v.addEventListener('loadedmetadata', () => { try { v.currentTime = t; } catch (e) {} }, { once: true });
    if (wasPlaying) v.play().catch(() => {});
  }
  function setPoster(v) { if (!v.dataset.o) { const f = v.closest('figure'); f.style.backgroundImage = `url(${v.dataset[orient()]}.jpg)`; } }

  function btnState(v) {
    const b = v.closest('figure').querySelector('.vsound');
    b.setAttribute('aria-pressed', String(!v.muted));
    b.querySelector('.t').textContent = v.muted ? 'Tap for sound' : 'Sound on';
  }
  function muteOthers(keep) {
    vids.forEach(o => { if (o !== keep && !o.muted) { o.muted = true; btnState(o); } });
    const tv = document.querySelector('#tour video'); if (tv && keep !== tv) tv.pause();
  }
  function toggleSound(v) {
    setSrc(v);
    if (v.muted) { muteOthers(v); v.muted = false; v.currentTime = 0; v.play().catch(() => {}); }
    else v.muted = true;
    btnState(v);
  }

  // near the viewport: poster + source; half visible: play; out: pause
  const near = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { setPoster(v); setSrc(v); near.unobserve(v); }
  }), { rootMargin: '900px 0px' });
  const inView = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (document.body.classList.contains('tour-open')) return;
    const eager = v.closest('figure').hasAttribute('data-eager');
    const show = e.isIntersecting && (eager ? e.intersectionRatio > 0 : (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= innerHeight * 0.4));
    if (show) { setSrc(v); if (v.paused) v.play().catch(() => {}); }
    else if (!v.paused) v.pause();
  }), { threshold: [0, 0.01, 0.25, 0.4, 0.5, 0.75, 1] });

  vids.forEach(v => {
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    const f = v.closest('figure');
    if (f.hasAttribute('data-eager')) { setSrc(v); v.play().catch(() => {}); }
    else near.observe(v);
    inView.observe(v);
    f.querySelector('.vsound').addEventListener('click', e => { e.stopPropagation(); toggleSound(v); });
    v.addEventListener('click', () => toggleSound(v));
  });

  mq.addEventListener('change', () => vids.forEach(v => { if (v.dataset.o) setSrc(v, true); else setPoster(v); }));

  // full tour modal
  const tour = document.getElementById('tour');
  const tv = tour && tour.querySelector('video');
  let lastFocus = null;
  function openTour() {
    lastFocus = document.activeElement;
    vids.forEach(v => { v.pause(); if (!v.muted) { v.muted = true; btnState(v); } });
    const o = orient();
    if (tv.dataset.o !== o) { tv.dataset.o = o; tv.poster = tv.dataset[o] + '.jpg'; tv.src = tv.dataset[o] + '.mp4'; }
    tour.hidden = false; document.body.classList.add('tour-open');
    tv.muted = false; tv.play().catch(() => { tv.muted = true; tv.play().catch(() => {}); });
    tour.querySelector('.tour-x').focus();
  }
  function closeTour() {
    tv.pause(); tour.hidden = true; document.body.classList.remove('tour-open');
    if (lastFocus) lastFocus.focus();
    vids.forEach(v => { const r = v.getBoundingClientRect(); if (r.top < innerHeight * 0.75 && r.bottom > innerHeight * 0.25) v.play().catch(() => {}); });
  }
  document.querySelectorAll('[data-tour]').forEach(b => b.addEventListener('click', openTour));
  tour.querySelectorAll('[data-tour-close]').forEach(b => b.addEventListener('click', closeTour));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !tour.hidden) closeTour(); });
  window.__vidPreview = { orient, vids, openTour, closeTour };
})();
