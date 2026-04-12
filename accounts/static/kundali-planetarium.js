import * as THREE from "https://unpkg.com/three@0.166.1/build/three.module.js";

const INSTANCES = new WeakMap();

const PLANET_TEXTURES = {
  Sun: "https://www.solarsystemscope.com/textures/download/2k_sun.jpg",
  Moon: "https://www.solarsystemscope.com/textures/download/2k_moon.jpg",
  Mars: "https://www.solarsystemscope.com/textures/download/2k_mars.jpg",
  Mercury: "https://www.solarsystemscope.com/textures/download/2k_mercury.jpg",
  Jupiter: "https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg",
  Venus: "https://www.solarsystemscope.com/textures/download/2k_venus_surface.jpg",
  Saturn: "https://www.solarsystemscope.com/textures/download/2k_saturn.jpg",
};

const PLANET_VISUALS = {
  Sun: { size: 15, color: 0xffc85c, tilt: 0.08 },
  Moon: { size: 11, color: 0xd8e5ff, tilt: 0.06 },
  Mars: { size: 10, color: 0xd16a48, tilt: 0.14 },
  Mercury: { size: 8.5, color: 0x7fd8b0, tilt: 0.1 },
  Jupiter: { size: 14, color: 0xd6a062, tilt: 0.11 },
  Venus: { size: 11.5, color: 0xe3b8a0, tilt: 0.07 },
  Saturn: { size: 13.5, color: 0xc9bb88, tilt: 0.34, ring: "https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png" },
  Rahu: { size: 10.5, color: 0x7fd9ff, tilt: 0.18, glow: 0x7fd9ff },
  Ketu: { size: 10.5, color: 0xffb08c, tilt: 0.18, glow: 0xffb08c },
};

const SIGN_LABELS = {
  en: ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"],
  hi: ["मेष", "वृषभ", "मिथुन", "कर्क", "सिंह", "कन्या", "तुला", "वृश्चिक", "धनु", "मकर", "कुंभ", "मीन"],
};

const LABEL_FONT = "700 42px Manrope, Arial, sans-serif";
const LABEL_SUB_FONT = "600 26px Space Grotesk, Arial, sans-serif";
const SIGN_FONT = "700 28px Space Grotesk, Arial, sans-serif";

const loader = new THREE.TextureLoader();
loader.crossOrigin = "anonymous";

const flareTexture = loader.load("https://threejs.org/examples/textures/lensflare/lensflare0.png");
flareTexture.colorSpace = THREE.SRGBColorSpace;

const loadTextureSafe = (url, configure) =>
  new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        if (configure) configure(texture);
        resolve(texture);
      },
      undefined,
      () => resolve(null),
    );
  });

function zodiacLongitude(planet) {
  const signIndex = Number(planet?.rashi_index);
  const degreeInSign = Number(
    planet?.degree_in_sign ?? (((Number(planet?.degree) || 0) % 30 + 30) % 30),
  );
  const signBase = Number.isFinite(signIndex) ? signIndex * 30 : 0;
  return (signBase + (Number.isFinite(degreeInSign) ? degreeInSign : 0) + 360) % 360;
}

function makeLabelSprite(name, degree) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 164;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#f5f7ff";
  ctx.font = LABEL_FONT;
  ctx.fillText(name, canvas.width / 2, 58);
  ctx.fillStyle = "rgba(225, 230, 242, 0.82)";
  ctx.font = LABEL_SUB_FONT;
  ctx.fillText(degree, canvas.width / 2, 108);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(86, 28, 1);
  return sprite;
}

function makeSignSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgba(233, 237, 244, 0.72)";
  ctx.font = SIGN_FONT;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(42, 15, 1);
  return sprite;
}

