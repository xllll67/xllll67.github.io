import * as THREE from 'three';

const canvas = document.getElementById('scene');
const loader = document.getElementById('loader');
const panel = document.getElementById('panel');
const panelBody = document.getElementById('panel-body');
const panelTitle = document.getElementById('panel-title');
const panelKicker = document.getElementById('panel-kicker');
const tip = document.getElementById('tip');

if (location.protocol === 'file:') {
  loader.innerHTML = '<p style="max-width:300px;text-align:center;line-height:1.9">请通过本地服务器打开本页：<br>在项目目录执行 <b>npx serve .</b> 或 <b>python -m http.server</b></p>';
  throw new Error('file protocol');
}

let DATA = null;
const pickables = [];
const themeMats = [];
const themeLights = [];

function mat(hex, opts = {}) {
  return new THREE.MeshStandardMaterial(Object.assign(
    { color: hex, roughness: 0.92, metalness: 0, flatShading: true }, opts
  ));
}

function darken(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c.getHex();
}

function reg(m, dayHex, nightHex) {
  m.userData.day = new THREE.Color(dayHex);
  m.userData.night = new THREE.Color(nightHex);
  m.color.copy(m.userData.day);
  themeMats.push(m);
  return m;
}

const MAT = {
  floor: reg(mat(0), 0xe2bd92, 0x7d5f45),
  wall: reg(mat(0), 0xf9f3e9, 0x8f887c),
  wallSide: reg(mat(0), 0xf9f3e9, 0x8f887c),
  skirt: reg(mat(0), 0xc4ab8d, 0x4a4038),
  rug: reg(mat(0), 0xc9d3bd, 0x5b6656),
  wood: reg(mat(0), 0xbb8a5c, 0x6a4c33),
  woodDark: reg(mat(0), 0x8d6440, 0x4b3624),
  dark: reg(mat(0), 0x3d3d47, 0x23252e),
  darker: reg(mat(0), 0x2a2a33, 0x181a21),
  chair: reg(mat(0), 0x7d6d5d, 0x453a2f),
  metal: reg(mat(0), 0xb9b2a7, 0x6e6a63),
  cardboard: reg(mat(0), 0xc9a06b, 0x74583b),
  cardboardTop: reg(mat(0), 0xdbb584, 0x836445),
  tape: reg(mat(0), 0xe8d8bf, 0x8a7963),
  leaf: reg(mat(0), 0x6e9e6a, 0x3d5a3c),
  pot: reg(mat(0), 0xd08558, 0x7a4c32),
  cushion: reg(mat(0), 0xd79a63, 0x7d5c35)
};

const BOOK_HEX = [0xd97b5a, 0x6e9e9a, 0xe3b23c, 0x8c7bb0, 0xc96f6f, 0x7fa36b, 0x5f7fa8];
const BOOK_MATS = BOOK_HEX.map(h => reg(mat(0), h, darken(h, 0.6)));

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const bgDay = new THREE.Color(0xf4ede3);
const bgNight = new THREE.Color(0x171821);
scene.background = new THREE.Color().copy(bgDay);

const target = new THREE.Vector3(0, 2.0, 0);
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 120);
const camDir = new THREE.Vector3(1, 1, 1).normalize();
const camRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), camDir).normalize();
const camPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();
let shift = 0;
let shiftTarget = 0;
let shiftAmount = 0;
let currentVW = 24;

function updateCamera() {
  camPos.copy(target).addScaledVector(camDir, 40).addScaledVector(camRight, shift);
  camera.position.copy(camPos);
  lookAt.copy(target).addScaledVector(camRight, shift);
  camera.lookAt(lookAt);
}
updateCamera();

const root = new THREE.Group();
scene.add(root);

const ambient = new THREE.AmbientLight(0xffffff, 1.1);
scene.add(ambient);
themeLights.push({ light: ambient, day: 0.86, night: 0.42 });

const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
sun.position.set(14, 22, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -13;
sun.shadow.camera.right = 13;
sun.shadow.camera.top = 13;
sun.shadow.camera.bottom = -13;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 70;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun);
themeLights.push({ light: sun, day: 2.9, night: 0.5, colorDay: new THREE.Color(0xfff1dd), colorNight: new THREE.Color(0x8ea9d6) });

