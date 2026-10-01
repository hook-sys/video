// The Priority A hero objects, modelled in three.js. One shared material
// palette (graphite, aluminium, chrome, gold, frosted glass, paper) and one
// emissive accent per object, rendered neutral and tinted later from its mask.
// Units: roughly centimetres; each object is centred and posed for a 3/4 view.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// Glass gets a fresnel edge shell in scene.js (transparent materials alone
// lose most of their reflection on a transparent background).
const tag = (m) => ((m.userData.glass = true), m);

export function palette(env) {
  const phys = (o) => new THREE.MeshPhysicalMaterial({ envMap: env, envMapIntensity: 1, ...o });
  return {
    graphite: () => phys({ color: 0x4a4f5a, metalness: 0.85, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.18, anisotropy: 0.55 }),
    graphiteDeep: () => phys({ color: 0x1b1d22, metalness: 0.6, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
    titanium: () => phys({ color: 0x626874, metalness: 0.9, roughness: 0.46, anisotropy: 0.8, anisotropyRotation: 0, clearcoat: 0.5, clearcoatRoughness: 0.08 }),
    aluminium: () => phys({ color: 0xa3a9b3, metalness: 1, roughness: 0.36, anisotropy: 0.6 }),
    chrome: () => phys({ color: 0xe6e8ec, metalness: 1, roughness: 0.12 }),
    gold: () => phys({ color: 0xd6ad5c, metalness: 1, roughness: 0.3 }),
    ceramic: () => phys({ color: 0x15171b, metalness: 0, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    glass: (o = {}) => tag(phys({ color: 0xd9e0ee, metalness: 0, roughness: 0.18, transparent: true, opacity: 0.42, clearcoat: 1, clearcoatRoughness: 0.06, ior: 1.5, specularIntensity: 1, depthWrite: false, side: THREE.DoubleSide, ...o })),
    paper: () => phys({ color: 0xe8e6e0, metalness: 0, roughness: 0.82, sheen: 0.4, sheenRoughness: 0.8, sheenColor: 0xffffff }),
    ink: () => phys({ color: 0xb9bcc4, metalness: 0, roughness: 0.7 }),
    // The tintable accent: neutral white light, masked separately.
    accent: () => {
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.4, metalness: 0 });
      m.userData.accent = true;
      return m;
    },
  };
}

const roundRect = (w, h, r) => {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

// A slab from a rounded rectangle with a real bevel; front face at +z.
const slab = (w, h, depth, r, bevel) => {
  const g = new THREE.ExtrudeGeometry(roundRect(w - bevel * 2, h - bevel * 2, Math.max(0.001, r - bevel)), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 14, curveSegments: 32,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
};

const mesh = (g, m) => {
  const x = new THREE.Mesh(g, m);
  x.castShadow = true;
  return x;
};

// ── payment card ────────────────────────────────────────────────────────
function paymentCard(P) {
  const g = new THREE.Group();
  const body = mesh(slab(8.56, 5.4, 0.06, 0.34, 0.025), [P.titanium(), P.chrome()]);
  g.add(body);
  // EMV chip: gold plate, six contacts split by fine grooves.
  const chip = new THREE.Group();
  chip.add(mesh(slab(1.15, 0.9, 0.02, 0.14, 0.008), P.ceramic()));
  const pads = [[-0.29, 0.27], [0.29, 0.27], [-0.29, 0], [0.29, 0], [-0.29, -0.27], [0.29, -0.27]];
  for (const [x, y] of pads) {
    const p = mesh(slab(0.54, 0.24, 0.02, 0.05, 0.006), P.gold());
    p.position.set(x, y, 0.016);
    chip.add(p);
  }
  chip.position.set(-2.55, 0.45, 0.058);
  g.add(chip);
  // The accent: one fine light line across the lower face.
  const line = mesh(slab(5.6, 0.06, 0.012, 0.03, 0.004), P.accent());
  line.position.set(0.9, -1.55, 0.062);
  g.add(line);
  // A faint brushed-aluminium edge band on the face for depth.
  const band = mesh(slab(8.0, 0.02, 0.008, 0.01, 0.003), P.aluminium());
  band.position.set(0, -1.85, 0.058);
  g.add(band);
  g.rotation.set(-0.08, 0, -0.07);
  return { group: g, pose: { pitch: 0 } };
}

// ── chart block ─────────────────────────────────────────────────────────
function chartBlock(P) {
  const g = new THREE.Group();
  const base = mesh(slab(7.4, 3.4, 0.5, 0.45, 0.12), P.glass({ color: 0xc9d3e6, opacity: 0.32, roughness: 0.25 }));
  base.rotation.x = -Math.PI / 2;
  g.add(base);
  const core = mesh(slab(7.0, 3.0, 0.16, 0.36, 0.05), P.graphiteDeep());
  core.rotation.x = -Math.PI / 2;
  core.position.y = 0.02;
  g.add(core);
  const heights = [1.1, 1.7, 1.45, 2.5, 3.6];
  heights.forEach((h, i) => {
    const last = i === heights.length - 1;
    const bar = mesh(new RoundedBoxGeometry(0.95, h, 0.95, 6, 0.12), last ? P.accent() : P.aluminium());
    bar.position.set(-2.6 + i * 1.3, 0.3 + h / 2, 0);
    g.add(bar);
    if (last) {
      // A glass sleeve around the lit bar so it reads as a light inside glass.
      const sleeve = mesh(new RoundedBoxGeometry(1.1, h + 0.12, 1.1, 6, 0.16), P.glass({ opacity: 0.28, roughness: 0.1 }));
      sleeve.position.copy(bar.position);
      g.add(sleeve);
    }
  });
  return { group: g, pose: { pitch: 0 } };
}

// ── padlock ─────────────────────────────────────────────────────────────
function padlock(P) {
  const g = new THREE.Group();
  const body = mesh(slab(4.2, 3.6, 1.5, 0.7, 0.18), P.graphite());
  body.position.y = -0.9;
  g.add(body);
  // Frosted glass face over the body.
  const face = mesh(slab(3.6, 3.0, 0.22, 0.5, 0.08), P.glass({ opacity: 0.38 }));
  face.position.set(0, -0.9, 0.86);
  g.add(face);
  // Shackle: polished chrome, a half torus on two legs, closed.
  const r = 1.35, t = 0.32;
  const arc = mesh(new THREE.TorusGeometry(r, t, 32, 96, Math.PI), P.chrome());
  arc.position.y = 2.05;
  g.add(arc);
  for (const x of [-r, r]) {
    const leg = mesh(new THREE.CylinderGeometry(t, t, 1.4, 48), P.chrome());
    leg.position.set(x, 1.35, 0);
    g.add(leg);
  }
  // Accent ring around a recessed aluminium disc.
  const ring = mesh(new THREE.TorusGeometry(0.62, 0.05, 24, 120), P.accent());
  ring.position.set(0, -0.75, 0.99);
  g.add(ring);
  const disc = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 96), P.aluminium());
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, -0.75, 0.96);
  g.add(disc);
  const slot = mesh(new RoundedBoxGeometry(0.14, 0.42, 0.06, 4, 0.03), P.graphiteDeep());
  slot.position.set(0, -0.8, 1.0);
  g.add(slot);
  return { group: g, pose: { pitch: 0 } };
}

// ── AI chip ─────────────────────────────────────────────────────────────
function aiChip(P) {
  const g = new THREE.Group();
  const pkg = mesh(slab(5, 5, 0.4, 0.35, 0.08), P.ceramic());
  g.add(pkg);
  const spreader = mesh(slab(2.9, 2.9, 0.22, 0.25, 0.08), P.aluminium());
  spreader.position.z = 0.32;
  g.add(spreader);
  // Fine machined grooves on the spreader.
  for (let i = -3; i <= 3; i++) {
    const groove = mesh(new THREE.BoxGeometry(2.2, 0.025, 0.02), P.graphiteDeep());
    groove.position.set(0, i * 0.3, 0.44);
    g.add(groove);
  }
  // Gold pins on all four sides.
  const n = 12;
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < n; i++) {
      const pin = mesh(new RoundedBoxGeometry(0.16, 0.5, 0.08, 2, 0.03), P.gold());
      const along = -2.05 + (i * 4.1) / (n - 1);
      const a = (s * Math.PI) / 2;
      const x = Math.cos(a) * 2.68, y = Math.sin(a) * 2.68;
      pin.position.set(x + -Math.sin(a) * along, y + Math.cos(a) * along, -0.1);
      pin.rotation.z = a + Math.PI / 2;
      g.add(pin);
    }
  }
  // Accent: circuit traces from the spreader out towards the pins (one mesh).
  const traces = [];
  const add = (x1, y1, x2, y2) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const b = new THREE.BoxGeometry(len + 0.035, 0.035, 0.02);
    b.rotateZ(Math.atan2(y2 - y1, x2 - x1));
    b.translate((x1 + x2) / 2, (y1 + y2) / 2, 0.29);
    traces.push(b);
  };
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2;
    const rot = (x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    for (const k of [-1.2, -0.6, 0, 0.6, 1.2]) {
      const bend = 1.85 + Math.abs(k) * 0.12;
      const [ax, ay] = rot(1.55, k);
      const [bx, by] = rot(bend, k);
      const [cx, cy] = rot(bend + 0.35, k * 1.35);
      const [dx, dy] = rot(2.35, k * 1.35);
      add(ax, ay, bx, by);
      add(bx, by, cx, cy);
      add(cx, cy, dx, dy);
    }
  }
  const merged = mergeGeometries(traces);
  g.add(mesh(merged, P.accent()));
  return { group: g, pose: { pitch: -0.95 } };
}

