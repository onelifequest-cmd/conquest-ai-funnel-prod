// SAMPLE DATA ONLY. Milestone 1 does not read any calendar.
// These times are generated locally so the scripted chat has something to show. They are NOT real
// open times and picking one books nothing. Milestone 2 replaces this module with a call to the
// Command Center chat endpoint (behind a flag, off by default), which returns real free slots
// from the Conquest AI CRM calendar, with a booking-link fallback.
const SAMPLE_TIMES = [[10, 0], [11, 30], [13, 30], [15, 0], [16, 0]]; // inside the draft Mon–Fri 10 AM–5 PM ET window

export function sampleSlots(count = 6, from = new Date()) {
  const out = [];
  for (let day = 1, k = 0; out.length < count && day < 21; day++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + day);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    for (const idx of [k % 5, (k + 2) % 5]) {
      if (out.length >= count) break;
      const [h, m] = SAMPLE_TIMES[idx];
      const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
      out.push({ sample: true, start: t, label: fmt(t), short: fmtShort(t) });
    }
    k++;
  }
  return out;
}
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hm = t => { const h = t.getHours(), m = t.getMinutes(); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
function fmt(t) { return `${DAY[t.getDay()]} ${MON[t.getMonth()]} ${t.getDate()} · ${hm(t)} ET`; }
function fmtShort(t) { return `${DAY[t.getDay()]} ${hm(t).replace(':00', '').replace(' ', '')}`; }
