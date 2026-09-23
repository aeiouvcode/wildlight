// WILDLIGHT: VALLEY RUN — scene engine (vanilla, no framework).
// One codebase drives both the Instinct File app and the GitHub Pages build.
import * as THREE from './vendor/three.module.min.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (rate, dt) => 1 - Math.pow(rate, dt);

// seeded rng so the valley is identical on every load
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260921);
const rand = (a = 1, b) => (b === undefined ? rng() * a : a + rng() * (b - a));

// ---- valley layout -------------------------------------------------------
const PATH = (z) => 6.5 * Math.sin(z * 0.018) + 3.5 * Math.sin(z * 0.007 + 1.7);
const STREAM = (z) => PATH(z) + 9.0 + 3.8 * Math.sin(z * 0.013 + 2.6);
const STREAM_HALF = 3.1;
const baseNoise = (x, z) =>
  Math.sin(x * 0.10 + 1.3) * 0.9 + Math.sin(z * 0.075 + 4.1) * 0.8 +
  Math.sin((x + z) * 0.045 + 2.2) * 1.1 + Math.sin(x * 0.31) * Math.sin(z * 0.27) * 0.35;
function groundH(x, z) {
  let h = baseNoise(x, z);
  const dp = Math.abs(x - PATH(z));
  h *= clamp(dp / 4.5, 0.25, 1);                 // flatten near the path
  const bank = Math.max(0, Math.abs(x) - 40);
  h += bank * bank * 0.012;                       // valley walls
  const ds = Math.abs(x - STREAM(z));
  if (ds < STREAM_HALF + 1.6) {                   // carve the stream bed
    const t = clamp(1 - ds / (STREAM_HALF + 1.6), 0, 1);
    h -= t * t * 1.5;
  }
  return h;
}

// ---- canvas textures -----------------------------------------------------
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opts.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = opts.aniso || 1;
  return t;
}

function groundTexture(trees) {
  return canvasTex(1024, 1680, (g, W, H) => {
    const toU = (x) => (x + 110) / 220 * W, toV = (z) => (z + 180) / 360 * H;
    const sx = W / 220; // px per metre
    g.fillStyle = '#55683a'; g.fillRect(0, 0, W, H);
    // large tonal drift
    for (let i = 0; i < 90; i++) {
      const r = rand(40, 150);
      g.fillStyle = ['#4a5f33', '#5d7040', '#67793f', '#3f5530', '#6b7d43'][i % 5];
      g.globalAlpha = rand(0.05, 0.13);
      g.beginPath(); g.ellipse(rand(W), rand(H), r, r * rand(0.5, 1), rand(TAU), 0, TAU); g.fill();
    }
    // fine mottle
    g.globalAlpha = 1;
    for (let i = 0; i < 5200; i++) {
      g.fillStyle = ['#4c6134', '#5f7340', '#53683a', '#69803f', '#425631'][i % 5];
      g.globalAlpha = rand(0.08, 0.2);
      const r = rand(1.5, 7);
      g.beginPath(); g.ellipse(rand(W), rand(H), r, r * rand(0.4, 1), rand(TAU), 0, TAU); g.fill();
    }
    // damp dark moss under tree clusters
    for (const t of trees) {
      if (rng() > 0.4) continue;
      g.fillStyle = '#3a4f2c'; g.globalAlpha = rand(0.10, 0.22);
      const r = rand(6, 18) * sx * 0.4;
      g.beginPath(); g.ellipse(toU(t.x), toV(t.z), r, r * 0.8, rand(TAU), 0, TAU); g.fill();
    }
    // stream bed — dark wet earth under the water ribbon
    g.globalAlpha = 1; g.strokeStyle = '#37463a'; g.lineCap = 'round';
    g.lineWidth = (STREAM_HALF * 2 + 2.5) * sx;
    g.beginPath();
    for (let z = -180; z <= 180; z += 3) { const u = toU(STREAM(z)), v = toV(z); z === -180 ? g.moveTo(u, v) : g.lineTo(u, v); }
    g.stroke();
    g.strokeStyle = '#2c3a30'; g.lineWidth = STREAM_HALF * 1.4 * sx; g.stroke();
    // the dirt path — layered strokes for a worn, soft-edged trail
    const pathStroke = (width, color, alpha) => {
      g.strokeStyle = color; g.globalAlpha = alpha; g.lineWidth = width * sx;
      g.beginPath();
      for (let z = -180; z <= 180; z += 2) { const u = toU(PATH(z)), v = toV(z); z === -180 ? g.moveTo(u, v) : g.lineTo(u, v); }
      g.stroke();
    };
    pathStroke(4.6, '#6d6248', 0.7);
    pathStroke(3.6, '#827352', 0.8);
    pathStroke(2.4, '#91805c', 0.8);
    pathStroke(1.1, '#7a6c4e', 0.4);   // packed centre line
    // pebbles on the path
    for (let i = 0; i < 1500; i++) {
      const z = rand(-180, 180), off = rand(-1.6, 1.6);
      g.fillStyle = ['#a8926c', '#8b7a5c', '#b5a17a', '#6d5f49'][i % 4];
      g.globalAlpha = rand(0.25, 0.6);
      g.beginPath(); g.arc(toU(PATH(z) + off), toV(z), rand(0.4, 1.6), 0, TAU); g.fill();
    }
    // fallen leaves — amber drifts near the path and under trees
    for (let i = 0; i < 620; i++) {
      const z = rand(-180, 180);
      const nearPath = rng() > 0.35;
      const x = nearPath ? PATH(z) + rand(-4.5, 4.5) : rand(-60, 60);
      g.fillStyle = ['#c67a2e', '#b8642a', '#d18a3a', '#a85c26'][i % 4];
      g.globalAlpha = rand(0.25, 0.5);
      g.save(); g.translate(toU(x), toV(z)); g.rotate(rand(TAU));
      g.beginPath(); g.ellipse(0, 0, rand(0.8, 2.2), rand(0.4, 1.1), 0, 0, TAU); g.fill(); g.restore();
    }
    g.globalAlpha = 1;
  }, { aniso: 4 });
}

