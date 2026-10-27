// "Your AI team" build section (after the film). Ported from the Conquest AI interactive preview's story
// panel: glowing blue grass field behind the text, automation-network lines + nodes, fireflies, and the
// build-progress gauge (illustrative) with the Receptionist / Follow-up / Your agent bars fading in.
// Scroll position (native scroll, no pinning) drives the gauge and the network lighting up.
// Light on phones (fewer blades/nodes/particles, DPR capped at 1.25), paused when off-screen or hidden.
// prefers-reduced-motion, ?static, ?nogl or no WebGL: static gradient field, gauge shown complete.
const q = new URLSearchParams(location.search);
const sec = document.querySelector('.buildfx');
const canvas = sec && sec.querySelector('canvas');
const reduced = q.has('static') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
const B = window.__build = { webgl: false, running: false, blades: 0, nodes: 0, fireflies: 0, dpr: 0, fps: 0, frames: 0, p: 0 };
const ring = sec && sec.querySelector('.bx-ring-fg'), gnum = sec && sec.querySelector('.bx-num');
const cards = sec ? [...sec.querySelectorAll('.bx-card')] : [];
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let lastShown = -1;
function setGauge(g) { // g: 0..1
  if (!sec) return;
  const pct = Math.round(g * 100);
  if (pct !== lastShown) { lastShown = pct; gnum.textContent = pct + '%'; ring.style.strokeDasharray = (0.75 * g).toFixed(4) + ' 1'; }
  cards.forEach((c, i) => { const a = sstep(0.12 + i * 0.16, 0.34 + i * 0.16, g); c.style.opacity = a.toFixed(3); c.style.transform = `translateY(${((1 - a) * 10).toFixed(1)}px)`;
    const v = Math.round(sstep(0.12 + i * 0.16, 0.62 + i * 0.12, g) * 100); c.querySelector('b').textContent = v + '%'; c.querySelector('i').style.setProperty('--w', v + '%'); });
}
function progress() { // 0 as the section enters, 1 once its middle passes ~45% of the viewport
  const r = sec.getBoundingClientRect(); const start = innerHeight * 0.9, end = innerHeight * 0.6 - r.height * 0.5;
  return q.has('bx') ? +q.get('bx') : Math.min(1, Math.max(0, (start - r.top) / (start - end)));
}
function glOK() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
function fallback(why) { sec.classList.add('static'); sec.dataset.mode = why; B.mode = why; setGauge(1); }
if (!sec || !canvas) { /* nothing */ }
else if (reduced) fallback('reduced');
else if (q.has('nogl') || !glOK()) fallback('nogl');
else {
  setGauge(0);
  try { await start(); } catch (e) { console.warn('buildfx: falling back', e && e.message); fallback('nogl'); }
}

