// Scroll-driven zoom into the swirling agent core ("Mission Control"). Ported from the Conquest AI
// interactive preview (icosahedron core shader, halo, orbit rings with electrons), plus a swirling
// particle cloud. It is a normal tall section with a CSS-sticky stage: the page keeps scrolling natively
// (no pinning, no scroll-jacking), and scroll position only drives the camera. Graphics only, no copy.
// Light on phones (fewer particles, DPR capped at 1.25), paused when off-screen or the tab is hidden.
// prefers-reduced-motion, ?static, ?nogl or no WebGL: a still frame of the orb (media/orb-still.jpg).
const q = new URLSearchParams(location.search);
const sec = document.querySelector('.orbzoom');
const stage = sec && sec.querySelector('.oz-stage');
const canvas = sec && sec.querySelector('canvas');
const reduced = q.has('static') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
const O = window.__orb = { webgl: false, running: false, particles: 0, dpr: 0, fps: 0, frames: 0, p: 0 };
function glOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
function fallback(why) { if (sec) { sec.classList.add('static'); sec.dataset.mode = why; } O.mode = why; }
if (!sec || !canvas) { /* nothing */ }
else if (reduced) fallback('reduced');
else if (q.has('nogl') || !glOK()) fallback('nogl');
else {
  try { await start(); } catch (e) { console.warn('orb: falling back', e && e.message); fallback('nogl'); }
}

