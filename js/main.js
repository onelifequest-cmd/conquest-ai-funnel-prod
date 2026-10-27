// Conquest AI funnel, milestone 2 (local build). Chat mode lives in js/config.js (scripted by default).
// Was: milestone 1 (local build). Three.js hero + GSAP ScrollTrigger + Lenis + scripted chat.
// Flags: ?static (force reduced motion) · ?nogl (force the no-WebGL fallback) · ?chat (open the chat on load) · ?shot (hide preview flag)
import Lenis from '../vendor/lenis.mjs';
import { createChat } from './chat.js';
import { chatConfig } from './config.js';
import { drawStatic } from './fallback2d.js';

/* ===== PRICING: the one place to change prices. Every price on the page reads from here. ===== */
const PRICING = { setup: 1500, monthly: 600 };

const q = new URLSearchParams(location.search);
const docEl = document.documentElement;
const reduced = q.has('static') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
docEl.classList.add('js'); if (reduced) docEl.classList.add('reduced'); if (mobile) docEl.classList.add('mobile');
if (q.get('theme')) docEl.dataset.theme = q.get('theme');
if (q.has('shot')) document.body.classList.add('shot-m1');

const fmt = n => '$' + n.toLocaleString('en-US');
document.querySelectorAll('[data-price]').forEach(el => (el.textContent = fmt(PRICING[el.dataset.price])));

// ---------- hero: Three.js, or a static still if WebGL is missing ----------
const canvas = document.getElementById('core');
let hero = null;
async function initHero() {
  const { webglAvailable, createHero } = await import('./hero.js');
  if (q.has('nogl') || !webglAvailable()) throw new Error('no webgl');
  hero = createHero(canvas, { mobile, reduced });
}
const heroReady = initHero().catch(() => { docEl.classList.add('nogl'); drawStatic(canvas); });

// ---------- chat ----------
const CHAT = chatConfig();
/* prod: preview banner removed */
const chat = createChat({ root: document.getElementById('chat'), pricing: PRICING, reduced, config: CHAT,
  onOpenChange: o => { if (lenis) o && mobile ? lenis.stop() : lenis.start(); } });
window.__chat = chat;

// ---------- smooth scroll + scroll-driven motion ----------
const gsap = window.gsap, ST = window.ScrollTrigger;
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  window.__lenis = lenis;
}
const nav = document.querySelector('.nav');
function scrollToTarget(sel) {
  const el = document.querySelector(sel); if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -70, duration: 1.2 }); else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-scroll]'); if (!a) return;
  const h = a.getAttribute('href'); if (!h || h.length < 2) return;
  e.preventDefault(); scrollToTarget(h); history.replaceState(null, '', h);
});
// signup-cta now links to Conquest AI demo calendar (ai.questwon.com prod)

// nav: becomes fixed after the hero, hides on scroll down, shows on scroll up
let lastY = 0;
function onScroll(y) {
  nav.classList.toggle('fixed', y > 520);
  nav.classList.toggle('hide', y > 520 && y > lastY + 2);
  if (y < lastY - 2) nav.classList.remove('hide');
  lastY = y;
}

