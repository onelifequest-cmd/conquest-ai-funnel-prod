// Static stand-in for the Three.js hero, used when WebGL is missing (or ?nogl). Ported from the v2 mockup still.
export function drawStatic(c) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = c.clientWidth, H = c.clientHeight; c.width = W * dpr; c.height = H * dpr;
  const x = c.getContext('2d'); if (!x) return; x.scale(dpr, dpr);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const light = document.documentElement.dataset.theme === 'light';
  const mob = W < 600, cx = W * (mob ? .5 : .52), cy = H * (mob ? .46 : .5), R = Math.min(W, H) * (mob ? .30 : .27);
  for (let i = 0; i < (mob ? 18 : 34); i++) {
    const a = rnd() * Math.PI * 2, len = R * (1.6 + rnd() * 1.8); x.beginPath();
    const sx = cx + Math.cos(a) * R * .9, sy = cy + Math.sin(a) * R * .9, ex = cx + Math.cos(a + .6) * len, ey = cy + Math.sin(a + .6) * len * .8;
    x.moveTo(sx, sy); x.bezierCurveTo(cx + Math.cos(a + .2) * len * .5, cy + Math.sin(a + .2) * len * .5, cx + Math.cos(a + .5) * len * .8, cy + Math.sin(a + .5) * len * .7, ex, ey);
    const g = x.createLinearGradient(sx, sy, ex, ey); g.addColorStop(0, 'rgba(2,161,254,.55)'); g.addColorStop(1, 'rgba(0,71,223,0)'); x.strokeStyle = g; x.lineWidth = .8 + rnd() * 1.2; x.stroke();
  }
  let g = x.createRadialGradient(cx, cy, 0, cx, cy, R * 2.1); g.addColorStop(0, light ? 'rgba(2,161,254,.25)' : 'rgba(2,161,254,.35)'); g.addColorStop(.4, 'rgba(0,71,223,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const ring = (rx, ry, rot, a, w) => { x.save(); x.translate(cx, cy); x.rotate(rot); x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); x.strokeStyle = `rgba(124,196,255,${a})`; x.lineWidth = w; x.stroke(); x.restore(); };
  ring(R * 1.55, R * .42, -.35, .35, 1.2); ring(R * 1.9, R * .6, .25, .18, 1); ring(R * 1.25, R * 1.25, 0, .12, 1);
  const N = mob ? 900 : 2000, pts = []; const ry = .5, rx = .35;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996; const px = Math.cos(th) * r, pz = Math.sin(th) * r, py = y;
    const X = px * Math.cos(ry) + pz * Math.sin(ry); let Z = -px * Math.sin(ry) + pz * Math.cos(ry); const Y = py * Math.cos(rx) - Z * Math.sin(rx); Z = py * Math.sin(rx) + Z * Math.cos(rx);
    const n = 1 + .05 * Math.sin(px * 9 + py * 7); pts.push([X * n, Y * n, Z]);
  }
  pts.sort((a, b) => a[2] - b[2]);
  for (const [X, Y, Z] of pts) { const d = (Z + 1) / 2; x.fillStyle = `rgba(${Math.round(60 + d * 130)},${Math.round(150 + d * 90)},255,${.15 + d * .8})`; x.beginPath(); x.arc(cx + X * R, cy + Y * R, .6 + d * 1.5, 0, 7); x.fill(); }
  g = x.createRadialGradient(cx - R * .15, cy - R * .15, 0, cx, cy, R * .62); g.addColorStop(0, 'rgba(232,245,255,.95)'); g.addColorStop(.25, 'rgba(2,161,254,.85)'); g.addColorStop(.7, 'rgba(0,71,223,.35)'); g.addColorStop(1, 'rgba(0,71,223,0)');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R * .62, 0, 7); x.fill();
}
