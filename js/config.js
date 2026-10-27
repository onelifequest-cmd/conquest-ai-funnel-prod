// Chat config, milestone 2. The one place to switch the chat between scripted and live.
//   mode: 'scripted' (DEFAULT) — milestone-1 behaviour: sample times, no network calls at all.
//         'live'               — real open times + booking/handoff through the Command Center
//                                 /api/funnel-chat/* routes. Those routes stay in dry-run (nothing is
//                                 booked, no contact, no alert) until FUNNEL_CHAT_BOOKING_LIVE=true on CC.
//   apiBase: Command Center origin, e.g. 'https://<cc-host>' (no trailing slash). '' = same origin.
//   bookingWidgetSlug: GHL booking widget for "None of these work": https://api.leadconnectorhq.com/widget/bookings/<slug> (public since Oct 25 2026).
export const CHAT_CONFIG = {
  mode: 'live',
  apiBase: 'https://merkaba-command-center.onrender.com',
  bookingWidgetSlug: 'conquest-ai-demo-call',
};

// Local testing only: ?mode=live&api=http://127.0.0.1:3100 works on localhost / 127.0.0.1, never on a real domain.
export function chatConfig(loc = location) {
  const cfg = { ...CHAT_CONFIG };
  if (/^(127\.0\.0\.1|localhost)$/.test(loc.hostname)) {
    const q = new URLSearchParams(loc.search);
    if (q.get('mode') === 'live' || q.get('mode') === 'scripted') cfg.mode = q.get('mode');
    const api = q.get('api');
    if (api && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(api)) cfg.apiBase = api;
  }
  if (cfg.mode !== 'live') cfg.mode = 'scripted';
  return cfg;
}