// ── document stack ──────────────────────────────────────────────────────
function documentStack(P) {
  const g = new THREE.Group();
  const sheets = [
    { x: 0.35, y: -0.25, r: 0.07 },
    { x: -0.2, y: 0.15, r: -0.05 },
    { x: 0.15, y: -0.05, r: 0.025 },
    { x: 0, y: 0, r: 0 },
  ];
  sheets.forEach((s, i) => {
    const m = mesh(slab(4.4, 5.8, 0.025, 0.12, 0.01), P.paper());
    m.position.set(s.x, s.y, i * 0.08);
    m.rotation.z = s.r;
    g.add(m);
  });
  const top = sheets.length * 0.08 - 0.06;
  // Abstract line blocks (never letters) on the top sheet.
  const rows = [[2.0, 2.15], [3.2, 1.6], [3.0, 1.3], [3.3, 1.0], [2.4, 0.7], [3.2, 0.2], [2.9, -0.1], [1.8, -0.4], [3.2, -0.9], [2.6, -1.2]];
  for (const [w, y] of rows) {
    const b = mesh(new RoundedBoxGeometry(w, 0.11, 0.012, 2, 0.005), P.ink());
    b.position.set(-1.55 + w / 2, y, top + 0.02);
    g.add(b);
  }
  // A heading block, darker.
  const head = mesh(new RoundedBoxGeometry(1.6, 0.22, 0.014, 2, 0.006), P.graphiteDeep());
  head.position.set(-1.55 + 0.8, 2.15 + 0.45, top + 0.02);
  g.add(head);
  // Brushed aluminium clip over the top edge.
  const clip = new THREE.Group();
  const front = mesh(new RoundedBoxGeometry(1.4, 0.9, 0.06, 4, 0.03), P.aluminium());
  front.position.set(0, 2.75, top + 0.07);
  clip.add(front);
  const back = mesh(new RoundedBoxGeometry(1.4, 0.9, 0.06, 4, 0.03), P.aluminium());
  back.position.set(0, 2.75, -0.07);
  clip.add(back);
  const bend = mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 32), P.aluminium());
  bend.rotation.z = Math.PI / 2;
  bend.position.set(0, 3.2, top / 2);
  clip.add(bend);
  clip.position.x = 0.9;
  g.add(clip);
  // Accent: a tab sticking out of the second sheet.
  const tab = mesh(slab(0.6, 0.9, 0.03, 0.12, 0.01), P.accent());
  tab.position.set(2.3, 1.3, 0.12);
  tab.rotation.z = -0.05;
  g.add(tab);
  return { group: g, pose: { pitch: -0.5 } };
}

