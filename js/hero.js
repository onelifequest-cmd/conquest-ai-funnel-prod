// Interactive 3D hero ("agent core"): particle sphere + orbit rings + signal strands. Three.js r170, no other deps.
import * as THREE from '../vendor/three.module.min.js';

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
  catch (e) { return false; }
}

export function createHero(canvas, { mobile = false, reduced = false } = {}) {
  const Q = mobile
    ? { points: 1800, strands: 14, strandSeg: 40, pulses: 10, dpr: 1.5, ringSeg: 128 }
    : { points: 5200, strands: 34, strandSeg: 64, pulses: 26, dpr: 2, ringSeg: 200 };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(Q.dpr, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 7.2);
  const root = new THREE.Group(); scene.add(root);
  const core = new THREE.Group(); root.add(core);
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

  // --- particle sphere (fibonacci), shader-driven breathing + scroll dispersal
  const N = Q.points, pos = new Float32Array(N * 3), rnd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
    pos[i * 3] = Math.cos(th) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(th) * r; rnd[i] = Math.random();
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
  const uniforms = { uTime: { value: 0 }, uScroll: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uSize: { value: mobile ? 2.6 : 2.2 } };
  const pm = new THREE.ShaderMaterial({
    uniforms, ...additive,
    vertexShader: `uniform float uTime,uScroll,uPx,uSize; attribute float aRnd; varying float vD; varying float vA;
      void main(){ vec3 p=position; float n=sin(p.x*9.+uTime*.9)*sin(p.y*7.+uTime*.7)*.05;
        p*=1.18+n+uScroll*(0.6+aRnd*2.4); p+=normalize(position)*sin(uTime*1.6+aRnd*6.283)*.012;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        vD=clamp((p.z+1.4)/2.8,0.,1.); vA=1.-uScroll*.85;
        gl_PointSize=uSize*uPx*(0.55+vD*1.25)*(6.5/-mv.z); }`,
    fragmentShader: `varying float vD; varying float vA; void main(){ vec2 c=gl_PointCoord-.5; float d=length(c); if(d>.5) discard;
        float a=smoothstep(.5,.0,d); vec3 col=mix(vec3(.24,.55,1.),vec3(.78,.93,1.),vD); gl_FragColor=vec4(col,a*(.18+vD*.82)*vA); }`
  });
  core.add(new THREE.Points(pg, pm));

  // --- glow sprites (inner core + halo)
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(232,245,255,1)'); g.addColorStop(.22, 'rgba(2,161,254,.85)'); g.addColorStop(.6, 'rgba(0,71,223,.25)'); g.addColorStop(1, 'rgba(0,71,223,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const inner = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, ...additive, opacity: .95 })); inner.scale.set(1.6, 1.6, 1); core.add(inner);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, ...additive, opacity: .28 })); halo.scale.set(6.5, 6.5, 1); root.add(halo);

  // --- orbit rings with travelling nodes
  const rings = [], nodes = [];
  [[1.85, .5, -.35, .42], [2.25, .72, .25, .22], [1.45, 1.45, 0, .14]].forEach(([rx, ry, rot, op], k) => {
    const pts = new THREE.EllipseCurve(0, 0, rx, ry).getPoints(Q.ringSeg).map(p => new THREE.Vector3(p.x, p.y, 0));
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7cc4ff, ...additive, opacity: op }));
    const g = new THREE.Group(); g.rotation.z = rot; g.rotation.x = k === 2 ? 1.2 : 0.18; g.add(line); root.add(g);
    rings.push({ g, rx, ry, speed: (k % 2 ? -1 : 1) * (0.05 + k * 0.02) });
    if (k < 2) for (let j = 0; j < 2; j++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, ...additive })); s.scale.set(.32, .32, 1); g.add(s);
      nodes.push({ s, rx, ry, t: j * Math.PI + k, v: 0.18 + k * 0.06 });
    }
  });

  // --- signal strands (bezier curves fanning out) + pulses that travel along them
  let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const strands = [], pulsePos = new Float32Array(Q.pulses * 3);
  for (let i = 0; i < Q.strands; i++) {
    const a = R() * Math.PI * 2, z = (R() - .5) * 1.2, len = 2.6 + R() * 2.6;
    const s0 = new THREE.Vector3(Math.cos(a) * .95, Math.sin(a) * .95, z * .4);
    const c1 = new THREE.Vector3(Math.cos(a + .25) * len * .45, Math.sin(a + .25) * len * .45, z);
    const c2 = new THREE.Vector3(Math.cos(a + .5) * len * .8, Math.sin(a + .5) * len * .7, z * 1.4);
    const e = new THREE.Vector3(Math.cos(a + .62) * len, Math.sin(a + .62) * len * .8, z * 1.8);
    const curve = new THREE.CubicBezierCurve3(s0, c1, c2, e);
    const pts = curve.getPoints(Q.strandSeg), col = new Float32Array(pts.length * 3);
    pts.forEach((_, j) => { const f = 1 - j / pts.length; col[j * 3] = .0 * f; col[j * 3 + 1] = .63 * f; col[j * 3 + 2] = 1 * f; });
    const g = new THREE.BufferGeometry().setFromPoints(pts); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, ...additive, opacity: .55 + R() * .3 }));
    root.add(line); strands.push(curve);
  }
  const pulses = Array.from({ length: Q.pulses }, (_, i) => ({ c: strands[i % strands.length], t: R(), v: .08 + R() * .14 }));
  const pulseGeo = new THREE.BufferGeometry(); pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
  const pulseMat = new THREE.PointsMaterial({ map: glowTex, size: mobile ? .16 : .13, color: 0xbdebff, ...additive });
  root.add(new THREE.Points(pulseGeo, pulseMat));
  const tmp = new THREE.Vector3();

  // --- layout / interaction
  let w = 0, h = 0;
  function resize() {
    const r = canvas.getBoundingClientRect(); w = Math.max(1, r.width); h = Math.max(1, r.height);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    root.position.x = mobile ? 0 : 0.15; root.scale.setScalar(mobile ? .78 : 1);
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!mobile && !reduced) window.addEventListener('pointermove', e => { pointer.tx = (e.clientX / innerWidth - .5) * 2; pointer.ty = (e.clientY / innerHeight - .5) * 2; }, { passive: true });

  let scroll = 0, running = false, visible = true, raf = 0, last = performance.now(), t = 0;
  const fps = { frames: 0, since: performance.now(), value: 0 }; window.__heroFps = fps;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
    fps.frames++; if (now - fps.since > 1000) { fps.value = Math.round(fps.frames * 1000 / (now - fps.since)); fps.frames = 0; fps.since = now; }
    uniforms.uTime.value = t; uniforms.uScroll.value += (scroll - uniforms.uScroll.value) * .12;
    pointer.x += (pointer.tx - pointer.x) * .05; pointer.y += (pointer.ty - pointer.y) * .05;
    core.rotation.y = t * .12 + pointer.x * .35; core.rotation.x = .35 + pointer.y * .2;
    root.rotation.y = pointer.x * .12; root.rotation.x = pointer.y * .08;
    const sc = uniforms.uScroll.value; camera.position.z = 7.2 + sc * 2.2; halo.material.opacity = .28 * (1 - sc);
    inner.scale.setScalar(1.6 + Math.sin(t * 1.4) * .08);
    rings.forEach(r => { r.g.rotation.y = Math.sin(t * r.speed) * .3; });
    nodes.forEach(n => { n.t += n.v * dt; n.s.position.set(Math.cos(n.t) * n.rx, Math.sin(n.t) * n.ry, 0); });
    pulses.forEach((p, i) => { p.t = (p.t + p.v * dt) % 1; p.c.getPoint(p.t, tmp); pulsePos[i * 3] = tmp.x; pulsePos[i * 3 + 1] = tmp.y; pulsePos[i * 3 + 2] = tmp.z; });
    pulseGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }
  function play() { if (running || reduced || !visible || document.hidden) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function pause() { running = false; cancelAnimationFrame(raf); }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? play() : pause(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
  if (reduced) { t = 2; frame(performance.now()); } else play();

  return {
    setScroll(v) { scroll = v; if (reduced) { uniforms.uScroll.value = v; frame(performance.now()); } },
    dispose() { pause(); ro.disconnect(); renderer.dispose(); },
    quality: Q,
  };
}
