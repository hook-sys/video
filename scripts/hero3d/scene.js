// Browser side of the hero render: one dark studio (warm key upper-left, cool
// rim back-right, low fill), one camera rule, three passes per frame —
// beauty (transparent background), accent mask, contact shadow.

import * as THREE from "three";
import { HEROES, palette } from "./objects.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

// Studio environment for reflections: a near-black room with soft boxes.
function studio() {
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: 0x07080b, side: THREE.BackSide })));
  const box = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  box(26, 18, 0xffe4c4, 9, [-20, 18, 16]); // warm key, upper left front
  box(8, 30, 0xc9dcff, 11, [24, 6, -18]); // cool rim strip, back right
  box(30, 10, 0xffffff, 2.2, [0, 30, 0]); // top
  box(34, 18, 0xf2efe9, 1.1, [0, 6, 34]); // broad, low front fill so faces read
  box(4, 22, 0xffffff, 3, [22, 2, 14]); // thin front-right strip for edge highlights
  box(40, 6, 0x1a1d24, 1, [0, -20, 10]); // dim floor bounce
  box(14, 26, 0xdfe6f2, 2.6, [-32, 4, -4]); // soft left side box
  // A dim horizon band so chrome and gold never mirror pure black.
  const band = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 14, 64, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6b7280).multiplyScalar(0.55), side: THREE.BackSide }));
  band.position.y = 2;
  room.add(band);
  const pm = new THREE.PMREMGenerator(renderer);
  return pm.fromScene(room, 0.02).texture;
}

const env = studio();
const P = palette(env);
const scene = new THREE.Scene();

const key = new THREE.DirectionalLight(0xffe2c0, 2.4);
key.position.set(-7, 9, 8);
const rim = new THREE.DirectionalLight(0xbcd4ff, 3.2);
rim.position.set(7, 5, -9);
const fill = new THREE.HemisphereLight(0x8a93a8, 0x0b0c10, 0.35);
scene.add(key, rim, fill);

// Contact shadow light: almost overhead, used only by the shadow pass.
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(-1.5, 20, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 18;
sun.shadow.blurSamples = 25;
sun.shadow.bias = -0.0005;
scene.add(sun);
sun.visible = false;

const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.55 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Fresnel edge light for glass: bright, cool-white rims, clear centre.
const fresnel = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `varying vec3 vN; varying vec3 vV;
    void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vN; varying vec3 vV;
    void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6); float top = clamp(normalize(vN).y * 0.5 + 0.5, 0.0, 1.0);
      gl_FragColor = vec4(vec3(0.93, 0.96, 1.0), clamp(f * (0.55 + 0.45 * top), 0.0, 0.9)); }`,
});

const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 400);
const holders = {};

function load(name) {
  if (holders[name]) return holders[name];
  const { group, pose } = HEROES[name](P);
  const posed = new THREE.Group();
  group.rotation.x += pose.pitch;
  posed.add(group);
  // Centre on the bounding sphere so a turntable never drifts.
  const sphere = new THREE.Box3().setFromObject(posed).getBoundingSphere(new THREE.Sphere());
  group.position.sub(sphere.center);
  const spin = new THREE.Group();
  spin.add(posed);
  const h = { spin, radius: sphere.radius, meshes: [] };
  spin.traverse((o) => o.isMesh && h.meshes.push(o));
  for (const m of [...h.meshes]) {
    if (!m.material.userData?.glass) continue;
    const shell = new THREE.Mesh(m.geometry, fresnel);
    shell.renderOrder = 2;
    m.add(shell);
    h.meshes.push(shell);
  }
  for (const m of h.meshes) m.userData.mats = m.material;
  holders[name] = h;
  return h;
}

const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
const hidden = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const isAccent = (m) => [].concat(m.userData.mats).some((x) => x.userData.accent);
const isGlass = (m) => [].concat(m.userData.mats).every((x) => x.transparent);

// Render one pass; returns a PNG data URL.
window.renderHero = ({ name, yaw, elevation, size, pass }) => {
  const h = load(name);
  for (const k of Object.keys(holders)) if (holders[k].spin.parent) scene.remove(holders[k].spin);
  scene.add(h.spin);
  h.spin.rotation.set(0, (-yaw * Math.PI) / 180, 0);
  renderer.setSize(size, size, false);
  const e = (elevation * Math.PI) / 180;
  const dist = (h.radius * 1.12) / Math.sin(((camera.fov / 2) * Math.PI) / 180);
  camera.position.set(0, Math.sin(e) * dist, Math.cos(e) * dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  ground.position.y = -h.radius * 0.98;

  ground.visible = pass === "shadow";
  sun.visible = pass === "shadow";
  key.visible = rim.visible = fill.visible = pass === "beauty";
  for (const m of h.meshes) {
    m.visible = true;
    if (pass === "beauty") m.material = m.userData.mats;
    else if (pass === "mask") {
      m.material = isAccent(m) ? white : black;
      if (isGlass(m)) m.visible = false;
    } else m.material = hidden;
  }
  renderer.toneMapping = pass === "beauty" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.setClearColor(0x000000, pass === "mask" ? 1 : 0);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL("image/png");
};
window.heroReady = true;