function box(w, h, d, x, y, z, material, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  (parent || root).add(m);
  return m;
}

function cyl(rt, rb, h, seg, x, y, z, material, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  (parent || root).add(m);
  return m;
}

function group(key, label) {
  const g = new THREE.Group();
  g.userData.key = key;
  g.userData.label = label;
  g.userData.hover = false;
  root.add(g);
  pickables.push(g);
  return g;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function screenTexture() {
  const cv = document.createElement('canvas');
  cv.width = 720;
  cv.height = 420;
  const c = cv.getContext('2d');
  c.fillStyle = '#171a22';
  c.fillRect(0, 0, 720, 420);

  c.fillStyle = '#232834';
  c.fillRect(0, 0, 720, 36);
  ['#e8695f', '#e3b23c', '#7fa36b'].forEach(function (col, i) {
    c.beginPath();
    c.arc(28 + i * 24, 18, 7, 0, Math.PI * 2);
    c.fillStyle = col;
    c.fill();
  });

  c.fillStyle = '#1b1f29';
  c.fillRect(0, 36, 128, 384);
  c.fillStyle = '#2e3546';
  [0, 1, 2, 3, 4].forEach(function (i) {
    roundRect(c, 20, 70 + i * 34, i === 0 ? 84 : 68, 12, 6);
    c.fill();
  });

  c.fillStyle = '#f5f0e7';
  c.font = '600 42px Helvetica, Arial, sans-serif';
  c.fillText('WORKS', 158, 116);

  const list = (DATA && DATA.projects) || [];
  c.fillStyle = '#7d8496';
  c.font = '17px Helvetica, Arial, sans-serif';
  c.fillText(list.length + ' selected project' + (list.length === 1 ? '' : 's'), 161, 146);

  const cols = ['#e8695f', '#6e9e9a', '#e3b23c', '#8b7ec8'];
  const n = Math.max(1, Math.min(4, list.length));
  const step = n >= 4 ? 60 : 78;
  const cardH = n >= 4 ? 50 : 62;
  cols.slice(0, n).forEach(function (col, i) {
    const y = 172 + i * step;
    c.fillStyle = '#232834';
    roundRect(c, 158, y, 524, cardH, 12);
    c.fill();
    c.fillStyle = col;
    roundRect(c, 176, y + (cardH - 38) / 2, 40, 38, 9);
    c.fill();
    c.fillStyle = '#454c5f';
    roundRect(c, 234, y + 15, 300 - i * 46, 12, 6);
    c.fill();
    c.fillStyle = '#333a49';
    roundRect(c, 234, y + 33, 210 - i * 34, 10, 5);
    c.fill();
  });

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function frameTexture() {
  const cv = document.createElement('canvas');
  cv.width = 640;
  cv.height = 440;
  const c = cv.getContext('2d');
  c.fillStyle = '#f8f2e7';
  c.fillRect(0, 0, 640, 440);

  c.fillStyle = '#b4622f';
  c.font = '600 19px Helvetica, Arial, sans-serif';
  c.fillText('T I M E L I N E', 52, 66);

  const exps = ((DATA && DATA.experience) || []).slice(0, 3);

  let years = [];
  exps.forEach(function (e) {
    (String(e.period || '').match(/\d{4}/g) || []).forEach(function (y) { years.push(+y); });
  });
  const ongoing = exps.some(function (e) { return /至今|now|present/i.test(String(e.period || '')); });
  let span = '2021 — 26';
  if (years.length) {
    const first = Math.min.apply(null, years);
    span = first + ' — ' + (ongoing ? '至今' : String(Math.max.apply(null, years)).slice(2));
  }

  c.fillStyle = '#2b2620';
  c.font = '600 52px Helvetica, Arial, sans-serif';
  c.fillText(span, 50, 132, 540);

  c.strokeStyle = '#e2d8c8';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(64, 180);
  c.lineTo(64, 412);
  c.stroke();

  const items = exps.length ? exps.map(function (e) {
    const y = (String(e.period || '').match(/\d{4}/g) || [''])[0];
    return [y, e.role || ''];
  }) : [['2026', '高级前端工程师'], ['2024', '前端工程师'], ['2022', '全栈开发']];

  items.forEach(function (it, i) {
    const y = 200 + i * 76;
    c.beginPath();
    c.arc(64, y, 8, 0, Math.PI * 2);
    c.fillStyle = i === 0 ? '#b4622f' : '#c8b9a4';
    c.fill();
    c.fillStyle = '#2b2620';
    c.font = '600 26px Helvetica, Arial, sans-serif';
    c.fillText(it[0], 92, y + 9);
    c.fillStyle = '#7c7264';
    c.font = '17px "Microsoft YaHei", sans-serif';
    c.fillText(it[1], 178, y + 8, 400);
    c.fillStyle = '#e8dfd0';
    c.fillRect(178, y + 18, 300 - i * 44, 5);
  });

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function windowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 340;
  const c = cv.getContext('2d');

  const g = c.createLinearGradient(0, 0, 0, 340);
  g.addColorStop(0, '#9dc9e8');
  g.addColorStop(0.58, '#dceaf4');
  g.addColorStop(0.59, '#c6d9c0');
  g.addColorStop(1, '#a2bd95');
  c.fillStyle = g;
  c.fillRect(0, 0, 512, 340);

  c.fillStyle = '#ffffff';
  [[110, 78, 30], [148, 72, 24], [186, 84, 20], [330, 60, 26], [364, 56, 20]].forEach(function (p) {
    c.beginPath();
    c.arc(p[0], p[1], p[2], 0, Math.PI * 2);
    c.fill();
  });

  c.fillStyle = '#8fae86';
  c.beginPath();
  c.moveTo(0, 210);
  c.lineTo(120, 148);
  c.lineTo(230, 210);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(180, 210);
  c.lineTo(330, 132);
  c.lineTo(512, 210);
  c.closePath();
  c.fill();

  c.fillStyle = '#7d9c76';
  c.beginPath();
  c.moveTo(0, 214);
  c.lineTo(512, 214);
  c.lineTo(512, 340);
  c.lineTo(0, 340);
  c.closePath();
  c.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildRoom() {
  box(12.4, 0.5, 12.4, 0, -0.25, 0, MAT.floor);
  box(12.4, 4.8, 0.4, 0, 2.4, -6.2, MAT.wall);
  box(0.4, 4.8, 12.4, -6.2, 2.4, 0, MAT.wallSide);
  box(12.2, 0.16, 0.12, 0, 0.08, -5.98, MAT.skirt);
  box(0.12, 0.16, 12.2, -5.98, 0.08, 0, MAT.skirt);

  const rug = box(4.9, 0.06, 3.9, 1.4, 0.03, -1.0, MAT.rug);
  rug.castShadow = false;

  box(4.6, 0.16, 2.0, 1.4, 1.42, -5.0, MAT.wood);
  [[-0.55, -5.8], [3.35, -5.8], [-0.55, -4.2], [3.35, -4.2]].forEach(p => {
    box(0.14, 1.34, 0.14, p[0], 0.67, p[1], MAT.woodDark);
  });

  box(1.2, 0.05, 0.42, 1.4, 1.53, -4.3, MAT.darker);
  box(0.2, 0.05, 0.3, 2.2, 1.53, -4.3, MAT.darker);
  cyl(0.13, 0.13, 0.26, 12, 3.1, 1.63, -4.95, MAT.darker);

  const winFrame = box(2.5, 1.7, 0.12, 4.2, 3.55, -5.98, MAT.woodDark);
  winFrame.castShadow = false;
  const glassMat = reg(new THREE.MeshBasicMaterial({ color: 0xffffff, map: windowTexture() }), 0xffffff, 0x4a5872);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 1.46), glassMat);
  box(2.42, 0.07, 0.06, 4.2, 3.55, -5.84, MAT.woodDark);
  box(0.07, 1.5, 0.06, 4.2, 3.55, -5.84, MAT.woodDark);
  glass.position.set(4.2, 3.55, -5.86);
  root.add(glass);

  const chair = new THREE.Group();
  root.add(chair);
  // 坐面 z 从 -3.7 到 -2.7，人朝 -z 坐着看显示器，所以椅背要放在 +z 一侧（-2.72）
  box(1.0, 0.14, 1.0, 1.4, 0.95, -3.2, MAT.chair, chair);
  box(1.0, 0.9, 0.14, 1.4, 1.47, -2.72, MAT.chair, chair);
  [[0.95, -2.75], [1.85, -2.75], [0.95, -3.65], [1.85, -3.65]].forEach(p => {
    box(0.1, 0.88, 0.1, p[0], 0.44, p[1], MAT.chair, chair);
  });

  const bean = new THREE.Mesh(new THREE.IcosahedronGeometry(0.74, 1), MAT.cushion);
  bean.position.set(-3.55, 0.52, 3.1);
  bean.scale.set(1.24, 0.72, 1.08);
  bean.castShadow = true;
  bean.receiveShadow = true;
  root.add(bean);
  cyl(0.46, 0.46, 0.2, 14, -3.5, 0.12, 2.4, MAT.cushion);

  cyl(0.74, 0.68, 0.12, 16, 2.7, 0.46, -0.1, MAT.wood);
  cyl(0.09, 0.09, 0.4, 8, 2.7, 0.24, -0.1, MAT.woodDark);
  cyl(0.42, 0.44, 0.06, 12, 2.7, 0.09, -0.1, MAT.woodDark);
  box(0.44, 0.05, 0.32, 2.66, 0.545, -0.16, BOOK_MATS[6]);
  box(0.4, 0.05, 0.3, 2.71, 0.595, -0.19, BOOK_MATS[1]);
  cyl(0.1, 0.11, 0.2, 10, 3.12, 0.63, 0.08, MAT.darker);
}

function buildMonitor() {
  const g = group('projects', '项目作品集');
  box(1.0, 0.08, 0.62, 1.4, 1.54, -5.2, MAT.dark, g);
  box(0.18, 0.62, 0.18, 1.4, 1.85, -5.24, MAT.dark, g);
  box(2.42, 1.42, 0.13, 1.4, 2.86, -5.2, MAT.darker, g);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.18, 1.22),
    new THREE.MeshBasicMaterial({ map: screenTexture() })
  );
  screen.position.set(1.4, 2.86, -5.13);
  g.add(screen);
  return g;
}