function barkTexture(dark) {
  return canvasTex(256, 512, (g, W, H) => {
    g.fillStyle = dark ? '#6b5f4c' : '#e9e3d3'; g.fillRect(0, 0, W, H);
    if (!dark) {
      // creamy vertical streaks
      for (let i = 0; i < 60; i++) {
        g.fillStyle = ['#ded6c2', '#f2ecdd', '#cfc4ac', '#e2d9c6'][i % 4];
        g.globalAlpha = rand(0.2, 0.5);
        g.fillRect(rand(W), 0, rand(3, 18), H);
      }
      // horizontal lenticel dashes — the birch signature
      for (let i = 0; i < 210; i++) {
        g.fillStyle = i % 6 ? '#3c352c' : '#57503f';
        g.globalAlpha = rand(0.5, 0.95);
        g.fillRect(rand(W), rand(H), rand(6, 34), rand(1, 3.4));
      }
      // dark banded patches, heavier toward the base
      for (let i = 0; i < 26; i++) {
        const y = H * (0.35 + 0.65 * rng());
        g.fillStyle = '#2e2a22'; g.globalAlpha = rand(0.35, 0.8);
        const w = rand(20, 90);
        g.beginPath(); g.ellipse(rand(W), y, w, rand(3, 9), 0, 0, TAU); g.fill();
      }
    } else {
      for (let i = 0; i < 240; i++) {
        g.fillStyle = ['#574c3c', '#7a6d57', '#463d30', '#837664'][i % 4];
        g.globalAlpha = rand(0.2, 0.5);
        g.fillRect(rand(W), rand(H), rand(4, 26), rand(2, 10));
      }
    }
    g.globalAlpha = 1;
  }, { repeat: true, aniso: 4 });
}

function foliageTexture() {
  return canvasTex(256, 256, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const blob = (x, y, r, col, a) => {
      g.fillStyle = col; g.globalAlpha = a;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    };
    // ragged silhouette: blobs clustered inside an irregular crown outline
    const cx = W / 2, cy = H / 2;
    // dark interior mass first
    for (let i = 0; i < 260; i++) {
      const a = rand(TAU), d = Math.pow(rng(), 0.6) * 96;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.88;
      blob(x, y, rand(4, 13), ['#243d1c', '#2c4a22', '#335226'][i % 3], rand(0.7, 1));
    }
    // mid greens
    for (let i = 0; i < 220; i++) {
      const a = rand(TAU), d = Math.pow(rng(), 0.55) * 92;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.88;
      blob(x, y, rand(3, 10), ['#41602c', '#4c6f31', '#567a36'][i % 3], rand(0.65, 0.95));
    }
    // sun-kissed outer leaves, biased to the upper-left (light side)
    for (let i = 0; i < 200; i++) {
      const a = rand(TAU), d = Math.pow(rng(), 0.5) * 100;
      const x = cx + Math.cos(a) * d - 14, y = cy + Math.sin(a) * d * 0.88 - 12;
      blob(x, y, rand(1.6, 6), ['#7fa044', '#93ad4c', '#aebc58', '#c6c463'][i % 4], rand(0.5, 0.95));
    }
    // bright speckles
    for (let i = 0; i < 90; i++) {
      const a = rand(TAU), d = Math.pow(rng(), 0.5) * 96;
      blob(cx + Math.cos(a) * d - 12, cy + Math.sin(a) * d * 0.85 - 10, rand(0.8, 2.6), i % 2 ? '#d3d47a' : '#e0d98c', rand(0.6, 1));
    }
    g.globalAlpha = 1;
  });
}

function fernTexture() {
  return canvasTex(256, 256, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.translate(W / 2, H - 8);
    for (let f = 0; f < 7; f++) {
      const ang = -Math.PI / 2 + (f - 3) * 0.34, len = rand(86, 118);
      g.strokeStyle = ['#2c6138', '#356b3c', '#275530'][f % 3];
      g.globalAlpha = 0.95; g.lineWidth = 2.2;
      const ex = Math.cos(ang) * len, ey = Math.sin(ang) * len;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ex * 0.5, ey * 0.7, ex, ey); g.stroke();
      // pinnae
      g.lineWidth = 1.4;
      for (let s = 0.18; s < 0.98; s += 0.075) {
        const px = ex * 0.5 * (2 * s - s * s) * 1.0, py = ey * s * 0.9;
        const ll = (1 - s) * 16 + 3;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - ll, py - ll * 0.35); g.stroke();
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + ll, py - ll * 0.35); g.stroke();
      }
    }
    g.globalAlpha = 1;
  });
}

function dotTexture() {
  const t = canvasTex(64, 64, (g, W, H) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, W, H);
  });
  return t;
}

// ---- geometry helpers ----------------------------------------------------
function crossedPlanes(w, h, n) {
  // n intersecting quads through a common vertical axis; uv.y = 0 at bottom
  const pos = [], uv = [], nor = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
    const base = i * 4;
    for (const [px, py] of [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]]) {
      pos.push(px * ca, py, px * sa);
      nor.push(sa, 0, -ca);
    }
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function bladeTuft() {
  // 5 tapered grass blades in one small geometry, vertex colour root->tip
  const pos = [], nor = [], col = [], idx = [];
  let v = 0;
  const root = new THREE.Color('#4e6334'), tip = new THREE.Color('#b9bd6a');
  for (let b = 0; b < 7; b++) {
    const a = rand(TAU), r = rand(0.02, 0.16);
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
    const h = rand(0.55, 1.05), w = rand(0.035, 0.06);
    const lean = rand(0.06, 0.3), la = rand(TAU);
    const lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;
    const ca = Math.cos(a), sa = Math.sin(a);
    // 3 segments, two verts each + tip
    for (let s = 0; s <= 3; s++) {
      const t = s / 3, y = h * t;
      const cx = bx + lx * t * t, cz = bz + lz * t * t;
      const hw = w * (1 - t * 0.85) * (s === 3 ? 0.08 : 1);
      pos.push(cx - ca * hw, y, cz - sa * hw, cx + ca * hw, y, cz + sa * hw);
      const c = root.clone().lerp(tip, t * t);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      nor.push(0, 1, 0, 0, 1, 0);
    }
    for (let s = 0; s < 3; s++) {
      const b0 = v + s * 2;
      idx.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2);
    }
    v += 8;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

function windMaterial(mat, timeU, amp, freq) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 wip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float wph = wip.x * 0.35 + wip.y * 0.41;
        float wbf = clamp(transformed.y, 0.0, 3.0);
        transformed.x += sin(uTime * ${freq.toFixed(2)} + wph) * ${amp.toFixed(3)} * wbf;
        transformed.z += cos(uTime * ${(freq * 0.77).toFixed(2)} + wph * 1.31) * ${(amp * 0.7).toFixed(3)} * wbf;
      #endif`
    );
  };
  return mat;
}