if (gsap && ST) {
  gsap.registerPlugin(ST);
  if (lenis) { lenis.on('scroll', ST.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
  lenis ? lenis.on('scroll', e => onScroll(e.scroll)) : addEventListener('scroll', () => onScroll(scrollY), { passive: true });

  // hero 3D reacts to scroll progress through the hero
  heroReady.then(() => {
    if (!hero) return;
    ST.create({ trigger: '.hero', start: 'top top', end: 'bottom top', onUpdate: s => hero.setScroll(s.progress) });
  });

  // nav pill tracks the active section
  document.querySelectorAll('[data-nav]').forEach(a => {
    const sec = document.getElementById(a.dataset.nav); if (!sec) return;
    ST.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: s => a.classList.toggle('is-active', s.isActive) });
  });
  // shop: pill shows the module in view
  const pill = document.querySelector('.modpill'), pillName = pill && pill.querySelector('b');
  document.querySelectorAll('.mod').forEach(m => ST.create({ trigger: m, start: 'top 55%', end: 'bottom 55%',
    onToggle: s => { if (s.isActive && pill) { pillName.textContent = m.dataset.mod; } } }));
  if (pill) ST.create({ trigger: '.mod', endTrigger: '.shop', start: 'top 60%', end: 'bottom 40%', onToggle: s => pill.classList.toggle('on', s.isActive) });

  // count-ups (stats)
  const countUp = el => {
    const to = parseFloat(el.dataset.to), dec = (el.dataset.to.split('.')[1] || '').length, o = { v: 0 };
    if (reduced) return;
    el.textContent = (0).toFixed(dec);
    gsap.to(o, { v: to, duration: 1.4, ease: 'power2.out', onUpdate: () => (el.textContent = o.v.toFixed(dec)) });
  };
  document.querySelectorAll('.count').forEach(el => {
    if (el.hasAttribute('data-load')) countUp(el);
    else ST.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => countUp(el) });
  });

  // hero chips: task texted → Grace answered → drafts ready → reminders ready, 6 s loop
  const chips = gsap.utils.toArray('.chipf');
  if (reduced) gsap.set(chips, { opacity: 1 });
  else {
    const tl = gsap.timeline({ repeat: -1 });
    chips.forEach((c, i) => tl.fromTo(c, { opacity: 0, y: 14, scale: .92 }, { opacity: 1, y: 0, scale: 1, duration: .45, ease: 'back.out(1.8)' }, .2 + i * 1));
    tl.to(chips, { opacity: 0, y: -8, duration: .4, stagger: .05 }, 5.4).set({}, {}, 6);
  }

  if (!reduced) {
    // headline splits by word
    const h1 = document.querySelector('.hero h1.split');
    const splitWords = (node, extraCls) => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(w => {
            if (!w) return; if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
            const s = document.createElement('span'); s.className = 'w' + (extraCls ? ' ' + extraCls : ''); s.textContent = w; frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.classList.contains('gtext')) { n.classList.remove('gtext'); splitWords(n, 'gtext'); }
      });
    };
    splitWords(h1);
    gsap.from(h1.querySelectorAll('.w'), { yPercent: 60, opacity: 0, duration: .9, ease: 'power3.out', stagger: .06, delay: .1 });
    gsap.from('.hero .eyebrow, .hero .sub, .hero .ctas, .hero .call, .hero .hstats > div', { y: 24, opacity: 0, duration: .8, ease: 'power2.out', stagger: .08, delay: .45 });
    gsap.to('.hero .wrap', { yPercent: -12, opacity: .25, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

    const rise = (targets, trigger, opts = {}) => gsap.from(targets, { y: 34, opacity: 0, duration: .8, ease: 'power3.out', stagger: opts.stagger ?? .12,
      scrollTrigger: { trigger: trigger || targets, start: opts.start || 'top 85%', once: true } });
    gsap.utils.toArray('.rv').forEach(el => rise(el, el));
    rise('.gbeats .beat', '.gbeats', { stagger: .12 });
    rise('.grace .video', '.grace .video');
    gsap.utils.toArray('.soonrow .sc, .coming-list .st-soon').forEach(el =>
      gsap.fromTo(el, { opacity: 0 }, { opacity: .6, duration: .6, delay: .5, scrollTrigger: { trigger: el, start: 'top 90%', once: true } }));
    // shop index: tiles stagger in, then status dots fill left to right
    gsap.from('.idx a', { y: 20, opacity: 0, duration: .55, ease: 'power2.out', stagger: .04, scrollTrigger: { trigger: '.idx', start: 'top 85%', once: true } });
    gsap.utils.toArray('.idx a').forEach(a => gsap.from(a.querySelectorAll('.dots u'), { scale: 0, duration: .3, stagger: .07, delay: .35, ease: 'back.out(2)', scrollTrigger: { trigger: a, start: 'top 90%', once: true } }));
    gsap.utils.toArray('.mod').forEach(m => rise(m.children, m, { stagger: .1, start: 'top 80%' }));
    // connected: phone sequence → Confirm pulses → Sent ✓; hub tiles light one by one; reach rows tick in
    const seq = gsap.utils.toArray('.phone .seq');
    const ptl = gsap.timeline({ scrollTrigger: { trigger: '.phone', start: 'top 70%', once: true } });
    seq.forEach((el, i) => ptl.from(el, { y: 14, opacity: 0, duration: .45, ease: 'power2.out',
      onComplete: i === 2 ? () => el.querySelector('.on').classList.add('pulse') : undefined }, i === 0 ? 0 : '+=' + (i === 3 ? 1.1 : .55)));
    const tiles = gsap.utils.toArray('.hub > div');
    ST.create({ trigger: '.hub', start: 'top 75%', once: true, onEnter: () => tiles.forEach((t, i) => setTimeout(() => t.classList.add('lit'), 160 * i)) });
    gsap.from('.reach li', { x: -14, opacity: 0, duration: .45, stagger: .1, scrollTrigger: { trigger: '.reach', start: 'top 85%', once: true } });
    rise('.ctl li', '.ctl', { stagger: .08 });
    rise('.steps .step', '.steps', { stagger: .1 });
    rise('.incl li', '.incl', { stagger: .05 });
    rise('.price', '.price');
    rise('.flow li', '.flow', { stagger: .08 });
    rise('.chat-sample', '.chat-sample');
  }
  ST.create({ trigger: '.flow li.ok', start: 'top 75%', once: true, onEnter: () => document.querySelector('.flow li.ok').classList.add('glow') });
  addEventListener('load', () => ST.refresh());
} else {
  addEventListener('scroll', () => onScroll(scrollY), { passive: true });
  document.querySelectorAll('.chipf').forEach(c => (c.style.opacity = 1));
}

// video slots: when real <video> clips are added, play at 50% in view and pause when out (voice clips stay click-to-play)
const vio = new IntersectionObserver(es => es.forEach(e => { const v = e.target; if (e.intersectionRatio >= .5) v.play().catch(() => {}); else v.pause(); }), { threshold: [0, .5] });
document.querySelectorAll('video[data-autoplay]').forEach(v => { v.muted = true; v.playsInline = true; vio.observe(v); });

if (q.has('chat')) chat.open();