function buildShelf() {
  const g = group('skills', '技术栈');
  box(0.9, 0.1, 3.4, -5.55, 3.29, -2.2, MAT.wood, g);
  box(0.9, 3.3, 0.1, -5.55, 1.65, -3.85, MAT.wood, g);
  box(0.9, 3.3, 0.1, -5.55, 1.65, -0.55, MAT.wood, g);
  box(0.08, 3.3, 3.4, -5.98, 1.65, -2.2, MAT.woodDark, g);
  [0.09, 1.16, 2.24].forEach(y => {
    box(0.86, 0.08, 3.28, -5.56, y, -2.2, MAT.woodDark, g);
  });

  const bases = [0.13, 1.2, 2.28];
  bases.forEach((base, br) => {
    let z = -3.6;
    let i = br * 5;
    while (z < -0.92) {
      const t = 0.1 + (i % 3) * 0.03;
      const h = 0.6 + ((i * 7) % 5) * 0.06;
      const b = box(0.62, h, t, -5.56, base + h / 2, z + t / 2, BOOK_MATS[i % BOOK_MATS.length], g);
      b.castShadow = false;
      z += t + 0.014;
      i++;
    }
  });
  return g;
}

function buildFrame() {
  const g = group('experience', '项目经历');
  box(2.7, 1.95, 0.1, -2.7, 3.18, -5.94, MAT.woodDark, g);
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(2.36, 1.64),
    new THREE.MeshStandardMaterial({ map: frameTexture(), roughness: 1 })
  );
  art.position.set(-2.7, 3.18, -5.88);
  g.add(art);
  return g;
}