async function start() {
  const THREE = await import('../vendor/three.module.min.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: mobile ? 'low-power' : 'high-performance' });
  if (!renderer.getContext()) throw new Error('no context');
  const NP = mobile ? 1800 : 6000, DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  renderer.setPixelRatio(DPR); renderer.setClearColor(0x050B18, 1);
  Object.assign(O, { webgl: true, particles: NP, dpr: DPR, mode: 'webgl' });
  sec.dataset.mode = 'webgl';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
  const cBlue = new THREE.Color('#1F6FFF'), cSky = new THREE.Color('#7CC4FF'), cCyan = new THREE.Color('#22D3EE'), cWhite = new THREE.Color('#E8F3FF');
  const U = { uTime: { value: 0 }, uZ: { value: 0 }, uPx: { value: DPR } };
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const CR = 0.25;

  // core (same shader idea as the source's agent core, in the funnel's blue palette)
  const coreMat = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uO: U.uZ, cA: { value: cBlue }, cB: { value: cSky }, cW: { value: cCyan } },
    vertexShader: `uniform float uTime,uO; varying vec3 vN, vV; varying float vNz;
      void main(){ vec3 p=position; float n=sin(dot(p,vec3(9.0,4.0,-3.0))+uTime*1.3)*0.5+sin(dot(p,vec3(-3.0,8.0,5.0))-uTime*1.1)*0.5;
        p += normal*n*0.006*(1.0+1.2*uO); vNz=n; vec4 mv=modelViewMatrix*vec4(p,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uO,uTime; uniform vec3 cA,cB,cW; varying vec3 vN, vV; varying float vNz;
      void main(){ float f=pow(1.0-max(dot(vN,vV),0.0),2.0);
        vec3 c=mix(cA*0.45, cB, smoothstep(0.0,0.9,f)) + cW*pow(f,2.5)*0.9 + cB*max(vNz,0.0)*0.25*(0.4+0.6*uO);
        float bands=smoothstep(0.92,1.0,sin((vN.y*14.0)+uTime*1.5))*0.18; c+=cB*bands;
        c *= 0.75+0.45*uO; gl_FragColor=vec4(c,1.0); }` });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(CR, mobile ? 4 : 6), coreMat); scene.add(core);
  const glowMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: U.uTime, uO: U.uZ, cA: { value: cBlue }, cB: { value: cSky } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `varying vec2 vUv; uniform float uO,uTime; uniform vec3 cA,cB;
      void main(){ float r=length(vUv-0.5); float c=smoothstep(0.5,0.0,r); c*=c; float k=(0.45+0.55*uO)*(0.9+0.1*sin(uTime*2.0));
        gl_FragColor=vec4(mix(cA,cB,c)*c*k, c*k); }` });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), glowMat); halo.position.z = -0.3; scene.add(halo);
  const ringMat = new THREE.MeshBasicMaterial({ color: cSky, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const rings = [[CR * 1.38, 0.0055, 1.2, 0.3], [CR * 1.58, 0.004, -0.9, -0.5], [CR * 1.25, 0.0035, 0.6, 1.1], [CR * 1.9, 0.003, 0.45, -1.0]].map(([r, w, sp, tilt]) => {
    const g = new THREE.Group(); g.rotation.x = 1.2 + tilt * 0.3; g.rotation.y = tilt;
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, w, 6, mobile ? 64 : 120), ringMat); g.add(m);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), ringMat); dot.position.set(r, 0, 0); m.add(dot);
    scene.add(g); return { g, m, sp };
  });

  // swirling particle cloud: shells orbiting the core on tilted planes, computed in the vertex shader
  const pos = new Float32Array(NP * 3), aR = new Float32Array(NP * 4);
  for (let i = 0; i < NP; i++) {
    const shell = rand() < 0.72 ? 0.38 + Math.pow(rand(), 1.6) * 0.9 : 1.3 + rand() * 2.6;
    pos.set([shell, (rand() - 0.5) * 0.06 * shell, rand() * 6.2831], i * 3); // radius, height jitter, phase
    aR.set([rand(), (rand() - 0.5) * 2.4, (rand() - 0.5) * 2.4, rand()], i * 4); // speed seed, tilt x, tilt z, twinkle
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('aR', new THREE.BufferAttribute(aR, 4));
  const pmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.uTime, uZ: U.uZ, uPx: U.uPx, cA: { value: cBlue }, cB: { value: cSky }, cW: { value: cWhite } },
    vertexShader: `attribute vec4 aR; uniform float uTime,uZ,uPx; varying float vA, vC;
      void main(){ float r=position.x; float w=(0.25+0.55*aR.x)*(1.0+1.8*uZ)/sqrt(r);
        float a=position.z + uTime*w; vec3 p=vec3(cos(a)*r, position.y, sin(a)*r);
        float cx=cos(aR.y*0.5), sx=sin(aR.y*0.5); p.yz=mat2(cx,-sx,sx,cx)*p.yz;
        float cz=cos(aR.z*0.5), sz=sin(aR.z*0.5); p.xy=mat2(cz,-sz,sz,cz)*p.xy;
        vec4 mv=modelViewMatrix*vec4(p,1.0); float d=-mv.z;
        gl_PointSize=min(14.0, (2.0+aR.w*3.0)*uPx*(3.0/max(d,0.2)));
        vA=(0.35+0.65*(0.5+0.5*sin(uTime*2.0+aR.w*40.0))) * smoothstep(0.12,0.6,d) * (r<1.3?1.0:0.6);
        vC=smoothstep(1.3,0.35,r); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 cA,cB,cW; varying float vA, vC; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d);
        vec3 c=mix(mix(cA,cB,vC), cW, smoothstep(0.2,0.0,d)*0.6); gl_FragColor=vec4(c, a*a*vA); }` });
  const cloud = new THREE.Points(pg, pmat); cloud.frustumCulled = false; scene.add(cloud);

  // sign above the core (graphic, part of the scene like the source's door sign)
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 128; const sx = sc.getContext('2d');
  sx.textAlign = 'center'; sx.fillStyle = '#7CC4FF'; sx.font = '800 54px Inter, system-ui, sans-serif'; sx.fillText('MISSION CONTROL', 256, 62);
  sx.font = '700 30px Inter, system-ui, sans-serif'; sx.fillStyle = '#22D3EE'; sx.fillText('BY CONQUEST AI', 256, 108);
  const signTex = new THREE.CanvasTexture(sc); signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.155), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, depthWrite: false }));
  sign.position.set(0, CR + 0.27, 0); scene.add(sign);

  let cw = 0, chh = 0;
  function resize() {
    const r = stage.getBoundingClientRect(); const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === cw && h === chh) return; cw = w; chh = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = camera.aspect < 0.8 ? 55 : 40; camera.updateProjectionMatrix();
  }
  new ResizeObserver(() => { resize(); kick(); }).observe(stage); resize();

  let mx = 0, my = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
  addEventListener('scroll', () => kick(), { passive: true });

  let onScreen = false, raf = 0, last = performance.now(), simT = 0, fpsN = 0, fpsT = performance.now(), ps = 0;
  new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) kick(); }, { rootMargin: '60px 0px' }).observe(sec);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); kick(); } });
  function kick() { if (!raf && onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  const io = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const look = new THREE.Vector3(0, 0.03, 0);
  function progress() { // 0 when the section top reaches the top of the viewport, 1 when the stage is about to leave
    const r = sec.getBoundingClientRect(); const span = Math.max(1, r.height - innerHeight);
    return q.has('oz') ? +q.get('oz') : Math.min(1, Math.max(0, -r.top / span));
  }
  function frame(now) {
    raf = 0;
    if (!onScreen || document.hidden) { O.running = false; return; }
    O.running = true;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; simT += dt; U.uTime.value = simT;
    const p = progress(); ps += (p - ps) * (1 - Math.exp(-8 * dt)); if (Math.abs(ps - p) < 1e-4) ps = p;
    const z = io(ps); U.uZ.value = z; O.p = +ps.toFixed(3);
    const portrait = camera.aspect < 0.8;
    const far = portrait ? 5.6 : 4.4, near = portrait ? 1.6 : 1.38;
    const d = far + (near - far) * z, orbit = simT * 0.06 + mx * 0.4 * (1 - z) - 0.5 * z;
    camera.position.set(Math.sin(orbit) * d, 0.55 * (1 - z) + 0.06 - my * 0.3 * (1 - z), Math.cos(orbit) * d);
    camera.lookAt(look);
    halo.quaternion.copy(camera.quaternion); sign.quaternion.copy(camera.quaternion);
    core.scale.setScalar(0.92 + 0.14 * z + 0.015 * Math.sin(simT * 2.4)); core.rotation.y = simT * 0.15;
    rings.forEach(r => { r.m.rotation.z = simT * r.sp * (0.6 + 1.6 * z); });
    renderer.render(scene, camera);
    O.frames++; fpsN++;
    if (now - fpsT > 1000) { O.fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
    raf = requestAnimationFrame(frame);
  }
  O.kick = kick;
  kick();
}
