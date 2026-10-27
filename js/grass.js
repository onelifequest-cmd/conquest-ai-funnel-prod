// Interactive grass band at the foot of the hero. Ported from the Conquest AI interactive preview
// (instanced signal-strand grass, Three.js r170, self-hosted). It lives in its own strip below the hero
// content, so it never sits over text, buttons or video. Reacts to the cursor/finger and to scrolling.
// Light on phones (fewer blades, DPR capped at 1.25), paused when off-screen or the tab is hidden.
// prefers-reduced-motion, ?static, ?nogl or no WebGL: a static CSS gradient instead.
const q = new URLSearchParams(location.search);
const band = document.querySelector('.grass-band');
const canvas = band && band.querySelector('canvas');
const reduced = q.has('static') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
const G = window.__grass = { webgl: false, running: false, blades: 0, dpr: 0, fps: 0, frames: 0 };
function glOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
function fallback(why) { if (band) { band.classList.add('static'); band.dataset.mode = why; } G.mode = why; }
if (!band || !canvas) { /* nothing to do */ }
else if (reduced) fallback('reduced');
else if (q.has('nogl') || !glOK()) fallback('nogl');
else {
  try { await start(); } catch (e) { console.warn('grass: falling back', e && e.message); fallback('nogl'); }
}

async function start() {
  const THREE = await import('../vendor/three.module.min.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: mobile ? 'low-power' : 'high-performance' });
  if (!renderer.getContext()) throw new Error('no context');
  const N = mobile ? 4500 : 14000, DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  renderer.setPixelRatio(DPR); renderer.setClearColor(0x000000, 0);
  Object.assign(G, { webgl: true, blades: N, dpr: DPR, mode: 'webgl' });
  band.dataset.mode = 'webgl';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 4, 0.1, 40);
  const bg = new THREE.Color('#050B18');
  let seed = 11; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const blade = new THREE.PlaneGeometry(0.05, 1, 1, 5); blade.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = blade.index; geo.setAttribute('position', blade.attributes.position); geo.setAttribute('uv', blade.attributes.uv);
  const Z0 = -7, Z1 = 3.2, off = new Float32Array(N * 3), rnd = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    off.set([rand() * 2 - 1, 0, Z0 + Math.pow(rand(), 0.65) * (Z1 - Z0)], i * 3);
    rnd.set([rand(), rand(), rand(), rand()], i * 4);
  }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
  geo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 4));
  geo.instanceCount = N;
  const U = {
    uTime: { value: 0 }, uW: { value: 8 }, uMouse: { value: new THREE.Vector3(99, 0, 99) }, uStrength: { value: 0 },
    uRadius: { value: 1.5 }, uGust: { value: 0 },
    cDeep: { value: new THREE.Color('#081226') }, cBlue: { value: new THREE.Color('#1F6FFF') },
    cSky: { value: new THREE.Color('#7CC4FF') }, cCyan: { value: new THREE.Color('#22D3EE') },
    fogColor: { value: bg }, fogNear: { value: 4.5 }, fogFar: { value: 11.5 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 aOffset; attribute vec4 aRnd;
      uniform float uTime,uW,uStrength,uRadius,uGust; uniform vec3 uMouse;
      varying float vH, vNear, vR, vFog;
      void main(){
        float h = uv.y; vR = aRnd.z;
        float H = 0.42 + aRnd.x*0.62;
        vec3 o = aOffset; o.x *= uW * (1.0 + (3.2 - o.z)*0.07);
        vec3 p = position; p.x *= (1.0 - h*0.9); p.y = h*H;
        float a = aRnd.y*6.2831; p.xz = mat2(cos(a),-sin(a),sin(a),cos(a)) * p.xz;
        vec3 w = o + p; float bend = h*h;
        float wave = sin(uTime*1.3 + o.x*0.55 + o.z*0.35 + aRnd.z*6.2831);
        float gust = sin(uTime*0.45 + o.x*0.12)*0.5+0.5;
        w.x += (0.08 + 0.14*gust + 0.30*uGust) * wave * bend * H;
        w.z += (0.04 + 0.10*uGust) * cos(uTime*1.1 + aRnd.z*9.0) * bend * H;
        vec2 d = o.xz - uMouse.xz; float dist = length(d);
        float f = smoothstep(uRadius, 0.0, dist) * uStrength;
        w.xz += (d/(dist+1e-3)) * min(uRadius - dist*0.5, 0.9*H) * f * bend;
        w.y -= 0.30 * f * bend * H;
        vNear = f; vH = h;
        vec4 mv = modelViewMatrix * vec4(w,1.0); vFog = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 cDeep,cBlue,cSky,cCyan,fogColor; uniform float fogNear,fogFar,uTime;
      varying float vH, vNear, vR, vFog;
      void main(){
        vec3 col = mix(cDeep*0.7, cBlue*0.55, smoothstep(0.0,0.85,vH));
        col = mix(col, cSky*0.8, smoothstep(0.8,1.0,vH)*0.45);
        float ph = fract(uTime*(0.2+0.25*vR) + vR*7.0);
        col += cSky * smoothstep(0.08, 0.0, abs(ph - vH)) * 0.45;
        col += cCyan * vNear * 0.9 * vH;
        gl_FragColor = vec4(mix(col, fogColor, smoothstep(fogNear, fogFar, vFog)), 1.0);
      }`
  });
  const grass = new THREE.Mesh(geo, mat); grass.frustumCulled = false; scene.add(grass);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 24), new THREE.ShaderMaterial({ uniforms: U,
    vertexShader: `varying vec3 vW; varying float vFog; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vec4 mv=viewMatrix*w; vFog=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vW; varying float vFog; uniform vec3 cDeep,cBlue,fogColor; uniform float fogNear,fogFar;
      void main(){ vec2 g=abs(fract(vW.xz*0.8)-0.5); float l=1.0-smoothstep(0.0,0.035,min(g.x,g.y));
        vec3 c=cDeep*0.8 + cBlue*l*0.16; gl_FragColor=vec4(mix(c,fogColor,smoothstep(fogNear,fogFar,vFog)),1.0); }` }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -4; scene.add(ground);

  // size: the canvas fills the band; field width follows the aspect so the strip is always covered
  let cw = 0, ch = 0;
  function resize() {
    const r = band.getBoundingClientRect(); const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === cw && h === ch) return; cw = w; ch = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    U.uW.value = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 6.5 * camera.aspect * 1.15;
  }
  new ResizeObserver(() => { resize(); kick(); }).observe(band); resize();

  // pointer / finger: bend the blades around it while it is over or just above the band
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const target = new THREE.Vector3(99, 0, 99), smooth = new THREE.Vector3(0, 0, 1);
  let lastMove = -1e9, speed = 0, px = 0, py = 0;
  function onPtr(x, y) {
    const r = band.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top - 160 || y > r.bottom) return;
    ndc.set(((x - r.left) / r.width) * 2 - 1, Math.min(0.55, -(((y - r.top) / r.height) * 2 - 1)));
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) target.copy(hit);
    const t = performance.now(); speed = Math.min(1, speed + Math.hypot(x - px, y - py) / 240); px = x; py = y; lastMove = t; kick();
  }
  addEventListener('pointermove', e => onPtr(e.clientX, e.clientY), { passive: true });
  addEventListener('pointerdown', e => onPtr(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; if (t) onPtr(t.clientX, t.clientY); }, { passive: true });

  // scroll: camera rises and pushes in as the band scrolls up; scroll speed adds a gust
  let lastY = scrollY, gust = 0;
  addEventListener('scroll', () => { const dy = Math.abs(scrollY - lastY); lastY = scrollY; gust = Math.min(1, gust + dy / 300); kick(); }, { passive: true });

  // run only while on screen and the tab is visible
  let onScreen = false, raf = 0, last = performance.now(), simT = 0, fpsN = 0, fpsT = performance.now();
  new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) kick(); }, { rootMargin: '80px 0px' }).observe(band);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); kick(); } });
  function kick() { if (!raf && onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  const look = new THREE.Vector3();
  function frame(now) {
    raf = 0;
    if (!onScreen || document.hidden) { G.running = false; return; }
    G.running = true;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; simT += dt;
    U.uTime.value = simT;
    const r = band.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
    camera.position.set((px / innerWidth - 0.5) * 0.3, 1.45 + p * 0.45, 5.0 - p * 1.0);
    look.set(0, 0.05, -1.5); camera.lookAt(look);
    const idle = now - lastMove > 2500;
    if (idle) target.set(Math.sin(simT * 0.35) * U.uW.value * 0.5, 0, 0.6 + Math.sin(simT * 0.21) * 1.0);
    const k = 1 - Math.exp(-8 * dt); smooth.lerp(target, k); U.uMouse.value.copy(smooth);
    speed *= Math.exp(-1.5 * dt); gust *= Math.exp(-1.2 * dt);
    U.uStrength.value = idle ? 0.5 : 0.8 + 0.2 * speed; U.uGust.value = gust;
    renderer.render(scene, camera);
    G.frames++; fpsN++;
    if (now - fpsT > 1000) { G.fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
    raf = requestAnimationFrame(frame);
  }
  G.kick = kick;
  kick();
}