function buildCrate() {
  const g = group('posts', '文章归档');
  box(1.34, 0.96, 1.12, 4.75, 0.48, 2.55, MAT.cardboard, g);
  box(1.46, 0.12, 1.22, 4.75, 1.02, 2.55, MAT.cardboardTop, g);
  box(0.2, 0.02, 1.24, 4.75, 1.09, 2.55, MAT.tape, g);

  box(0.86, 0.08, 0.66, 4.75, 1.12, 2.6, MAT.cardboardTop, g);
  box(0.56, 0.46, 0.06, 4.75, 1.37, 2.29, BOOK_MATS[3], g);
  return g;
}

function buildLamp() {
  const g = group('lamp', '开灯 / 关灯');
  cyl(0.24, 0.27, 0.08, 14, -0.3, 1.54, -5.2, MAT.metal, g);
  cyl(0.045, 0.045, 1.24, 8, -0.3, 2.18, -5.2, MAT.metal, g);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 0.56, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe8d4b0, roughness: 0.85, side: THREE.DoubleSide, flatShading: true })
  );
  shade.position.set(-0.3, 3.0, -5.2);
  shade.castShadow = true;
  g.add(shade);

  const bulb = new THREE.PointLight(0xffcf8a, 0, 9, 2);
  bulb.position.set(-0.3, 2.66, -5.2);
  g.add(bulb);
  g.userData.bulb = bulb;
  return g;
}