function buildInstance(host) {
  const mount = host.querySelector(".kundali-planetarium-canvas");
  if (!mount || !window.WebGLRenderingContext) return null;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03060d, 0.00125);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 4000);
  camera.position.set(0, 210, 620);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0x8fa8ff, 1.18);
  scene.add(ambient);

  const keyLight = new THREE.PointLight(0xffd27c, 2.6, 2200, 1.3);
  keyLight.position.set(0, 120, 120);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x8ec5ff, 0.5);
  rimLight.position.set(-260, 160, -220);
  scene.add(rimLight);

  const starGeo = new THREE.BufferGeometry();
  const starCount = 1100;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const radius = 900 + Math.random() * 700;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0.86 }),
  );
  scene.add(stars);

  const systemRoot = new THREE.Group();
  scene.add(systemRoot);

  const zodiacRoot = new THREE.Group();
  systemRoot.add(zodiacRoot);

  const centerDisc = new THREE.Mesh(
    new THREE.CircleGeometry(40, 64),
    new THREE.MeshPhongMaterial({
      color: 0x0d1628,
      transparent: true,
      opacity: 0.92,
      emissive: new THREE.Color(0x203357).multiplyScalar(0.32),
    }),
  );
  centerDisc.rotation.x = -Math.PI / 2;
  zodiacRoot.add(centerDisc);

  const centerHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: flareTexture,
      color: 0xbfd9ff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  centerHalo.scale.set(160, 160, 1);
  zodiacRoot.add(centerHalo);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clickable = [];
  const dynamicNodes = [];

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let targetRotX = -0.4;
  let targetRotY = 0.34;
  let currentRotX = targetRotX;
  let currentRotY = targetRotY;
  let animationFrame = 0;

  const resize = () => {
    const width = mount.clientWidth || 640;
    const height = mount.clientHeight || 520;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.set(0, width < 640 ? 180 : 210, width < 640 ? 560 : 620);
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
  };

  const clearDynamic = () => {
    clickable.splice(0, clickable.length);
    while (dynamicNodes.length) {
      const node = dynamicNodes.pop();
      if (node?.parent) node.parent.remove(node);
      if (node?.geometry) node.geometry.dispose?.();
      if (node?.material) {
        if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose?.());
        else node.material.dispose?.();
      }
      if (node?.children?.length) {
        node.children.forEach((child) => {
          child.material?.dispose?.();
          child.geometry?.dispose?.();
        });
      }
    }
  };

  const addStaticWheel = (lang = "en") => {
    const ringOuter = new THREE.Mesh(
      new THREE.RingGeometry(248, 256, 128),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
    );
    ringOuter.rotation.x = -Math.PI / 2;
    zodiacRoot.add(ringOuter);
    dynamicNodes.push(ringOuter);

    const ringInner = new THREE.Mesh(
      new THREE.RingGeometry(204, 210, 128),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
    );
    ringInner.rotation.x = -Math.PI / 2;
    zodiacRoot.add(ringInner);
    dynamicNodes.push(ringInner);

    const signLabels = SIGN_LABELS[lang] || SIGN_LABELS.en;
    for (let index = 0; index < 12; index += 1) {
      const angle = (index * 30) * (Math.PI / 180);
      const spoke = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(angle) * 210, 0, Math.sin(angle) * 210),
        new THREE.Vector3(Math.cos(angle) * 256, 0, Math.sin(angle) * 256),
      ]);
      const spokeLine = new THREE.Line(
        spoke,
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.11 }),
      );
      zodiacRoot.add(spokeLine);
      dynamicNodes.push(spokeLine);

      const label = makeSignSprite(signLabels[index]);
      if (label) {
        label.position.set(Math.cos(angle) * 288, 0, Math.sin(angle) * 288);
        zodiacRoot.add(label);
        dynamicNodes.push(label);
      }
    }
  };

  const update = async (planets, options = {}) => {
    clearDynamic();
    addStaticWheel(options.lang);

    const sorted = [...planets]
      .map((planet) => ({ ...planet, longitude: zodiacLongitude(planet) }))
      .sort((a, b) => a.longitude - b.longitude);

    let previousLongitude = -999;
    let lane = 0;
    for (const planet of sorted) {
      if (planet.longitude - previousLongitude < 12) {
        lane += 1;
      } else {
        lane = 0;
      }
      previousLongitude = planet.longitude;
      planet.lane = Math.min(lane, 3);
    }

    for (const planet of sorted) {
      const name = String(planet?.planet || "");
      const visual = PLANET_VISUALS[name] || { size: 10, color: 0xffffff, tilt: 0.12 };
      const longitude = planet.longitude;
      const angle = THREE.MathUtils.degToRad(longitude);
      const radius = 216 + (planet.lane * 18);
      const pivot = new THREE.Group();
      pivot.rotation.y = angle;

      const material = new THREE.MeshStandardMaterial({
        color: visual.color,
        roughness: 0.9,
        metalness: 0.03,
        emissive: new THREE.Color(visual.glow || visual.color).multiplyScalar(0.06),
      });
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(visual.size, 48, 48),
        material,
      );
      mesh.position.x = radius;
      mesh.rotation.z = visual.tilt;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.house = Number(planet?.house);
      pivot.add(mesh);
      clickable.push(mesh);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(visual.size * 1.06, 40, 40),
        new THREE.MeshPhongMaterial({
          color: visual.glow || visual.color,
          transparent: true,
          opacity: name === "Moon" ? 0.16 : 0.08,
          side: THREE.DoubleSide,
        }),
      );
      atmosphere.position.copy(mesh.position);
      pivot.add(atmosphere);

      if (visual.ring) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(visual.size * 1.45, visual.size * 2.2, 96),
          new THREE.MeshBasicMaterial({
            color: 0xe8d7ae,
            transparent: true,
            side: THREE.DoubleSide,
            opacity: 0.92,
          }),
        );
        ring.position.copy(mesh.position);
        ring.rotation.x = Math.PI / 2.2;
        ring.rotation.z = 0.24;
        pivot.add(ring);
        loadTextureSafe(visual.ring).then((ringTexture) => {
          if (ringTexture) {
            ring.material.map = ringTexture;
            ring.material.needsUpdate = true;
          }
        });
      }

      const degreeLabel = String(
        planet?.degreeLabel
        || planet?.degree
        || `${Number(planet?.degree_in_sign || 0).toFixed(1)}°`,
      );
      const label = makeLabelSprite(String(planet?.displayName || name), degreeLabel);
      if (label) {
        label.position.set(radius, visual.size + 22 + (planet.lane * 4), 0);
        pivot.add(label);
      }

      zodiacRoot.add(pivot);
      dynamicNodes.push(pivot);

      loadTextureSafe(PLANET_TEXTURES[name]).then((texture) => {
        if (texture) {
          material.map = texture;
          material.needsUpdate = true;
        }
      });
    }
  };

  const onPointerDown = (event) => {
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    mount.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragging) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    targetRotY += deltaX * 0.0028;
    targetRotX += deltaY * 0.0018;
    targetRotX = Math.max(-0.92, Math.min(-0.05, targetRotX));
    startX = event.clientX;
    startY = event.clientY;
  };

  const onPointerUp = (event) => {
    dragging = false;
    mount.releasePointerCapture?.(event.pointerId);
  };

  const onClick = (event) => {
    if (!clickable.length) return;
    const rect = mount.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(clickable, false);
    const hit = hits[0];
    const house = Number(hit?.object?.userData?.house);
    if (Number.isFinite(house)) {
      INSTANCES.get(host)?.onSelectHouse?.(house);
    }
  };

  mount.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  mount.addEventListener("click", onClick);
  window.addEventListener("resize", resize);
  resize();

  host.classList.add("kundali-planetarium--webgl-ready");

  const animate = () => {
    currentRotX += (targetRotX - currentRotX) * 0.06;
    currentRotY += (targetRotY - currentRotY) * 0.06;
    zodiacRoot.rotation.x = currentRotX;
    zodiacRoot.rotation.y = currentRotY;
    stars.rotation.y += 0.00008;
    dynamicNodes.forEach((node) => {
      if (node instanceof THREE.Group) {
        node.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.geometry?.type === "SphereGeometry") {
            child.rotation.y += 0.008;
          }
        });
      }
    });
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(animate);
  };
  animate();

  return {
    onSelectHouse: null,
    update,
    dispose() {
      cancelAnimationFrame(animationFrame);
      mount.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      mount.removeEventListener("click", onClick);
      window.removeEventListener("resize", resize);
      clearDynamic();
      renderer.dispose();
      mount.innerHTML = "";
    },
  };
}

export function renderKundaliPlanetarium(host, planets, options = {}) {
  if (!host) return;
  let instance = INSTANCES.get(host);
  if (!instance) {
    instance = buildInstance(host);
    if (!instance) return;
    INSTANCES.set(host, instance);
  }
  instance.onSelectHouse = options.onSelectHouse || null;
  instance.update(planets, options);
}

window.renderKundaliPlanetarium = renderKundaliPlanetarium;