// ---- sky ------------------------------------------------------------------
function makeSky(sunDir) {
  const geo = new THREE.SphereGeometry(430, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sunDir } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uSun; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.1, 1.0);
        vec3 zen = vec3(0.42, 0.58, 0.62);
        vec3 mid = vec3(0.76, 0.74, 0.62);
        vec3 hor = vec3(0.98, 0.78, 0.52);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, zen, smoothstep(0.18, 0.75, h));
        float s = max(dot(normalize(vDir), normalize(uSun)), 0.0);
        col += vec3(1.0, 0.72, 0.42) * pow(s, 220.0) * 2.6;   // sun disc (HDR for bloom)
        col += vec3(1.0, 0.68, 0.36) * pow(s, 9.0) * 0.3;    // warm glow
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  return new THREE.Mesh(geo, mat);
}

// ---- water ----------------------------------------------------------------
function makeWater(timeU, sunDir) {
  const rows = [];
  for (let z = -180; z <= 180; z += 2.5) rows.push(z);
  const pos = [], uv = [], idx = [];
  rows.forEach((z, i) => {
    const cx = STREAM(z), y = groundH(cx, z) + 0.55;
    pos.push(cx - STREAM_HALF - 0.7, y, z, cx + STREAM_HALF + 0.7, y, z);
    uv.push(0, z * 0.08, 1, z * 0.08);
    if (i > 0) { const b = i * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    transparent: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: timeU, uSun: { value: sunDir },
    }]),
    vertexShader: `
      varying vec2 vUv; varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uSun;
      varying vec2 vUv; varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main(){
        float t = uTime;
        // rippled normal from two crossing wave trains
        float w1 = sin(vWorld.z * 2.1 - t * 2.2 + sin(vWorld.x * 3.0) * 0.8);
        float w2 = sin(vWorld.x * 2.7 + t * 1.4 + vWorld.z * 0.9);
        float w3 = sin((vWorld.x + vWorld.z) * 4.3 - t * 3.1);
        vec3 n = normalize(vec3(w1 * 0.18 + w3 * 0.07, 1.0, w2 * 0.18 + w3 * 0.05));
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(view, n), 0.0), 2.4);
        vec3 deep = vec3(0.09, 0.19, 0.16);
        vec3 shallow = vec3(0.23, 0.38, 0.30);
        vec3 skyRef = vec3(0.95, 0.72, 0.45);
        float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
        vec3 col = mix(shallow, deep, edge);
        col = mix(col, skyRef, fres * 0.75);
        // sun glitter
        vec3 r = reflect(-normalize(uSun), n);
        float spec = pow(max(dot(r, view), 0.0), 120.0);
        col += vec3(1.0, 0.8, 0.5) * spec * 2.4;
        // lapping foam at the banks
        float foamBand = 1.0 - edge;
        float foam = foamBand * (0.45 + 0.55 * sin(vUv.y * 46.0 - t * 2.6 + w1));
        col = mix(col, vec3(0.82, 0.85, 0.74), clamp(foam, 0.0, 1.0) * 0.5);
        gl_FragColor = vec4(col, 0.93);
        #include <fog_fragment>
      }`
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}

// ---- god-ray shafts -------------------------------------------------------
function makeShaft(timeU) {
  const geo = crossedPlanes(4.4, 30, 2);
  geo.translate(0, -15, 0); // centred: spans 15m above and below the anchor
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: timeU, uSeed: { value: rand(TAU) }, uStrength: { value: 1 } },
    vertexShader: `
      varying vec2 vUv; varying float vFog;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vFog = clamp(1.0 - distance(cameraPosition, wp.xyz) / 150.0, 0.0, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime; uniform float uSeed; uniform float uStrength;
      varying vec2 vUv; varying float vFog;
      void main(){
        float across = smoothstep(0.0, 0.46, vUv.x) * smoothstep(1.0, 0.54, vUv.x);
        float along = smoothstep(0.02, 0.3, vUv.y) * (0.3 + 0.7 * vUv.y);
        float flick = 0.72 + 0.28 * sin(uTime * 0.6 + uSeed) * sin(uTime * 0.23 + uSeed * 2.1);
        float a = across * along * flick * 0.8 * uStrength * vFog;
        gl_FragColor = vec4(vec3(1.0, 0.8, 0.5) * 1.7, a);
      }`
  });
  return new THREE.Mesh(geo, mat);
}

