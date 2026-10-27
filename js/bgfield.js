// Fixed 3D background behind the whole page: the Conquest AI interactive preview's signal-strand field
// (instanced fiber-optic strands + ground grid + fireflies + automation network), ported and slimmed.
// Theme colours come from the interactive preview's site.json. Scroll (GSAP ScrollTrigger, Lenis on desktop)
// flies the camera across the field and grows the strands; scroll speed adds a gust.
// Phones: fewer strands / particles, pixel ratio 1.0, ~30 fps, and rendering pauses while a
// visible video is playing so playback stays smooth. Everywhere: paused when the tab is hidden.
// ?static, prefers-reduced-motion, ?nogl or no WebGL: a static CSS gradient instead (.bgfield.static).
const q = new URLSearchParams(location.search);
const wrap = document.getElementById('bgfield');
const canvas = wrap && wrap.querySelector('canvas');
const reduced = q.has('static') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
const C = { deep: '#06101F', primary: '#0B4FC4', gold: '#2F8CFF', goldLight: '#7CC4FF', mint: '#E8F1FF', good: '#22D3EE', top: '#BDEBFF' }; // site.json colors
const S = window.__bgfield = { webgl: false, running: false, paused: '', strands: 0, dpr: 0, fps: 0, frames: 0, mode: '' };
function glOK() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
function fallback(why) { if (wrap) { wrap.classList.add('static'); wrap.dataset.mode = why; } S.mode = why; }
if (!wrap || !canvas) {}
else if (reduced) fallback('reduced');
else if (q.has('nogl') || !glOK()) fallback('nogl');
else { try { await start(); } catch (e) { console.warn('bgfield: falling back', e && e.message); fallback('nogl'); } }