function buildPlant() {
  const g = new THREE.Group();
  root.add(g);
  cyl(0.38, 0.3, 0.56, 10, -4.7, 0.28, 3.4, MAT.pot, g);
  cyl(0.34, 0.34, 0.06, 10, -4.7, 0.58, 3.4, MAT.woodDark, g);

  const leafGeo = new THREE.IcosahedronGeometry(0.36, 0);
  [[0, 0.95, 0, 1], [0.3, 1.2, 0.1, 0.8], [-0.28, 1.05, 0.16, 0.75], [0.05, 1.35, -0.18, 0.65]].forEach(p => {
    const leaf = new THREE.Mesh(leafGeo, MAT.leaf);
    leaf.position.set(-4.7 + p[0], p[1], 3.4 + p[2]);
    leaf.scale.set(p[3], p[3] * 1.15, p[3]);
    leaf.rotation.set(p[0] * 2, p[1] * 2, p[2] * 2);
    leaf.castShadow = true;
    g.add(leaf);
  });
  return g;
}

let lampGroup = null;

// ★ 自己加装饰物就写在这里，然后在 buildAll() 里加一行调用。
// 纯装饰：不进 pickables，不能点，也不影响 data.json。
function buildDecor() {
  // 挂钟，贴在后墙空着的左侧（后墙内表面在 z = -6.0）
  const cx = -5.0, cy = 3.48, cz = -5.9;
  const rim = cyl(0.48, 0.48, 0.1, 24, cx, cy, cz, MAT.woodDark);
  rim.rotation.x = Math.PI / 2;
  const dial = cyl(0.42, 0.42, 0.11, 24, cx, cy, cz, MAT.wall);
  dial.rotation.x = Math.PI / 2;
  box(0.05, 0.26, 0.03, cx, cy + 0.12, cz + 0.07, MAT.darker);   // 时针
  box(0.18, 0.05, 0.03, cx + 0.08, cy, cz + 0.07, MAT.darker);   // 分针
  cyl(0.035, 0.035, 0.05, 10, cx, cy, cz + 0.08, MAT.darker).rotation.x = Math.PI / 2;

  // 桌上一个杯子（桌面在 y = 1.5）
  cyl(0.1, 0.085, 0.18, 12, 0.35, 1.59, -4.55, MAT.pot);
}

function buildAll() {
  buildRoom();
  buildShelf();
  buildFrame();
  buildMonitor();
  lampGroup = buildLamp();
  buildCrate();
  buildPlant();
  buildDecor();
  root.position.y = -1.2;
}

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  const base = 16.0;
  let vh = base;
  let vw = base * aspect;
  if (aspect < 1) {
    vw = base;
    vh = base / aspect;
  }
  camera.left = -vw / 2;
  camera.right = vw / 2;
  camera.top = vh / 2;
  camera.bottom = -vh / 2;
  camera.updateProjectionMatrix();

  currentVW = vw;
  const panelW = w > 760 ? 442 : 0;
  shiftAmount = Math.max(0, Math.min((vw - 18.2) / 2 - 1.8, (panelW / w) * vw * 0.55));
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
let hoverKey = null;
let needPick = false;