// ---- the valley -----------------------------------------------------------
export function startValley(mount, opts = {}) {
  const low = opts.low ?? /HeadlessChrome|Mobile/.test(navigator.userAgent);
  const timeU = { value: 0 };
  const W = () => mount.clientWidth, H = () => mount.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1.25 : 1.6));
  renderer.setSize(W(), H());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;   // grading happens in the composite pass
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xc4a271, 0.0125);
  const camera = new THREE.PerspectiveCamera(52, W() / H(), 0.1, 500);

  const sunDir = new THREE.Vector3(-0.86, 0.4, -0.3).normalize();
  scene.add(makeSky(sunDir));

  const hemi = new THREE.HemisphereLight(0xa8c4b4, 0x243022, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd4a0, 2.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  sun.shadow.camera.left = -42; sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 190;
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xffdcae, 1.05);
  scene.add(fill); scene.add(fill.target);

  // --- forest layout (positions first; the ground texture reads them) ---
  const trees = [];
  for (let i = 0; i < 460; i++) {
    const z = rand(-175, 175);
    const side = rng() > 0.5 ? 1 : -1;
    const x = side > 0
      ? rand(PATH(z) + 3.4, Math.min(STREAM(z) - 2.2, PATH(z) + 26)) * (rng() > 0.25 ? 1 : rand(1.2, 2.2))
      : rand(-58, PATH(z) - 3.4);
    if (Math.abs(x - STREAM(z)) < STREAM_HALF + 1.4) continue;
    if (Math.abs(x - PATH(z)) < 3.2) continue;
    trees.push({ x, z, h: rand(6.5, 13.5), r: rand(0.7, 1.5), lean: rand(-0.05, 0.05), leanA: rand(TAU), birch: rng() > 0.32, crown: rand(0.8, 1.6), tint: rng() });
  }
  // guarantee a framed corridor near the spawn: staggered, varied, no bar rhythm
  for (let row = 0; row < 14; row++) {
    const z = 46 - row * rand(6.2, 9.5);
    for (const side of [-1, 1]) {
      if (rng() > 0.78) continue;
      const x = PATH(z) + side * rand(5.2, 13);
      if (Math.abs(x - STREAM(z)) < STREAM_HALF + 1.4) continue;
      trees.push({ x, z: z + rand(-2, 2), h: rand(8.5, 13.5), r: rand(0.7, 1.1), lean: rand(-0.04, 0.04), leanA: rand(TAU), birch: rng() > 0.25, crown: rand(0.9, 1.4), tint: rng() });
    }
  }

  // --- ground ---
  const gGeo = new THREE.PlaneGeometry(220, 360, 120, 180);
  gGeo.rotateX(-Math.PI / 2);
  const gp = gGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, groundH(gp.getX(i), gp.getZ(i)));
  gGeo.computeVertexNormals();
  const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({
    map: groundTexture(trees), roughness: 0.96, metalness: 0,
  }));
  ground.receiveShadow = true;
  scene.add(ground);

  scene.add(makeWater(timeU, sunDir));

  // --- birches + canopy ---
  const birch = trees.filter(t => t.birch), dark = trees.filter(t => !t.birch);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 1, 7, 3);
  trunkGeo.translate(0, 0.5, 0);
  const dummy = new THREE.Object3D();
  function fillTrunks(list, mat) {
    const m = new THREE.InstancedMesh(trunkGeo, mat, list.length);
    list.forEach((t, i) => {
      const y = groundH(t.x, t.z) - 0.15;
      dummy.position.set(t.x, y, t.z);
      dummy.rotation.set(Math.cos(t.leanA) * t.lean, 0, Math.sin(t.leanA) * t.lean);
      dummy.scale.set(t.r, t.h, t.r);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m); return m;
  }
  fillTrunks(birch, new THREE.MeshStandardMaterial({ map: barkTexture(false), roughness: 0.9 }));
  fillTrunks(dark, new THREE.MeshStandardMaterial({ map: barkTexture(true), roughness: 0.95 }));

  // canopy roof closes the sky over the trail, with gaps where light breaks
  const roof = [];
  for (let z = 52; z > -70; z -= rand(4.5, 7)) {
    if (rng() < 0.3) continue; // the gaps ARE the god rays
    roof.push({ x: PATH(z) + rand(-7, 5.5), z, y: rand(8.2, 11.5), s: rand(2.0, 3.3), tint: rng() });
  }

  const folTex = foliageTexture();
  const roofMat = new THREE.MeshBasicMaterial({ map: folTex, alphaTest: 0.42, side: THREE.DoubleSide, fog: true });
  const crownGeo = crossedPlanes(3.6, 3.0, 3);
  const crownMat = windMaterial(new THREE.MeshStandardMaterial({
    map: folTex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.95,
  }), timeU, 0.05, 1.1);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, trees.length * 3);
  const cTint = new THREE.Color();
  let ci = 0;
  for (const t of trees) {
    const y = groundH(t.x, t.z) - 0.15;
    for (let k = 0; k < 3; k++) {
      dummy.position.set(t.x + rand(-0.8, 0.8), y + t.h * (k === 2 ? rand(0.6, 0.78) : rand(0.85, 1.02)), t.z + rand(-0.8, 0.8));
      dummy.rotation.set(rand(-0.35, 0.35), rand(TAU), rand(-0.25, 0.25));
      const s = t.crown * (k === 2 ? 0.75 : 1) * rand(1.05, 1.4);
      dummy.scale.set(s, s * rand(0.8, 1.05), s);
      dummy.updateMatrix(); crowns.setMatrixAt(ci, dummy.matrix);
      cTint.setHSL(0.21 + t.tint * 0.06 - k * 0.015, rand(0.32, 0.48), k === 2 ? 0.34 : rand(0.42, 0.55));
      crowns.setColorAt(ci, cTint);
      ci++;
    }
  }
  crowns.count = ci; crowns.castShadow = true;
  const roofMesh = new THREE.InstancedMesh(crownGeo, roofMat, roof.length);
  roof.forEach((r, i) => {
    dummy.position.set(r.x, r.y, r.z);
    dummy.rotation.set(rand(-0.3, 0.3), rand(TAU), rand(-0.2, 0.2));
    dummy.scale.set(r.s, r.s * 0.75, r.s);
    dummy.updateMatrix(); roofMesh.setMatrixAt(i, dummy.matrix);
    cTint.setHSL(0.24, rand(0.3, 0.4), rand(0.13, 0.22)); roofMesh.setColorAt(i, cTint);
  });
  scene.add(roofMesh);
  scene.add(crowns);

  // low bushes fill the understorey
  const bushMat = windMaterial(new THREE.MeshStandardMaterial({
    map: folTex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1,
  }), timeU, 0.04, 1.4);
  const bushes = new THREE.InstancedMesh(crossedPlanes(2.6, 1.9, 2), bushMat, 240);
  let bi = 0;
  for (let i = 0; i < 300 && bi < 240; i++) {
    const z = rand(-170, 170), x = rand(-52, 52);
    if (Math.abs(x - PATH(z)) < 3.4 || Math.abs(x - STREAM(z)) < STREAM_HALF + 0.8) continue;
    dummy.position.set(x, groundH(x, z) - 0.08, z);
    dummy.rotation.set(0, rand(TAU), 0);
    const s = rand(0.7, 1.9); dummy.scale.set(s, s * rand(0.7, 1), s);
    dummy.updateMatrix(); bushes.setMatrixAt(bi, dummy.matrix);
    cTint.setHSL(0.23, rand(0.3, 0.42), rand(0.38, 0.52)); bushes.setColorAt(bi, cTint);
    bi++;
  }
  bushes.count = bi;
  scene.add(bushes);

  // --- waist-high grass ---
  const grassMat = windMaterial(new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 1,
  }), timeU, 0.09, 1.7);
  const GRASS = low ? 2600 : 5200;
  const grass = new THREE.InstancedMesh(bladeTuft(), grassMat, GRASS);
  let gi = 0;
  for (let i = 0; i < GRASS * 2.4 && gi < GRASS; i++) {
    const z = rand(-170, 170);
    // clumping: denser near the path and stream banks, thinner deep in the wood
    const near = rng() < 0.62;
    const x = near
      ? PATH(z) + (rng() > 0.5 ? 1 : -1) * rand(2.0, 9)
      : rand(-48, 48);
    if (Math.abs(x - PATH(z)) < 1.7) continue;
    if (Math.abs(x - STREAM(z)) < STREAM_HALF + 0.4) continue;
    dummy.position.set(x, groundH(x, z) - 0.05, z);
    dummy.rotation.set(0, rand(TAU), 0);
    const s = rand(0.9, 1.9); dummy.scale.set(s, s, s);
    dummy.updateMatrix(); grass.setMatrixAt(gi, dummy.matrix);
    cTint.setHSL(0.2 + rand(0.05), rand(0.3, 0.45), rand(0.42, 0.6)); grass.setColorAt(gi, cTint);
    gi++;
  }
  grass.count = gi; grass.receiveShadow = false;
  scene.add(grass);

  // --- ferns ---
  const fernMat = windMaterial(new THREE.MeshStandardMaterial({
    map: fernTexture(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1,
  }), timeU, 0.05, 1.5);
  const ferns = new THREE.InstancedMesh(crossedPlanes(1.7, 1.15, 2), fernMat, 320);
  let fi = 0;
  for (let i = 0; i < 480 && fi < 320; i++) {
    const t = trees[Math.floor(rand(trees.length))];
    if (!t) break;
    const x = t.x + rand(-2.4, 2.4), z = t.z + rand(-2.4, 2.4);
    if (Math.abs(x - PATH(z)) < 2 || Math.abs(x - STREAM(z)) < STREAM_HALF + 0.6) continue;
    dummy.position.set(x, groundH(x, z) - 0.04, z);
    dummy.rotation.set(0, rand(TAU), 0);
    const s = rand(0.7, 1.7); dummy.scale.set(s, s, s);
    dummy.updateMatrix(); ferns.setMatrixAt(fi, dummy.matrix);
    cTint.setHSL(0.26, rand(0.35, 0.5), rand(0.32, 0.48)); ferns.setColorAt(fi, cTint);
    fi++;
  }
  ferns.count = fi;
  scene.add(ferns);

  // --- mossy boulders ---
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  const rp = rockGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const v = new THREE.Vector3(rp.getX(i), rp.getY(i), rp.getZ(i));
    const n = 1 + 0.24 * Math.sin(v.x * 3.1 + v.y * 2.3) * Math.cos(v.z * 2.7 + v.x);
    v.multiplyScalar(n); rp.setXYZ(i, v.x, v.y, v.z);
  }
  rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  rockMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
        float mossF = smoothstep(0.25, 0.75, vNormal.y * 0.5 + 0.5 + sin(vViewPosition.x * 2.0) * 0.08);
        diffuseColor.rgb = mix(vec3(0.36, 0.37, 0.34), vec3(0.23, 0.34, 0.18), mossF);`
    );
  };
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 46);
  let ri = 0;
  for (let i = 0; i < 90 && ri < 46; i++) {
    const z = rand(-160, 160);
    const nearStream = rng() > 0.55;
    const x = nearStream ? STREAM(z) + (rng() > 0.5 ? 1 : -1) * rand(STREAM_HALF + 1, STREAM_HALF + 4.5) : rand(-46, 46);
    if (Math.abs(x - PATH(z)) < 2.4 || Math.abs(x - STREAM(z)) < STREAM_HALF - 0.5) continue;
    dummy.position.set(x, groundH(x, z) + rand(0.05, 0.3), z);
    dummy.rotation.set(rand(TAU), rand(TAU), rand(TAU));
    dummy.scale.set(rand(0.5, 2.1), rand(0.35, 1.1), rand(0.6, 1.8));
    dummy.updateMatrix(); rocks.setMatrixAt(ri, dummy.matrix); ri++;
  }
  rocks.count = ri; rocks.castShadow = true; rocks.receiveShadow = true;
  scene.add(rocks);

  // --- god-ray shafts through the canopy ---
  const shafts = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const s = makeShaft(timeU);
    const z = 24 - i * rand(10, 16);
    const hitX = PATH(z) + rand(-3, 4), hitZ = z;
    const L = rand(11, 14.5);
    // anchor up-sun of the ground hit point so the beam lands on the trail
    const ax = hitX + sunDir.x * L, ay = groundH(hitX, hitZ) + 0.5 + sunDir.y * L, az = hitZ + sunDir.z * L;
    s.position.set(ax, ay, az);
    const axis = sunDir.clone().add(new THREE.Vector3(rand(-0.1, 0.1), rand(-0.05, 0.08), rand(-0.1, 0.1))).normalize();
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    s.scale.set(rand(1.0, 1.9), rand(0.7, 1.05), 1);
    s.material.uniforms.uStrength.value = rand(0.6, 1.1);
    shafts.add(s);
  }
  scene.add(shafts);

  // --- drifting dust motes ---
  const DUST = low ? 160 : 320;
  const dustGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    const z = rand(-90, 60), x = PATH(z) + rand(-9, 9);
    dPos[i * 3] = x; dPos[i * 3 + 1] = groundH(x, z) + rand(0.4, 7); dPos[i * 3 + 2] = z;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: dotTexture(), color: 0xffd9a0, size: 0.11, transparent: true, opacity: 0.65,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  scene.add(dust);

  // --- the runner ----------------------------------------------------------
  const runner = new THREE.Group();
  const mats = {
    jacket: new THREE.MeshStandardMaterial({ color: 0xc4622f, roughness: 0.75, emissive: 0x2a1005, emissiveIntensity: 0.55 }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0x9c4826, roughness: 0.8 }),
    pants: new THREE.MeshStandardMaterial({ color: 0x363c40, roughness: 0.9, emissive: 0x0a0c0e, emissiveIntensity: 0.5 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc68e62, roughness: 0.75 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.95 }),
    cap: new THREE.MeshStandardMaterial({ color: 0x33502e, roughness: 0.85 }),
  };
  function part(geo, mat, x, y, z, parent = runner) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = true; parent.add(m); return m;
  }
  // torso & head
  const hips = part(new THREE.CapsuleGeometry(0.16, 0.16, 4, 8), mats.pants, 0, 0.98, 0);
  const torso = part(new THREE.CapsuleGeometry(0.19, 0.4, 4, 10), mats.jacket, 0, 1.38, 0);
  torso.scale.set(1, 1, 0.78);
  const head = part(new THREE.SphereGeometry(0.14, 14, 12), mats.skin, 0, 1.76, 0);
  part(new THREE.SphereGeometry(0.145, 14, 12, 0, TAU, 0, 1.9), mats.cap, 0, 1.785, 0);
  part(new THREE.BoxGeometry(0.2, 0.02, 0.12), mats.cap, 0, 1.76, -0.17); // cap brim (forward = -z)
  const pack = part(new THREE.BoxGeometry(0.3, 0.4, 0.16), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 }), 0, 1.4, 0.21);
  pack.rotation.x = 0.1;
  // limbs: pivot groups so swings rotate about the joint
  function limb(px, py, upperLen, lowerLen, r1, r2, mat1, mat2) {
    const hip = new THREE.Group(); hip.position.set(px, py, 0); runner.add(hip);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(r1, upperLen, 3, 8), mat1);
    upper.position.y = -upperLen / 2; upper.castShadow = true; hip.add(upper);
    const knee = new THREE.Group(); knee.position.y = -upperLen - r1; hip.add(knee);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(r2, lowerLen, 3, 8), mat2);
    lower.position.y = -lowerLen / 2; lower.castShadow = true; knee.add(lower);
    return { hip, knee };
  }
  const legL = limb(-0.11, 1.0, 0.4, 0.42, 0.085, 0.065, mats.pants, mats.pants);
  const legR = limb(0.11, 1.0, 0.4, 0.42, 0.085, 0.065, mats.pants, mats.pants);
  const armL = limb(-0.26, 1.56, 0.26, 0.26, 0.06, 0.05, mats.sleeve, mats.skin);
  const armR = limb(0.26, 1.56, 0.26, 0.26, 0.06, 0.05, mats.sleeve, mats.skin);
  part(new THREE.BoxGeometry(0.1, 0.06, 0.2), mats.hair, 0, -0.86, -0.03, legL.knee);
  part(new THREE.BoxGeometry(0.1, 0.06, 0.2), mats.hair, 0, -0.86, -0.03, legR.knee);
  const spawnZ = 42;
  runner.position.set(PATH(spawnZ), groundH(PATH(spawnZ), spawnZ), spawnZ);
  scene.add(runner);

  // --- HUD -----------------------------------------------------------------
  const hud = document.createElement('div');
  hud.className = 'vhud';
  const mk = (tag, cls, text, parent) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    (parent || hud).appendChild(n);
    return n;
  };
  const brand = mk('div', 'vbrand', null);
  mk('b', null, 'WILDLIGHT', brand);
  mk('small', null, 'VALLEY RUN', brand);
  const stam = mk('div', 'vstam', null, brand);
  mk('i', null, null, stam);
  mk('div', 'vdist', '0 m');
  mk('div', 'vhint', 'Drag to run \u00b7 WASD + Shift');
  const mapEl = mk('canvas', 'vmap');
  mapEl.width = 132; mapEl.height = 132;
  const joy = mk('div', 'vjoy');
  mk('span', null, null, joy);
  mount.appendChild(hud);
  const elStam = hud.querySelector('.vstam i');
  const elDist = hud.querySelector('.vdist');
  const elHint = hud.querySelector('.vhint');
  const elJoy = hud.querySelector('.vjoy');
  const elKnob = hud.querySelector('.vjoy span');
  const mapCtx = hud.querySelector('.vmap').getContext('2d');

  // --- input ---------------------------------------------------------------
  const input = { x: 0, y: 0, sprint: false };
  let joyId = null, joyBase = null;
  const onKey = (e, v) => {
    if (['ArrowUp', 'KeyW'].includes(e.code)) input.y = v ? -1 : (input.y < 0 ? 0 : input.y);
    if (['ArrowDown', 'KeyS'].includes(e.code)) input.y = v ? 1 : (input.y > 0 ? 0 : input.y);
    if (['ArrowLeft', 'KeyA'].includes(e.code)) input.x = v ? -1 : (input.x < 0 ? 0 : input.x);
    if (['ArrowRight', 'KeyD'].includes(e.code)) input.x = v ? 1 : (input.x > 0 ? 0 : input.x);
    if (['ShiftLeft', 'ShiftRight'].includes(e.code)) input.sprint = v;
    if (v) elHint.classList.add('off');
  };
  const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const pd = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    joyId = e.pointerId; joyBase = { x: e.clientX, y: e.clientY };
    elJoy.style.left = (e.clientX - 52) + 'px'; elJoy.style.top = (e.clientY - 52) + 'px';
    elJoy.classList.add('on'); elHint.classList.add('off');
    mount.setPointerCapture(e.pointerId);
  };
  const pm = (e) => {
    if (e.pointerId !== joyId) return;
    const dx = (e.clientX - joyBase.x) / 46, dy = (e.clientY - joyBase.y) / 46;
    const m = Math.hypot(dx, dy), c = m > 1 ? 1 / m : 1;
    input.x = clamp(dx * c, -1, 1); input.y = clamp(dy * c, -1, 1);
    input.sprint = m > 1.35;
    elKnob.style.transform = `translate(${dx * c * 30}px,${dy * c * 30}px)`;
  };
  const pu = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null; input.x = 0; input.y = 0; input.sprint = false;
    elJoy.classList.remove('on'); elKnob.style.transform = '';
  };
  mount.addEventListener('pointerdown', pd);
  mount.addEventListener('pointermove', pm);
  mount.addEventListener('pointerup', pu);
  mount.addEventListener('pointercancel', pu);

  // --- post pipeline: bright pass -> blur -> composite -----------------------
  const post = {};
  function makeRT(w, h) {
    return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 0 });
  }
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  function fsMat(frag, uniforms) {
    return new THREE.ShaderMaterial({
      uniforms, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: frag,
    });
  }
  post.bright = fsMat(`
    uniform sampler2D tSrc; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tSrc, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float w = smoothstep(1.0, 1.7, l);
      gl_FragColor = vec4(c * w, 1.0);
    }`, { tSrc: { value: null } });
  post.blur = fsMat(`
    uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
      vec2 o1 = uDir * 1.384, o2 = uDir * 3.230;
      c += (texture2D(tSrc, vUv + o1).rgb + texture2D(tSrc, vUv - o1).rgb) * 0.316;
      c += (texture2D(tSrc, vUv + o2).rgb + texture2D(tSrc, vUv - o2).rgb) * 0.070;
      gl_FragColor = vec4(c, 1.0);
    }`, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
  post.comp = fsMat(`
    uniform sampler2D tSrc; uniform sampler2D tBloom; uniform float uTime;
    varying vec2 vUv;
    vec3 aces(vec3 x){
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }
    void main(){
      vec3 c = texture2D(tSrc, vUv).rgb + texture2D(tBloom, vUv).rgb * 0.5;
      c *= 1.05;
      c = aces(c);
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(lum), c, 1.15);
      // warm golden-hour grade
      c = pow(c, vec3(1.0, 1.0, 1.03));
      // vignette
      float d = distance(vUv, vec2(0.5, 0.46));
      c *= 1.0 - smoothstep(0.42, 0.92, d) * 0.34;
      // fine grain
      float g = fract(sin(dot(vUv * (900.0 + mod(uTime, 10.0)), vec2(12.9898, 78.233))) * 43758.5453);
      c += (g - 0.5) * 0.018;
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`, { tSrc: { value: null }, tBloom: { value: null }, uTime: timeU });
  const quad = new THREE.Mesh(quadGeo, post.comp);
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  function sizePost() {
    const pr = renderer.getPixelRatio();
    const w = Math.floor(W() * pr), h = Math.floor(H() * pr);
    post.rtScene?.dispose(); post.rtA?.dispose(); post.rtB?.dispose();
    post.rtScene = makeRT(w, h);
    post.rtA = makeRT(w >> 2, h >> 2); post.rtB = makeRT(w >> 2, h >> 2);
  }
  sizePost();
  function renderFrame() {
    renderer.setRenderTarget(post.rtScene);
    renderer.render(scene, camera);
    quad.material = post.bright; post.bright.uniforms.tSrc.value = post.rtScene.texture;
    renderer.setRenderTarget(post.rtA); renderer.render(quadScene, quadCam);
    quad.material = post.blur;
    post.blur.uniforms.tSrc.value = post.rtA.texture; post.blur.uniforms.uDir.value.set(1 / post.rtA.width, 0);
    renderer.setRenderTarget(post.rtB); renderer.render(quadScene, quadCam);
    post.blur.uniforms.tSrc.value = post.rtB.texture; post.blur.uniforms.uDir.value.set(0, 1 / post.rtA.height);
    renderer.setRenderTarget(post.rtA); renderer.render(quadScene, quadCam);
    quad.material = post.comp;
    post.comp.uniforms.tSrc.value = post.rtScene.texture;
    post.comp.uniforms.tBloom.value = post.rtA.texture;
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);
  }

  // --- minimap -------------------------------------------------------------
  function drawMap(px, pz, yaw) {
    const g = mapCtx, S = 132, scale = 1.05;
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(16,22,16,.55)'; g.fillRect(0, 0, S, S);
    const toX = (x) => S / 2 + (x - px) * scale, toY = (z) => S / 2 + (z - pz) * scale;
    // stream
    g.strokeStyle = 'rgba(120,180,170,.8)'; g.lineWidth = 4; g.beginPath();
    for (let z = pz - 70; z <= pz + 70; z += 5) {
      const X = toX(STREAM(z)), Y = toY(z); z <= pz - 70 + 0.1 ? g.moveTo(X, Y) : g.lineTo(X, Y);
    }
    g.stroke();
    // path
    g.strokeStyle = 'rgba(232,220,190,.9)'; g.lineWidth = 2.4; g.beginPath();
    for (let z = pz - 70; z <= pz + 70; z += 4) {
      const X = toX(PATH(z)), Y = toY(z); z <= pz - 70 + 0.1 ? g.moveTo(X, Y) : g.lineTo(X, Y);
    }
    g.stroke();
    // player arrow (forward = (sin yaw, cos yaw) in world; map y runs with +z)
    g.save(); g.translate(S / 2, S / 2); g.rotate(Math.atan2(Math.sin(yaw), Math.cos(yaw)) * -1 + 0);
    // note: canvas rotation: forward -z should point up
    g.restore();
    g.save(); g.translate(S / 2, S / 2); g.rotate(-yaw + Math.PI);
    g.fillStyle = '#ffd9a0';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.4, 5); g.lineTo(0, 2.4); g.lineTo(-4.4, 5); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = 'rgba(255,244,220,.85)'; g.font = '700 9px system-ui'; g.fillText('N', S - 14, 13);
  }

  // --- state & loop ----------------------------------------------------------
  // debug: ?iso=shaft|roof isolates layers for visual verification
  const qp = new URLSearchParams(location.search);
  if (qp.get('run')) { input.y = -1; input.sprint = qp.get('run') === '2'; }
  const warp = parseFloat(qp.get('warp') || '0');
  if (warp) { runner.position.z = spawnZ - warp; runner.position.x = PATH(spawnZ - warp); runner.position.y = groundH(runner.position.x, spawnZ - warp) + 0.02; }
  const iso = qp.get('iso');
  if (iso) {
    scene.traverse((o) => { o.visible = false; });
    scene.traverse((o) => { if (o.isScene) o.visible = true; });
    if (iso === 'shaft') shafts.traverse((o) => o.visible = true);
    if (iso === 'roof') crowns.visible = true;
    if (iso === 'sky') {}
    console.log('ISO', iso, 'shafts:', shafts.children.length, 'crowns:', crowns.count, 'trees:', trees.length);
  }

  const state = { yaw: Math.PI, vel: 0, dist: 0, stam: 1, phase: 0 };
  // yaw PI => facing +z? forward = (sin yaw, cos yaw); PI faces -z... spawn faces into the valley (-z is deeper). We run toward -z.
  state.yaw = Math.PI; // forward (0,-1): toward -z
  const pose = qp.get('pose');
  if (pose) { state.phase = parseFloat(pose); state.vel = 6; }
  const clock = new THREE.Clock();
  let raf = 0, fpsFrames = 0, fpsLast = performance.now(), degraded = false;

  const resize = () => {
    renderer.setSize(W(), H());
    camera.aspect = W() / H(); camera.updateProjectionMatrix();
    sizePost();
  };
  addEventListener('resize', resize);

  const camTarget = new THREE.Vector3(), camPos = new THREE.Vector3(PATH(spawnZ), 6, spawnZ + 9);
  const lookAhead = new THREE.Vector3();

  function animate() {
    raf = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.04);
    timeU.value += dt;
    const t = timeU.value;

    // movement
    const wantSprint = input.sprint && input.y < 0 && state.stam > 0.05;
    const target = input.y < 0 ? (wantSprint ? 9.2 : 6.2) : input.y > 0 ? -3.2 : 0;
    state.vel += (target - state.vel) * damp(0.002, dt);
    state.stam = clamp(state.stam + (wantSprint ? -dt * 0.24 : dt * 0.16), 0, 1);
    state.yaw -= input.x * dt * (1.6 + Math.abs(state.vel) * 0.09);
    const dx = Math.sin(state.yaw) * state.vel * dt, dz = Math.cos(state.yaw) * state.vel * dt;
    let nx = runner.position.x + dx, nz = clamp(runner.position.z + dz, -172, 172);
    const dsx = STREAM(nz) - STREAM_HALF - 1.1;
    nx = clamp(nx, -52, dsx);
    runner.position.x = nx; runner.position.z = nz;
    runner.position.y = groundH(nx, nz) + 0.02;
    runner.rotation.y = state.yaw + Math.PI; // model faces -z at rest; forward is (sin,cos)
    state.dist += Math.abs(state.vel) * dt;

    // run cycle
    const speed = Math.abs(state.vel);
    state.phase += dt * (4 + speed * 1.35);
    const run = clamp(speed / 5.5, 0, 1.25);
    const s1 = Math.sin(state.phase), s2 = Math.sin(state.phase + Math.PI);
    legL.hip.rotation.x = s1 * 0.78 * run;
    legR.hip.rotation.x = s2 * 0.78 * run;
    legL.knee.rotation.x = Math.max(0, -s1) * 1.15 * run + 0.06;
    legR.knee.rotation.x = Math.max(0, -s2) * 1.15 * run + 0.06;
    armL.hip.rotation.x = s2 * 0.62 * run;
    armR.hip.rotation.x = s1 * 0.62 * run;
    armL.knee.rotation.x = -0.5 - Math.max(0, s2) * 0.55 * run;
    armR.knee.rotation.x = -0.5 - Math.max(0, s1) * 0.55 * run;
    const bob = Math.abs(Math.cos(state.phase)) * 0.07 * run;
    torso.position.y = 1.38 + bob;
    head.position.y = 1.76 + bob;
    hips.position.y = 0.98 + bob * 0.6;
    runner.rotation.x = 0.1 * run;
    runner.rotation.z = -input.x * 0.08 * run;

    // camera: elevated chase, character sits low in frame
    const back = 7.6, up = 3.9;
    camTarget.set(
      runner.position.x - Math.sin(state.yaw) * back,
      runner.position.y + up,
      runner.position.z - Math.cos(state.yaw) * back
    );
    camPos.lerp(camTarget, damp(0.0008, dt));
    camera.position.copy(camPos);
    lookAhead.set(
      runner.position.x + Math.sin(state.yaw) * 5.5,
      runner.position.y + 1.15,
      runner.position.z + Math.cos(state.yaw) * 5.5
    );
    camera.lookAt(lookAhead);
    const fovT = 52 + (wantSprint ? 7 : 0);
    if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov += (fovT - camera.fov) * damp(0.01, dt); camera.updateProjectionMatrix(); }

    // shadow frustum follows the runner
    sun.position.copy(runner.position).addScaledVector(sunDir, 70);
    fill.position.copy(camPos).add(new THREE.Vector3(0, 6, 0)); fill.target.position.copy(runner.position);
    sun.target.position.copy(runner.position);

    // dust drift
    const dp = dust.geometry.attributes.position;
    for (let i = 0; i < DUST; i++) {
      let y = dp.getY(i) + dt * 0.14;
      if (y > groundH(dp.getX(i), dp.getZ(i)) + 7.5) y -= 7;
      dp.setY(i, y);
      dp.setX(i, dp.getX(i) + Math.sin(t * 0.4 + i) * dt * 0.05);
    }
    dp.needsUpdate = true;

    renderFrame();

    // hud
    elDist.textContent = Math.floor(state.dist) + ' m';
    elStam.style.transform = `scaleX(${state.stam})`;
    drawMap(nx, nz, state.yaw);

    // adaptive quality
    fpsFrames++;
    if (performance.now() - fpsLast > 2000) {
      const fps = fpsFrames / ((performance.now() - fpsLast) / 1000);
      fpsFrames = 0; fpsLast = performance.now();
      if (fps < 42 && !degraded) {
        degraded = true;
        renderer.setPixelRatio(1);
        sizePost();
      }
    }
  }
  animate();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('keydown', kd); removeEventListener('keyup', ku);
      mount.removeEventListener('pointerdown', pd);
      mount.removeEventListener('pointermove', pm);
      mount.removeEventListener('pointerup', pu);
      mount.removeEventListener('pointercancel', pu);
      post.rtScene?.dispose(); post.rtA?.dispose(); post.rtB?.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      mount.removeChild(hud);
    }
  };
}