async function start() {
  const THREE = await import('../vendor/three.module.min.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: mobile ? 'low-power' : 'high-performance' });
  if (!renderer.getContext()) throw new Error('no context');
  const N = mobile ? 3200 : 10000, NN = mobile ? 40 : 90, F = mobile ? 90 : 260;
  const DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  renderer.setPixelRatio(DPR); renderer.setClearColor(0x050B18, 1);
  Object.assign(B, { webgl: true, blades: N, nodes: NN, fireflies: F, dpr: DPR, mode: 'webgl' }); sec.dataset.mode = 'webgl';
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
  const bg = new THREE.Color('#050B18');
  let seed = 23; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const U = { uTime: { value: 0 }, uGrow: { value: 0 }, uW: { value: 6 }, uMouse: { value: new THREE.Vector3(99, 0, 99) }, uStrength: { value: 0.5 },
    cDeep: { value: new THREE.Color('#081226') }, cBlue: { value: new THREE.Color('#1F6FFF') }, cSky: { value: new THREE.Color('#7CC4FF') }, cCyan: { value: new THREE.Color('#22D3EE') },
    fogColor: { value: bg }, fogNear: { value: 5 }, fogFar: { value: 16 } };

  // grass field (same blade shader family as the hero band, brighter glow)
  const blade = new THREE.PlaneGeometry(0.05, 1, 1, 4); blade.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry(); geo.index = blade.index; geo.setAttribute('position', blade.attributes.position); geo.setAttribute('uv', blade.attributes.uv);
  const Z0 = -12, Z1 = 3, off = new Float32Array(N * 3), rnd = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { off.set([rand() * 2 - 1, 0, Z0 + Math.pow(rand(), 0.7) * (Z1 - Z0)], i * 3); rnd.set([rand(), rand(), rand(), rand()], i * 4); }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3)); geo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 4)); geo.instanceCount = N;
  const gmat = new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 aOffset; attribute vec4 aRnd; uniform float uTime,uW,uStrength; uniform vec3 uMouse; varying float vH, vR, vFog, vNear;
      void main(){ float h=uv.y; vR=aRnd.z; float H=0.45+aRnd.x*0.7; vec3 o=aOffset; o.x*=uW*(1.0+(3.0-o.z)*0.09);
        vec3 p=position; p.x*=(1.0-h*0.9); p.y=h*H; float a=aRnd.y*6.2831; p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
        vec3 w=o+p; float bend=h*h; w.x+=(0.1+0.12*sin(uTime*0.45+o.x*0.12))*sin(uTime*1.3+o.x*0.55+o.z*0.35+aRnd.z*6.2831)*bend*H;
        vec2 d=o.xz-uMouse.xz; float dist=length(d); float f=smoothstep(1.6,0.0,dist)*uStrength; w.xz+=(d/(dist+1e-3))*min(1.6-dist*0.5,0.9*H)*f*bend; w.y-=0.3*f*bend*H; vNear=f;
        vH=h; vec4 mv=modelViewMatrix*vec4(w,1.0); vFog=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 cDeep,cBlue,cSky,cCyan,fogColor; uniform float fogNear,fogFar,uTime,uGrow; varying float vH, vR, vFog, vNear;
      void main(){ vec3 col=mix(cDeep*0.7, cBlue*(0.5+0.25*uGrow), smoothstep(0.0,0.85,vH)); col=mix(col,cSky*0.85,smoothstep(0.8,1.0,vH)*0.5);
        float ph=fract(uTime*(0.2+0.25*vR)+vR*7.0); col+=cSky*smoothstep(0.08,0.0,abs(ph-vH))*(0.35+0.35*uGrow); col+=cCyan*vNear*0.8*vH;
        gl_FragColor=vec4(mix(col,fogColor,smoothstep(fogNear,fogFar,vFog)),1.0); }` });
  const grass = new THREE.Mesh(geo, gmat); grass.frustumCulled = false; scene.add(grass);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.ShaderMaterial({ uniforms: U,
    vertexShader: `varying vec3 vW; varying float vFog; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vec4 mv=viewMatrix*w; vFog=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vW; varying float vFog; uniform vec3 cDeep,cBlue,fogColor; uniform float fogNear,fogFar,uGrow;
      void main(){ vec2 g=abs(fract(vW.xz*0.8)-0.5); float l=1.0-smoothstep(0.0,0.035,min(g.x,g.y)); vec3 c=cDeep*0.8+cBlue*l*(0.12+0.18*uGrow);
        gl_FragColor=vec4(mix(c,fogColor,smoothstep(fogNear,fogFar,vFog)),1.0); }` }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -8; scene.add(ground);

  // fireflies
  const fp = new Float32Array(F * 3), fr = new Float32Array(F);
  for (let i = 0; i < F; i++) { fp.set([(rand() - 0.5) * 14, rand() * 2.4, Z0 + rand() * (Z1 - Z0)], i * 3); fr[i] = rand(); }
  const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fgeo.setAttribute('aR', new THREE.BufferAttribute(fr, 1));
  const uPx = { value: DPR };
  scene.add(new THREE.Points(fgeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: Object.assign({ uPx }, U),
    vertexShader: `attribute float aR; uniform float uTime,uGrow,uPx; varying float vA; void main(){ vec3 p=position; p.y+=sin(uTime*0.6+aR*20.0)*0.25; p.x+=cos(uTime*0.4+aR*12.0)*0.3;
      vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=min(12.0,(3.0+aR*5.0)*uPx*(5.0/-mv.z)); vA=(0.3+0.7*uGrow)*(0.4+0.6*(0.5+0.5*sin(uTime*2.0+aR*30.0))); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 cSky; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); gl_FragColor=vec4(cSky, smoothstep(0.5,0.0,d)*vA); }` })));

  // automation network: nodes + links that light up as the build fills (uGrow)
  const nodes = []; for (let i = 0; i < NN; i++) nodes.push(new THREE.Vector3((rand() - 0.5) * 13, 1.6 + rand() * 3.6, -14 + rand() * 11));
  const edges = []; nodes.forEach((a, i) => { nodes.map((b, j) => [j, a.distanceTo(b)]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 2).forEach(([j]) => { if (!edges.some(([x, y]) => x === j && y === i)) edges.push([i, j]); }); });
  const lp = new Float32Array(edges.length * 6), lt = new Float32Array(edges.length * 2), lr = new Float32Array(edges.length * 2);
  edges.forEach(([i, j], e) => { lp.set([...nodes[i].toArray(), ...nodes[j].toArray()], e * 6); lt.set([0, 1], e * 2); const r = rand(); lr.set([r, r], e * 2); });
  const lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lgeo.setAttribute('aT', new THREE.BufferAttribute(lt, 1)); lgeo.setAttribute('aR', new THREE.BufferAttribute(lr, 1));
  scene.add(new THREE.LineSegments(lgeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: U,
    vertexShader: `attribute float aT, aR; varying float vT, vR, vD; void main(){ vT=aT; vR=aR; vec4 mv=modelViewMatrix*vec4(position,1.0); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 cBlue,cSky; uniform float uGrow,uTime; varying float vT, vR, vD;
      void main(){ float on=smoothstep(vR,vR+0.08,0.15+0.9*uGrow); float pulse=smoothstep(0.12,0.0,abs(fract(uTime*0.35+vR*5.0)-vT)); float fade=1.0-smoothstep(10.0,22.0,vD);
        gl_FragColor=vec4(mix(cBlue,cSky,0.35+0.65*pulse*on), (0.07+0.30*on+0.55*pulse*on)*fade); }` })));
  const np = new Float32Array(NN * 3), nr = new Float32Array(NN); nodes.forEach((n, i) => { np.set(n.toArray(), i * 3); nr[i] = rand(); });
  const ngeo = new THREE.BufferGeometry(); ngeo.setAttribute('position', new THREE.BufferAttribute(np, 3)); ngeo.setAttribute('aR', new THREE.BufferAttribute(nr, 1));
  scene.add(new THREE.Points(ngeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: Object.assign({ uPx }, U),
    vertexShader: `attribute float aR; uniform float uGrow,uTime,uPx; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); float on=smoothstep(aR,aR+0.1,0.1+0.95*uGrow);
      gl_PointSize=min(16.0,(5.0+9.0*on)*uPx*(5.0/-mv.z)); vA=(0.2+0.8*on)*(0.75+0.25*sin(uTime*2.2+aR*40.0))*(1.0-smoothstep(10.0,22.0,-mv.z)); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 cSky,cCyan; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); gl_FragColor=vec4(mix(cSky,cCyan,smoothstep(0.25,0.0,d)), a*a*vA); }` })));

  let cw = 0, chh = 0;
  function resize() {
    const r = sec.getBoundingClientRect(); const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === cw && h === chh) return; cw = w; chh = h; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = camera.aspect < 0.8 ? 62 : 45; camera.updateProjectionMatrix();
    U.uW.value = Math.max(5, Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 7 * camera.aspect * 1.2);
  }
  new ResizeObserver(() => { resize(); kick(); }).observe(sec); resize();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const target = new THREE.Vector3(99, 0, 99), smooth = new THREE.Vector3(0, 0, 0); let lastMove = -1e9, px = 0.5;
  function onPtr(x, y) { const r = sec.getBoundingClientRect(); if (y < r.top || y > r.bottom) return;
    ndc.set(((x - r.left) / r.width) * 2 - 1, Math.min(0.3, -(((y - r.top) / r.height) * 2 - 1))); ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) target.copy(hit); lastMove = performance.now(); px = x / innerWidth; kick(); }
  addEventListener('pointermove', e => onPtr(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; if (t) onPtr(t.clientX, t.clientY); }, { passive: true });
  addEventListener('scroll', () => kick(), { passive: true });

  let onScreen = false, raf = 0, last = performance.now(), simT = 0, fpsN = 0, fpsT = performance.now(), ps = 0;
  new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) kick(); }, { rootMargin: '60px 0px' }).observe(sec);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); kick(); } });
  function kick() { if (!raf && onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  const look = new THREE.Vector3();
  function frame(now) {
    raf = 0;
    if (!onScreen || document.hidden) { B.running = false; return; }
    B.running = true;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; simT += dt; U.uTime.value = simT;
    const p = progress(); ps += (p - ps) * (1 - Math.exp(-6 * dt)); if (Math.abs(ps - p) < 1e-4) ps = p; B.p = +ps.toFixed(3);
    setGauge(ps); U.uGrow.value = ps;
    const portrait = camera.aspect < 0.8;
    camera.position.set((px - 0.5) * 0.3, (portrait ? 1.7 : 1.35) - ps * 0.25, 5.2 - ps * 0.8);
    look.set(0, portrait ? 1.9 : 1.5, -6); camera.lookAt(look);
    if (now - lastMove > 2500) target.set(Math.sin(simT * 0.35) * U.uW.value * 0.45, 0, 0.8 + Math.sin(simT * 0.21) * 1.2);
    smooth.lerp(target, 1 - Math.exp(-8 * dt)); U.uMouse.value.copy(smooth);
    renderer.render(scene, camera);
    B.frames++; fpsN++; if (now - fpsT > 1000) { B.fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
    raf = requestAnimationFrame(frame);
  }
  B.kick = kick; kick();
}