function findPickable(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.key) return o;
    o = o.parent;
  }
  return null;
}

function pick() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, true);
  const g = hits.length ? findPickable(hits[0].object) : null;
  const key = g ? g.userData.key : null;

  if (key !== hoverKey) {
    hoverKey = key;
    pickables.forEach(p => { p.userData.hover = p.userData.key === key; });
    canvas.style.cursor = key ? 'pointer' : 'grab';
    if (key) {
      tip.textContent = g.userData.label;
      tip.classList.add('on');
    } else {
      tip.classList.remove('on');
    }
  }
}

let dragging = false;
let dragMoved = 0;
let startX = 0;
let startY = 0;
let targetRotY = 0;
let targetZoom = 1;

canvas.addEventListener('pointerdown', e => {
  dragging = true;
  dragMoved = 0;
  startX = e.clientX;
  startY = e.clientY;
  canvas.classList.add('dragging');
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', e => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  needPick = true;

  if (tip.classList.contains('on')) {
    tip.style.left = e.clientX + 'px';
    tip.style.top = e.clientY + 'px';
  }

  if (dragging) {
    const dx = e.clientX - startX;
    dragMoved = Math.max(dragMoved, Math.abs(dx) + Math.abs(e.clientY - startY));
    targetRotY = Math.max(-0.26, Math.min(0.26, targetRotY + dx * 0.0022));
    startX = e.clientX;
    startY = e.clientY;
  }
});

canvas.addEventListener('pointerup', e => {
  dragging = false;
  canvas.classList.remove('dragging');
  if (dragMoved < 8) {
    if (hoverKey === 'lamp') toggleTheme();
    else if (hoverKey) openPanel(hoverKey);
    else closePanel();
  }
});

canvas.addEventListener('pointerleave', () => {
  pointer.set(-10, -10);
  needPick = true;
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  targetZoom = Math.max(0.82, Math.min(1.55, targetZoom - e.deltaY * 0.0009));
}, { passive: false });

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const PANELS = {
  projects: {
    kicker: '显示器',
    title: '项目与课题',
    render() {
      return '<p class="lede">屏幕上开着的这几个窗口，是我这几年真正动手做过的课题和项目。</p>' +
        DATA.projects.map(p => `
          <article class="proj">
            <div class="proj-top"><h3>${esc(p.name)}</h3><span class="year">${esc(p.year)}</span></div>
            <p class="role">${esc(p.role)}</p>
            <p class="body">${esc(p.desc)}</p>
            <div class="tags">${(p.stack || []).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>
            ${p.link ? `<a class="more" href="${esc(p.link)}" target="_blank" rel="noopener">查看项目 →</a>` : ''}
          </article>`).join('');
    }
  },
  skills: {
    kicker: '书架',
    title: '技能与工具',
    render() {
      return '<p class="lede">书架上每一本都是真用过、真踩过坑的东西。按类分层，没有虚的。</p>' +
        DATA.skills.map(g => `
          <div class="skill-group">
            <h3>${esc(g.group)}</h3>
            <div class="skill-items">${g.items.map(i => `<span>${esc(i)}</span>`).join('')}</div>
          </div>`).join('');
    }
  },
  experience: {
    kicker: '墙上的画',
    title: '教育与实习经历',
    render() {
      return '<p class="lede">挂在墙上的那条时间线，是到目前为止走过的几段路。</p><ul class="tl">' +
        DATA.experience.map(e => `
          <li>
            <p class="period">${esc(e.period)}</p>
            <h3>${esc(e.company)}</h3>
            <p class="role">${esc(e.role)}</p>
            <p class="body">${esc(e.desc)}</p>
          </li>`).join('') + '</ul>';
    }
  },
  posts: {
    kicker: '地上的箱子',
    title: '论文与笔记',
    render() {
      return '<p class="lede">论文、专利，还有平时记下的东西，都收在这个箱子里，随时可以翻。</p>' +
        DATA.posts.map(p => {
          const inner = `
            <p class="date">${esc(p.date)}</p>
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.summary)}</p>`;
          return p.url
            ? `<a class="post" href="${esc(p.url)}" target="_blank" rel="noopener">${inner}</a>`
            : `<div class="post">${inner}</div>`;
        }).join('');
    }
  }
};