async function start() {
  const THREE = await import('../vendor/three.module.min.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: mobile ? 'low-power' : 'high-performance' });
  if (!renderer.getContext()) throw new Error('no context');
  const DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);
  const N = mobile ? 2200 : 18000, F = mobile ? 48 : 220, NN = mobile ? 22 : 70, FPS_CAP = mobile ? 30 : 60;
  renderer.setPixelRatio(DPR);
  const deep = new THREE.Color(C.deep); renderer.setClearColor(deep, 1);
  Object.assign(S, { webgl: true, strands: N, dpr: DPR, mode: 'webgl', fpsCap: FPS_CAP });
  wrap.dataset.mode = 'webgl';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // ---- instanced signal strands ----
  const blade = new THREE.PlaneGeometry(0.034, 1, 1, 5); blade.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = blade.index; geo.setAttribute('position', blade.attributes.position); geo.setAttribute('uv', blade.attributes.uv);
  const W = mobile ? 7 : 14, Z0 = -26, Z1 = 5;
  const off = new Float32Array(N * 3), rnd = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const z = Z0 + Math.pow(rand(), 0.85) * (Z1 - Z0);
    off.set([(rand() - .5) * 2 * W * (1 + (Z1 - z) * 0.03), 0, z], i * 3);
    rnd.set([rand(), rand(), rand(), rand()], i * 4);
  }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
  geo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 4));
  geo.instanceCount = N;
  const U = {
    uTime: { value: 0 }, uGrow: { value: 0.35 }, uGust: { value: 0 }, uMouse: { value: new THREE.Vector3(99, 0, 99) }, uStrength: { value: 0 }, uRadius: { value: 2.2 },
    cDeep: { value: deep }, cPrim: { value: new THREE.Color(C.primary) }, cMint: { value: new THREE.Color(C.mint) },
    cGoldL: { value: new THREE.Color(C.goldLight) }, cGood: { value: new THREE.Color(C.good) },
    fogColor: { value: deep }, fogNear: { value: 6 }, fogFar: { value: 20 }
  };
  const grassMat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 aOffset; attribute vec4 aRnd;
      uniform float uTime,uGrow,uGust,uStrength,uRadius; uniform vec3 uMouse;
      varying float vH, vGold, vNear, vR, vFog;
      void main(){
        float h = uv.y; vR = aRnd.z;
        float H = mix(0.2, 0.95, uGrow) * (0.45 + aRnd.x*1.0);
        vec3 p = position; p.x *= (1.0 - h*0.9); p.y = h*H;
        float a = aRnd.y*6.2831; p.xz = mat2(cos(a),-sin(a),sin(a),cos(a)) * p.xz;
        vec3 w = aOffset + p; float bend = h*h;
        float wave = sin(uTime*1.4 + aOffset.x*0.55 + aOffset.z*0.35 + aRnd.z*6.2831);
        float gust = sin(uTime*0.45 + aOffset.x*0.12)*0.5+0.5;
        w.x += (0.10 + 0.16*gust + 0.35*uGust) * wave * bend * H;
        w.z += (0.05 + 0.12*uGust) * cos(uTime*1.1 + aRnd.z*9.0) * bend * H;
        vec2 d = uMouse.xz - aOffset.xz; float dist = length(d);
        float f = smoothstep(uRadius, 0.0, dist) * uStrength;
        w.xz += (d/(dist+1e-3)) * min(dist, 1.1*H) * f * bend; w.y -= 0.35 * f * bend * H;
        vNear = f; vH = h;
        vGold = step(1.0 - 0.28*smoothstep(0.55,1.0,uGrow), aRnd.w);
        vec4 mv = modelViewMatrix * vec4(w,1.0); vFog = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 cDeep,cPrim,cMint,cGoldL,fogColor; uniform float fogNear,fogFar,uGrow,uTime;
      varying float vH, vGold, vNear, vR, vFog;
      void main(){
        vec3 col = mix(cDeep*0.8, cPrim*0.85, smoothstep(0.0,0.75,vH));
        col = mix(col, cGoldL, smoothstep(0.72,1.0,vH)*0.55);
        float ph = fract(uTime*(0.22+0.25*vR) + vR*7.0);
        col += cGoldL * smoothstep(0.09, 0.0, abs(ph - vH)) * (0.25 + 0.75*uGrow) * 0.9;
        col = mix(col, cMint, vGold*smoothstep(0.75,1.0,vH)*0.75);
        col += cGoldL * vNear * 0.75 * vH;
        gl_FragColor = vec4(mix(col, fogColor, smoothstep(fogNear, fogFar, vFog)), 1.0);
      }`
  });
  const grass = new THREE.Mesh(geo, grassMat); grass.frustumCulled = false; scene.add(grass);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), new THREE.ShaderMaterial({ uniforms: U,
    vertexShader: `varying vec3 vW; varying float vFog; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vec4 mv=viewMatrix*w; vFog=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vW; varying float vFog; uniform vec3 cDeep,cPrim,cGoldL,fogColor; uniform float fogNear,fogFar,uGrow,uTime;
      void main(){ vec2 g=abs(fract(vW.xz*0.8)-0.5); float l=1.0-smoothstep(0.0,0.035,min(g.x,g.y));
        float sweep=smoothstep(1.2,0.0,abs(fract(uTime*0.06)*30.0-12.0+vW.z*-1.0));
        vec3 c=cDeep*0.7 + cPrim*l*(0.18+0.25*uGrow) + cGoldL*l*sweep*0.25;
        gl_FragColor=vec4(mix(c,fogColor,smoothstep(fogNear,fogFar,vFog)),1.0); }` }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -10; scene.add(ground);

  // ---- fireflies ----
  const fp = new Float32Array(F * 3), fr = new Float32Array(F);
  for (let i = 0; i < F; i++) { fp.set([(rand() - .5) * 2 * W, rand() * 3.2, Z0 + rand() * (Z1 - Z0)], i * 3); fr[i] = rand(); }
  const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fgeo.setAttribute('aR', new THREE.BufferAttribute(fr, 1));
  scene.add(new THREE.Points(fgeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: U,
    vertexShader: `attribute float aR; uniform float uTime,uGrow; varying float vA;
      void main(){ vec3 p=position; p.y += sin(uTime*0.6+aR*20.0)*0.25; p.x += cos(uTime*0.4+aR*12.0)*0.3;
        vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=(3.0+aR*5.0)*(6.0/-mv.z);
        vA=(0.25+0.75*uGrow)*(0.4+0.6*sin(uTime*2.0+aR*30.0)*0.5+0.3); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 cGoldL; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); gl_FragColor=vec4(cGoldL, smoothstep(0.5,0.0,d)*vA); }` })));

  // ---- automation network ----
  const nodes = [];
  for (let i = 0; i < NN; i++) nodes.push(new THREE.Vector3((rand() - .5) * 2 * W * 0.85, 1.8 + rand() * 3.6, Z0 + 2 + rand() * (Z1 - Z0 - 4)));
  const edges = [];
  nodes.forEach((a, i) => { nodes.map((b, j) => [j, a.distanceTo(b)]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 2).forEach(([j]) => { if (!edges.some(([x, y]) => x === j && y === i)) edges.push([i, j]); }); });
  const lp = new Float32Array(edges.length * 6), lt = new Float32Array(edges.length * 2), lr = new Float32Array(edges.length * 2);
  edges.forEach(([i, j], e) => { lp.set([...nodes[i].toArray(), ...nodes[j].toArray()], e * 6); lt.set([0, 1], e * 2); const r = rand(); lr.set([r, r], e * 2); });
  const lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lgeo.setAttribute('aT', new THREE.BufferAttribute(lt, 1)); lgeo.setAttribute('aR', new THREE.BufferAttribute(lr, 1));
  scene.add(new THREE.LineSegments(lgeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: U,
    vertexShader: `attribute float aT, aR; varying float vT, vR, vD; void main(){ vT=aT; vR=aR; vec4 mv=modelViewMatrix*vec4(position,1.0); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 cPrim,cGoldL; uniform float uGrow,uTime; varying float vT, vR, vD;
      void main(){ float on = smoothstep(vR, vR+0.08, 0.15 + 0.9*uGrow);
        float pulse = smoothstep(0.12, 0.0, abs(fract(uTime*0.35 + vR*5.0) - vT));
        float fade = 1.0 - smoothstep(8.0, 20.0, vD);
        gl_FragColor = vec4(mix(cPrim, cGoldL, 0.35 + 0.65*pulse*on), (0.07 + 0.30*on + 0.55*pulse*on) * fade); }` })));
  const np = new Float32Array(NN * 3), nr = new Float32Array(NN); nodes.forEach((n, i) => { np.set(n.toArray(), i * 3); nr[i] = rand(); });
  const ngeo = new THREE.BufferGeometry(); ngeo.setAttribute('position', new THREE.BufferAttribute(np, 3)); ngeo.setAttribute('aR', new THREE.BufferAttribute(nr, 1));
  scene.add(new THREE.Points(ngeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: U,
    vertexShader: `attribute float aR; uniform float uGrow,uTime; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0);
      float on = smoothstep(aR, aR+0.1, 0.1 + 0.95*uGrow); gl_PointSize=(5.0+9.0*on)*(7.0/-mv.z);
      vA=(0.2+0.8*on)*(0.75+0.25*sin(uTime*2.2+aR*40.0))*(1.0-smoothstep(8.0,20.0,-mv.z)); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 cGoldL,cMint; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); gl_FragColor=vec4(mix(cGoldL,cMint,smoothstep(0.25,0.0,d)), a*a*vA); }` })));

  // ---- size ----
  let cw = 0, ch = 0;
  function resize() {
    const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
    if (w === cw && Math.abs(h - ch) < 80 && ch) return; // ignore phone URL-bar jitter
    cw = w; ch = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', () => { resize(); kick(); }); resize();

  // ---- scroll progress: GSAP ScrollTrigger when present (Lenis drives it on desktop), else native ----
  let prog = 0, lastY = scrollY, gust = 0;
  const readProg = () => { const m = Math.max(1, document.documentElement.scrollHeight - innerHeight); return Math.min(1, Math.max(0, scrollY / m)); };
  const ST = window.ScrollTrigger;
  if (ST) ST.create({ trigger: document.body, start: 'top top', end: 'bottom bottom', onUpdate: s => { prog = s.progress; kick(); } });
  addEventListener('scroll', () => { if (!ST) prog = readProg(); const dy = Math.abs(scrollY - lastY); lastY = scrollY; gust = Math.min(1, gust + dy / 500); kick(); }, { passive: true });
  prog = readProg();

  // ---- pointer (desktop only): strands bend around the cursor ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const target = new THREE.Vector3(99, 0, 99), smooth = new THREE.Vector3(0, 0, 0); let lastMove = -1e9, mx = 0;
  if (!mobile) addEventListener('pointermove', e => {
    mx = e.clientX / innerWidth - .5; ndc.set(mx * 2, Math.min(-0.05, -(e.clientY / innerHeight) * 2 + 1));
    ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(plane, hit)) target.copy(hit); lastMove = performance.now(); kick();
  }, { passive: true });

  // ---- pause rules: tab hidden; on phones while a visible video is playing ----
  const vis = new Map();
  const io = new IntersectionObserver(es => es.forEach(e => vis.set(e.target, e.intersectionRatio > 0.25)), { threshold: [0, 0.25, 0.5] });
  document.querySelectorAll('video').forEach(v => io.observe(v));
  function videoPlaying() { for (const v of document.querySelectorAll('video')) if (!v.paused && !v.ended && v.readyState > 2 && (vis.get(v) || v.closest('.tour:not([hidden])'))) return true; return false; }
  document.addEventListener('play', () => kick(), true); document.addEventListener('pause', () => kick(), true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); kick(); } });
  let pollT = 0;

  let raf = 0, last = performance.now(), lastDraw = 0, simT = 0, fpsN = 0, fpsT = performance.now(), camZ = 4.5;
  const look = new THREE.Vector3();
  function kick() { if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    if (document.hidden) { S.running = false; S.paused = 'hidden'; return; }
    if (mobile && videoPlaying()) { S.running = false; S.paused = 'video'; clearTimeout(pollT); pollT = setTimeout(kick, 700); return; }
    S.paused = ''; S.running = true;
    raf = requestAnimationFrame(frame);
    if (now - lastDraw < 1000 / FPS_CAP - 2) return;
    lastDraw = now;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; simT += dt;
    U.uTime.value = simT;
    gust *= Math.exp(-1.4 * dt); U.uGust.value = gust;
    U.uGrow.value += ((0.35 + 0.65 * prog) - U.uGrow.value) * (1 - Math.exp(-4 * dt));
    // camera flies across the field as you scroll down the page (reversible)
    const tz = 4.5 - prog * 16; camZ += (tz - camZ) * (1 - Math.exp(-5 * dt));
    camera.position.set(mx * 0.6 + Math.sin(simT * 0.12) * 0.25, 1.35 + Math.sin(prog * Math.PI) * 0.7, camZ);
    look.set(mx * 0.4, 0.55 + prog * 0.3, camZ - 8); camera.lookAt(look);
    const idle = now - lastMove > 2500;
    if (idle) target.set(Math.sin(simT * 0.35) * W * 0.35, 0, camZ - 4 + Math.sin(simT * 0.21) * 1.5);
    smooth.lerp(target, 1 - Math.exp(-8 * dt)); U.uMouse.value.copy(smooth); U.uStrength.value = idle ? 0.5 : 0.85;
    renderer.render(scene, camera);
    S.frames++; fpsN++;
    if (now - fpsT > 1000) { S.fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
  }
  S.kick = kick; S.prog = () => prog;
  kick();
}