// ── chat bubble ─────────────────────────────────────────────────────────
function bubbleShape(w, h, r, tail) {
  // One outline: a rounded rectangle whose lower-left corner flows into a tail.
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r + tail * 1.1, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r * 0.9);
  s.quadraticCurveTo(x, y - tail * 0.3, x - tail * 0.32, y - tail * 0.88);
  s.quadraticCurveTo(x - tail * 0.4, y - tail * 1.02, x - tail * 0.18, y - tail * 0.98);
  s.quadraticCurveTo(x + tail * 0.75, y - tail * 0.6, x + r + tail * 1.1, y);
  return [s];
}
const puff = (shapes, depth, bevel) => {
  const geos = shapes.map((sh) => {
    const ge = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.45, bevelSegments: 12, curveSegments: 48 });
    ge.translate(0, 0, -depth / 2);
    return ge;
  });
  const m = mergeGeometries(geos);
  m.computeVertexNormals();
  return m;
};
function chatBubble(P) {
  const g = new THREE.Group();
  const big = mesh(puff(bubbleShape(5.6, 3.5, 1.5, 1.0), 0.5, 0.45), P.glass({ color: 0xc9d3e6, opacity: 0.32, roughness: 0.2 }));
  g.add(big);
  // A dark graphite inner plate gives the glass something to sit on.
  const inner = mesh(slab(4.6, 2.5, 0.12, 1.1, 0.05), P.graphiteDeep());
  inner.position.z = -0.1;
  g.add(inner);
  const dots = mergeGeometries([-1.1, 0, 1.1].map((x) => new THREE.SphereGeometry(0.34, 48, 32).translate(x, 0, 0.2)));
  g.add(mesh(dots, P.accent()));
  // The reply: smaller, behind, mirrored, darker glass.
  const small = mesh(puff(bubbleShape(3.4, 2.2, 1.0, 0.7), 0.4, 0.35), P.glass({ color: 0x8b93a6, opacity: 0.3, roughness: 0.3 }));
  small.scale.x = -1;
  small.position.set(2.6, 2.3, -1.6);
  g.add(small);
  return { group: g, pose: { pitch: 0 } };
}

function mergeGeometries(list) {
  // Minimal merge for non-indexed / indexed geometries with the same attributes.
  const nonIndexed = list.map((x) => (x.index ? x.toNonIndexed() : x));
  const names = ["position", "normal", "uv"].filter((n) => nonIndexed.every((x) => x.attributes[n]));
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const size = nonIndexed[0].attributes[n].itemSize;
    const total = nonIndexed.reduce((a, x) => a + x.attributes[n].array.length, 0);
    const arr = new Float32Array(total);
    let o = 0;
    for (const x of nonIndexed) {
      arr.set(x.attributes[n].array, o);
      o += x.attributes[n].array.length;
    }
    out.setAttribute(n, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

export const HEROES = {
  "payment-card": paymentCard,
  "chart-block": chartBlock,
  padlock,
  "ai-chip": aiChip,
  "document-stack": documentStack,
  "chat-bubble": chatBubble,
};