const panelCard = document.getElementById('panel-card');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?slow=1 把展开/收回动画放慢 8 倍，方便观察转场
const ANIM_SCALE = new URLSearchParams(location.search).has('slow') ? 8 : 1;
let cardAnim = null;

// 物件在屏幕上的中心点，作为转场的起点 / 终点
function screenAnchor(key) {
  const g = pickables.find(p => p.userData.key === key);
  if (!g) return null;
  // 相机矩阵要等第一次渲染才更新，提前投影必须先手动同步，否则坐标是乱的
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  const b = new THREE.Box3().setFromObject(g);
  if (b.isEmpty()) return null;
  const c = b.getCenter(new THREE.Vector3()).project(camera);
  return {
    x: (c.x * 0.5 + 0.5) * innerWidth,
    y: (-c.y * 0.5 + 0.5) * innerHeight
  };
}

// 卡片由 CSS 居中摆放，所以卡片中心就是视口中心
function anchorTransform(anchor) {
  const dx = anchor.x - innerWidth / 2;
  const dy = anchor.y - innerHeight / 2;
  return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.12)`;
}

function openPanel(key) {
  const cfg = PANELS[key];
  if (!cfg) return;
  panelKicker.textContent = cfg.kicker;
  panelTitle.textContent = cfg.title;
  panelBody.innerHTML = cfg.render();
  panelBody.scrollTop = 0;

  // 已经开着再点别的物件：只换内容，不重播展开
  if (panel.classList.contains('open')) {
    panel.dataset.key = key;
    if (!reduceMotion) panelCard.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    return;
  }

  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  panel.dataset.key = key;

  const anchor = screenAnchor(key);
  if (!reduceMotion && anchor) {
    if (cardAnim) cardAnim.cancel();
    cardAnim = panelCard.animate(
      [
        { transform: anchorTransform(anchor), opacity: 0.3 },
        { transform: 'none', opacity: 1 }
      ],
      { duration: 460 * ANIM_SCALE, easing: 'cubic-bezier(0.22, 0.9, 0.3, 1)' }
    );
  }
}

function closePanel() {
  if (!panel.classList.contains('open')) return;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');

  // 关闭时按物件当前的位置飞回去（房间可能已被拖动/缩放过）
  const anchor = screenAnchor(panel.dataset.key) || null;
  if (!reduceMotion && anchor) {
    if (cardAnim) cardAnim.cancel();
    cardAnim = panelCard.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: anchorTransform(anchor), opacity: 0 }
      ],
      { duration: 380 * ANIM_SCALE, easing: 'cubic-bezier(0.4, 0, 0.72, 0.3)' }
    );
  }
}

panel.addEventListener('click', e => {
  if (e.target === panel) closePanel();
});

document.getElementById('panel-close').addEventListener('click', closePanel);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePanel();
});

let themeTarget = 0;
let themeMix = 0;

function setTheme(dark, instant) {
  themeTarget = dark ? 1 : 0;
  if (instant) themeMix = themeTarget;
  document.getElementById('theme-btn').textContent = dark ? '白天' : '夜晚';
  document.documentElement.setAttribute('data-theme', dark ? 'night' : 'day');
}

function toggleTheme() {
  const dark = themeTarget < 0.5;
  setTheme(dark);
  try { localStorage.setItem('room-theme', dark ? 'night' : 'day'); } catch (e) {}
}

document.getElementById('theme-btn').addEventListener('click', toggleTheme);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.06);
  const t = clock.elapsedTime;

  if (needPick) {
    needPick = false;
    pick();
  }

  themeMix += (themeTarget - themeMix) * Math.min(1, dt * 5);
  for (const m of themeMats) {
    m.color.lerpColors(m.userData.day, m.userData.night, themeMix);
  }
  for (const l of themeLights) {
    l.light.intensity = l.day + (l.night - l.day) * themeMix;
    if (l.colorDay) l.light.color.lerpColors(l.colorDay, l.colorNight, themeMix);
  }
  scene.background.lerpColors(bgDay, bgNight, themeMix);

  if (lampGroup) {
    const b = lampGroup.userData.bulb;
    const flicker = 1 + Math.sin(t * 1.7) * 0.02;
    b.intensity = (themeMix * 14 + 1.5) * flicker;
  }

  root.rotation.y += (targetRotY - root.rotation.y) * Math.min(1, dt * 6);
  root.position.y += (0 - root.position.y) * Math.min(1, dt * 3.2);

  shift += (shiftTarget - shift) * Math.min(1, dt * 5);
  updateCamera();

  camera.zoom += (targetZoom - camera.zoom) * Math.min(1, dt * 8);
  camera.updateProjectionMatrix();

  for (const p of pickables) {
    const goal = p.userData.hover ? 0.07 : 0;
    p.position.y += (goal - p.position.y) * Math.min(1, dt * 12);
  }

  renderer.render(scene, camera);
}

function boot(data) {
  DATA = data;

  document.getElementById('site-name').textContent = data.site.name;
  document.getElementById('site-title').textContent = data.site.title;
  document.getElementById('brand').textContent = data.site.brand || data.site.name.slice(0, 1);
  document.title = `${data.site.name} · ${data.site.tagline}`;

  buildAll();
  resize();
  window.addEventListener('resize', resize);

  const params = new URLSearchParams(location.search);
  let saved = 'day';
  try { saved = localStorage.getItem('room-theme') || 'day'; } catch (e) {}
  if (params.get('theme') === 'night' || saved === 'night') setTheme(true, true);

  if (params.get('panel') && PANELS[params.get('panel')]) openPanel(params.get('panel'));

  const skipIntro = params.has('skip');
  if (skipIntro) {
    loader.style.display = 'none';
    root.position.y = 0;
    shift = shiftTarget;
    themeMix = themeTarget;
    updateCamera();
  }

  if (params.has('debug')) {
    const d = document.createElement('div');
    d.id = 'dbg';
    d.style.cssText = 'position:fixed;bottom:0;left:0;z-index:999;background:#fff;color:#000;font:12px monospace;padding:6px;line-height:1.6';
    d.textContent = 'iw=' + innerWidth + ' ih=' + innerHeight + ' vw=' + (camera.right * 2).toFixed(2) +
      ' vh=' + (camera.top * 2).toFixed(2) + ' amt=' + shiftAmount.toFixed(2) +
      ' shift=' + shift.toFixed(2) + ' zoom=' + camera.zoom.toFixed(2) +
      ' dpr=' + devicePixelRatio +
      ' anchors=' + pickables.map(p => {
        const a = screenAnchor(p.userData.key);
        return a ? p.userData.key + '(' + Math.round(a.x) + ',' + Math.round(a.y) + ')' : '';
      }).join(' ');
    document.body.appendChild(d);
  }

  clock.start();
  animate();

  if (!skipIntro) setTimeout(() => loader.classList.add('done'), 150);
}

const earlyQs = new URLSearchParams(location.search);
let stayRoom = false;
try { stayRoom = sessionStorage.getItem('stay-room') === '1'; } catch (e) {}
if (innerWidth < 720 && !earlyQs.has('room') && !stayRoom) {
  location.replace('./site.html');
}

fetch('./data.json')
  .then(r => {
    if (!r.ok) throw new Error('data.json ' + r.status);
    return r.json();
  })
  .then(boot)
  .catch(err => {
    loader.innerHTML = '<p style="max-width:320px;text-align:center;line-height:1.9">内容加载失败：' +
      err.message + '<br>请确认 data.json 位于项目根目录，并通过本地服务器访问。</p>';
  });
