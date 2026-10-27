// Chat widget, milestone 2. Two modes (see ./config.js):
// - SCRIPTED (default): exactly milestone 1. No network calls of any kind (no fetch / XHR / websocket).
//   Times come from ./sample-slots.js (SAMPLE DATA). "Booked" / "talk to a person" only render a card.
// - LIVE: open times from GET {apiBase}/api/funnel-chat/slots; booking and "talk to a person" POST to
//   /api/funnel-chat/book and /handoff. Command Center keeps those in dry-run (nothing booked, no contact,
//   no alert) until FUNNEL_CHAT_BOOKING_LIVE=true, and the chat shows that plainly.
import { sampleSlots } from './sample-slots.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtPhone = d => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
const spoken = d => `${d.slice(0, 3).split('').join(' ')}, ${d.slice(3, 6).split('').join(' ')}, ${d.slice(6).split('').join(' ')}`;
function digits(text) { let d = String(text).replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') d = d.slice(1); return d; }
const validUS = d => d.length === 10 && /^[2-9]\d{2}[2-9]\d{6}$/.test(d);
const RX = {
  person: /\b(person|human|someone|somebody|patrick|real (?:one|person)|representative|rep|talk to (?:a|an|the)|call me)\b/i,
  price: /\b(price|pricing|cost|how much|fee|fees|monthly|setup|\$)\b/i,
  live: /\b(live|what can|what do you|services|features|available)\b/i,
};

const BOOKING_BASE = 'https://api.leadconnectorhq.com/widget/bookings/';

export function createChat({ root, pricing, reduced = false, onOpenChange = () => {}, config = { mode: 'scripted', apiBase: '', bookingWidgetSlug: 'conquest-ai-demo-call' } }) {
  const LIVE = config.mode === 'live';
  let widgetSlug = config.bookingWidgetSlug || 'conquest-ai-demo-call';
  async function api(path, body) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(`${config.apiBase || ''}/api/funnel-chat/${path}`, body
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }
        : { signal: ctl.signal });
      let data = {}; try { data = await res.json(); } catch { /* non-JSON */ }
      return { status: res.status, data };
    } catch { return { status: 0, data: {} }; } finally { clearTimeout(t); }
  }
  const money = n => '$' + n.toLocaleString('en-US');
  root.innerHTML = `
    <div class="chat-h"><span class="orb" style="position:relative"></span><div><b>Conquest AI agent</b><small>${LIVE ? 'Live times' : 'Scripted · nothing is booked'}</small></div><span class="tagx">PREVIEW</span><button class="x" type="button" data-close-chat aria-label="Close chat">×</button></div>
    <div class="chat-b" role="log" aria-live="polite"></div>
    <form class="chat-f" autocomplete="off"><input name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0"><input name="msg" type="text" placeholder="Type a message…" aria-label="Message" maxlength="200"><button class="send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M3 20l18-8L3 4v6l12 2-12 2z"/></svg></button></form>
    <div class="chat-note">Please don't share passwords or card numbers in chat.</div>`;
  const log = root.querySelector('.chat-b'), form = root.querySelector('form'), input = form.elements.msg;
  const S = { step: 'need', name: null, need: null, business: null, volume: null, slot: null, phone: null, pending: null, after: null, started: false, handedOff: false, busy: false };
  const queue = [];

  const scrollDown = () => { log.scrollTop = log.scrollHeight; };
  function add(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); const el = d.firstElementChild; log.appendChild(el); scrollDown(); return el; }
  const user = text => add(`<div class="m u">${esc(text)}</div>`);
  // agent messages are queued with a short typing delay so the flow reads like a conversation
  function say(html, extra) { queue.push({ html, extra }); if (!S.busy) drain(); }
  function drain() {
    const item = queue.shift(); if (!item) { S.busy = false; return; }
    S.busy = true;
    if (item.html === null) { item.extra && item.extra(); return drain(); }
    const delay = reduced ? 0 : Math.min(1100, 380 + item.html.length * 6);
    const dots = delay ? add('<div class="typing" aria-label="Agent is typing"><i></i><i></i><i></i></div>') : null;
    setTimeout(() => { dots && dots.remove(); add(`<div class="m a">${item.html}</div>`); item.extra && item.extra(); drain(); }, delay);
  }
  function quick(options, onPick) {
    const el = add(`<div class="qr">${options.map((o, i) => `<button type="button" data-i="${i}" class="${o.hp ? 'hp' : ''}">${esc(o.label)}</button>`).join('')}</div>`);
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || el.classList.contains('used')) return;
      el.classList.add('used'); b.classList.add('on');
      const o = options[+b.dataset.i]; user(o.label); onPick(o);
    });
    return el;
  }
  const personOpt = { label: 'Talk to a person', hp: true, v: '__person' };

  // ---------- steps ----------
  function greet() {
    say(`Hi! I'm the Conquest AI agent. What would you hand off first if you had an employee who never sleeps?`, () => quick([
      { label: 'Answer my calls', v: 'calls' }, { label: 'Follow up with leads', v: 'follow' },
      { label: 'Chase invoices', v: 'invoices' }, { label: 'Book a call', v: 'book' }, personOpt,
    ], o => o.v === '__person' ? handoff() : pickNeed(o.v)));
  }
  const NEED = {
    calls: `That's the most common one. Grace, our AI receptionist, answers every call 24/7 in your business name, handles common questions and books the consultation.`,
    follow: `Your AI team runs follow-up in your CRM and replies to texts in your voice, including links and pictures. Nothing goes out until you approve it.`,
    invoices: `Your agent drafts overdue-invoice reminders and can make outbound AI collection calls to your approved list. Nothing sends until you tap Confirm.`,
    book: `Happy to set that up. It's a 30-minute phone call with the team.`,
  };
  function pickNeed(v) {
    S.need = v; say(NEED[v] || NEED.calls);
    S.step = 'business';
    say(`What kind of business is it?`, () => quick([
      { label: 'Credit repair' }, { label: 'Home services' }, { label: 'Health & beauty' }, { label: 'Real estate' }, { label: 'Something else' },
    ], o => o.label === 'Something else' ? say(`Sure. What kind of business? Just type it below.`) : setBusiness(o.label)));
  }
  function setBusiness(b) {
    S.business = b; S.step = 'volume';
    say(`Got it, ${esc(b.toLowerCase())}. About how many new leads or calls do you get a week?`, () => quick([
      { label: 'Under 10' }, { label: '10 to 50' }, { label: 'More than 50' }, { label: 'Not sure' },
    ], o => setVolume(o.label)));
  }
  function setVolume(v) { S.volume = v; offerSlots(); }
  function offerSlots() {
    S.step = 'slot';
    if (LIVE) return offerLiveSlots(`Thanks. The next step is a 30-minute phone call with the team to map what you'd hand off first. Let me check open times…`);
    // SAMPLE DATA: mocked slot list (see sample-slots.js). Not real open times.
    showSlots(`Thanks. The next step is a 30-minute phone call with the team to map what you'd hand off first. Here are some open times:`, sampleSlots(6), 'Sample times');
  }
  // LIVE: real free slots from CC. Empty / inactive calendar / error → booking-link fallback text.
  function offerLiveSlots(intro) {
    say(intro);
    api('slots').then(({ data }) => {
      if (data.bookingLink && data.bookingLink.widgetSlug) widgetSlug = data.bookingLink.widgetSlug;
      const slots = Array.isArray(data.slots) ? data.slots : [];
      if (!data.ok || data.fallback || !slots.length) return noSlot(true);
      showSlots(`Here are the next open times:`, slots, data.sample ? 'Dev sample times' : 'Open times');
    });
  }
  function showSlots(intro, slots, tag) {
    say(intro, () => {
      const el = add(`<div class="slots"><div class="t"><span>Phone call · 30 min · ET</span><em>${esc(tag)}</em></div><div class="g">${slots.map((s, i) => `<button type="button" data-i="${i}" title="${esc(s.label)}">${esc(s.short)}</button>`).join('')}</div></div>`);
      el.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || el.classList.contains('used')) return;
        const nx = el.nextElementSibling; if (nx && nx.classList.contains('qr')) nx.classList.add('used');
        el.classList.add('used'); b.classList.add('on'); pickSlot(slots[+b.dataset.i]);
      });
      quick([{ label: 'None of these work' }, personOpt], o => o.v === '__person' ? handoff() : noSlot());
    });
  }
  // "None of these work" (or no open times): link to the public booking page (calendar live Oct 25 2026).
  function noSlot(none) {
    const url = BOOKING_BASE + encodeURIComponent(widgetSlug);
    say(`${none ? `I don't have open times to show right now.` : `No problem.`} You can pick any open time on our booking page instead.`, () => {
      add(`<div class="handoff"><b>Booking page</b><a href="${esc(url)}" target="_blank" rel="noopener" style="color:var(--sky,#7cc4ff);text-decoration:underline">Book a Conquest AI demo call</a></div>`);
    });
    anythingElse();
  }
  function pickSlot(slot) {
    user(slot.label); S.slot = slot;
    if (LIVE && !S.name) { S.step = 'name'; say(`${esc(slot.label)} works. What's your name?`); return; }
    askPhone(`${esc(slot.label)} it is. It's a phone call, so the team will call you. What's the best number to reach you?`, 'book');
  }
  function gotName(text) {
    const n = text.replace(/[<>]/g, '').trim().slice(0, 60);
    if (n.length < 2 || !/\p{L}/u.test(n) || /https?:|www\./i.test(n)) { say(`Sorry, what name should the team ask for?`); return; }
    S.name = n;
    askPhone(`Thanks, ${esc(n.split(' ')[0])}. It's a phone call, so the team will call you. What's the best number to reach you?`, 'book');
  }
  function askPhone(msg, purpose) { S.step = 'phone'; S.after = purpose; say(msg, () => { input.setAttribute('inputmode', 'tel'); input.placeholder = 'Your phone number'; input.focus({ preventScroll: true }); }); }
  function gotPhone(text) {
    const d = digits(text);
    if (!validUS(d)) { say(`Hmm, that doesn't look like a 10-digit US number. Could you type it again, area code first?`); return; }
    S.pending = d; S.step = 'confirmPhone'; input.removeAttribute('inputmode'); input.placeholder = 'Type a message…';
    say(`Let me read that back: <b>${fmtPhone(d)}</b>. That's ${spoken(d)}. Is that right?`, () => quick([
      { label: "Yes, that's right", v: 'y' }, { label: 'No, let me fix it', v: 'n' },
    ], o => o.v === 'y' ? confirmPhone() : askPhone(`No problem. What's the right number?`, S.after)));
  }
  function confirmPhone() {
    S.phone = S.pending; S.pending = null;
    if (S.after === 'person') return finishHandoff();
    if (LIVE) return liveBook();
    S.step = 'done';
    say(`You're all set.`, () => {
      add(`<div class="booked"><span class="ck">✓</span><div><b>${esc(S.slot.label)} · phone call</b><small>The team will call ${fmtPhone(S.phone)}.<br><em>Preview only: nothing was booked and no text or email was sent.</em></small></div></div>`);
    });
    anythingElse();
  }
  const hp = () => form.elements.website.value;
  const about = () => ({ business: S.business || undefined, volume: S.volume || undefined, need: S.need || undefined });
  function liveBook() {
    S.step = 'done';
    say(`One moment while I lock that in…`);
    api('book', { name: S.name, phone: S.phone, phoneConfirmed: true, slot: S.slot.start, ...about(), website: hp() }).then(({ status, data }) => {
      if (status === 200 && data.ok && (data.booked || data.dryRun)) {
        const label = (data.slot && data.slot.label) || S.slot.label;
        say(data.booked ? `You're all set.` : `Here's what would be booked.`, () => {
          add(`<div class="booked"><span class="ck">✓</span><div><b>${esc(label)} · phone call</b><small>The team will call ${fmtPhone(S.phone)}.${data.booked ? '' : `<br><em>Test mode: booking is switched off, so nothing was booked and no contact was created.</em>`}</small></div></div>`);
        });
        return anythingElse();
      }
      if (status === 409) {
        S.slot = null; S.step = 'slot';
        const slots = Array.isArray(data.slots) ? data.slots : [];
        if (!slots.length) return noSlot(true);
        return showSlots(`Sorry, that time was just taken. Here are the latest open times:`, slots, 'Open times');
      }
      if (status === 400 && data.field === 'phone') return askPhone(`${esc(data.error || 'That number did not work.')} What's the best number?`, 'book');
      if (status === 400 && data.field === 'name') { S.name = null; S.step = 'name'; return say(`Sorry, what name should the team ask for?`); }
      say(status === 429 ? `I'm getting a lot of requests right now, so I couldn't book that.` : `Sorry, I couldn't book that just now.`);
      noSlot();
    });
  }
  function anythingElse() {
    S.step = 'free';
    say(`Anything else I can help with?`, () => quick([
      { label: 'What does it cost?', v: 'price' }, { label: "What's live today?", v: 'live' }, personOpt,
    ], o => route(o.v)));
  }
  function route(v) {
    if (v === '__person') return handoff();
    if (v === 'price') { say(`Plans start at ${money(pricing.setup)} setup plus ${money(pricing.monthly)} a month. We go over exactly what we'd build for you on the call.`); return S.slot ? anythingElse() : offerBook(); }
    if (v === 'live') {
      say(`Live today: Grace the AI receptionist, AI text replies with links and pictures, outbound AI collection calls, follow-up and email replies, post drafts, onboarding, your Discord channel and Mission Control. In test: the daily growth plan and Grace handing callers to your team. Coming: missed-call text-back, reminders and no-show rescue, auto-posting, and research.`);
      return S.slot ? anythingElse() : offerBook();
    }
  }
  function offerBook() {
    say(`Want to pick a time for a 30-minute call?`, () => quick([{ label: 'Show me times', v: 't' }, personOpt], o => o.v === '__person' ? handoff() : offerSlots()));
  }
  // "Talk to a person": Patrick reaches out. Never promise a response time.
  function handoff() {
    if (S.handedOff) { say(`I've already passed your request to Patrick. He'll reach out to you personally.`); return; }
    if (S.phone) return finishHandoff(true);
    askPhone(`Of course. I'll pass this to Patrick and he'll reach out to you personally. What's the best number for him to reach you?`, 'person');
  }
  function finishHandoff(intro) {
    S.handedOff = true; S.step = 'free';
    if (intro) say(`Of course. I'll pass this to Patrick and he'll reach out to you personally.`);
    if (LIVE) return liveHandoff();
    say(`Done. Patrick has your request and will reach out at ${fmtPhone(S.phone)}.`, () => {
      add(`<div class="handoff"><b>Request for Patrick</b>${esc([S.business, S.volume && S.volume + ' leads a week'].filter(Boolean).join(' · ') || 'From the agent on this page')}<br><small style="color:var(--amber);font-size:12px">Preview only: no message was actually sent.</small></div>`);
    });
  }

  function liveHandoff() {
    api('handoff', { name: S.name || undefined, phone: S.phone, phoneConfirmed: true, ...about(), website: hp() }).then(({ status, data }) => {
      if (status === 200 && data.ok && (data.handedOff || data.dryRun)) {
        say(`Done. Patrick has your request and will reach out at ${fmtPhone(S.phone)}.`, () => {
          add(`<div class="handoff"><b>Request for Patrick</b>${esc([S.business, S.volume && S.volume + ' leads a week'].filter(Boolean).join(' · ') || 'From the agent on this page')}${data.handedOff ? '' : `<br><small style="color:var(--amber);font-size:12px">Test mode: handoff is switched off, so no contact was created and no alert was sent.</small>`}</div>`);
        });
        return;
      }
      S.handedOff = false;
      say(`Sorry, I couldn't pass that along just now. You can pick a time on our booking page instead.`);
      noSlot();
    });
  }

  // ---------- free text ----------
  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim(); if (!text) return; input.value = '';
    if (!S.started) start();
    user(text);
    if (S.step === 'phone') return gotPhone(text);
    if (S.step === 'name') return gotName(text);
    if (RX.person.test(text)) return handoff();
    if (RX.price.test(text)) return route('price');
    if (S.step === 'business') return setBusiness(text.slice(0, 60));
    if (S.step === 'volume') return setVolume(text.slice(0, 40));
    if (S.step === 'need') return pickNeed(/call|phone|answer/i.test(text) ? 'calls' : /invoice|collect|pay/i.test(text) ? 'invoices' : /book|schedul|meet/i.test(text) ? 'book' : 'follow');
    if (RX.live.test(text)) return route('live');
    say(LIVE ? `I can only follow a short flow for now. Pick an option above, or type “talk to a person”.` : `I'm a scripted preview, so I can only follow a short flow for now. Pick an option above, or type “talk to a person”.`);
  });

  // ---------- open / close ----------
  const dock = root.closest('.dock');
  function start() { if (S.started) return; S.started = true; greet(); }
  function open() { dock.hidden = false; document.body.classList.add('chat-open'); onOpenChange(true); start(); setTimeout(scrollDown, 30); }
  function close() { dock.hidden = true; document.body.classList.remove('chat-open'); onOpenChange(false); }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-chat]')) { e.preventDefault(); open(); }
    else if (e.target.closest('[data-close-chat]')) { e.preventDefault(); close(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !dock.hidden) close(); });
  return { open, close, state: S };
}
