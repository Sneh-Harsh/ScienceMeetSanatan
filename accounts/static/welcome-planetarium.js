import * as THREE from "https://unpkg.com/three@0.166.1/build/three.module.js";

const mount = document.getElementById("planetariumCanvas");
const fallbackHost = document.getElementById("planetarium");

if (mount && fallbackHost && window.WebGLRenderingContext) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03060d, 0.00125);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 4000);
  camera.position.set(0, 210, 620);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0x8fa8ff, 1.2);
  scene.add(ambient);

  const sunlight = new THREE.PointLight(0xffd27c, 3.4, 2600, 1.4);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  scene.add(sunlight);

  const rimLight = new THREE.DirectionalLight(0x8ec5ff, 0.55);
  rimLight.position.set(-260, 160, -200);
  scene.add(rimLight);

  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";

  const loadTextureSafe = (url, configure) =>
    new Promise((resolve) => {
      loader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 8;
          if (configure) configure(texture);
          resolve(texture);
        },
        undefined,
        () => resolve(null)
      );
    });

  const makeLabelSprite = (text) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(8, 12, 19, 0.0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "700 52px Manrope, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#f5f7ff";
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
    sprite.scale.set(72, 18, 1);
    return sprite;
  };

  const starGeo = new THREE.BufferGeometry();
  const starCount = 1200;
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
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0.9 })
  );
  scene.add(stars);

  const systemRoot = new THREE.Group();
  scene.add(systemRoot);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(34, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0xffc85c })
  );
  systemRoot.add(sun);
  const sunGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: loader.load("https://threejs.org/examples/textures/lensflare/lensflare0.png"),
      color: 0xffcc66,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  sunGlow.scale.set(180, 180, 1);
  systemRoot.add(sunGlow);

  const planetDefs = [
    { name: "Mercury", size: 5, orbit: 70, periodDays: 87.97, texture: "https://www.solarsystemscope.com/textures/download/2k_mercury.jpg", color: 0xb9afa0, tilt: 0.02 },
    { name: "Venus", size: 8, orbit: 98, periodDays: 224.7, texture: "https://www.solarsystemscope.com/textures/download/2k_venus_surface.jpg", color: 0xe1bf8f, tilt: 0.05 },
    { name: "Earth", size: 8.5, orbit: 132, periodDays: 365.26, texture: "https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg", color: 0x6ea8ff, tilt: 0.41 },
    { name: "Mars", size: 6.2, orbit: 166, periodDays: 686.98, texture: "https://www.solarsystemscope.com/textures/download/2k_mars.jpg", color: 0xc75d3e, tilt: 0.22 },
    { name: "Jupiter", size: 18, orbit: 226, periodDays: 4332.59, texture: "https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg", color: 0xd19b63, tilt: 0.08 },
    { name: "Saturn", size: 15.6, orbit: 298, periodDays: 10759.22, texture: "https://www.solarsystemscope.com/textures/download/2k_saturn.jpg", ring: "https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png", color: 0xd8c183, tilt: 0.48 },
    { name: "Uranus", size: 11, orbit: 372, periodDays: 30688.5, texture: "https://www.solarsystemscope.com/textures/download/2k_uranus.jpg", color: 0x7fdfea, tilt: 1.1 },
    { name: "Neptune", size: 10.5, orbit: 446, periodDays: 60182, texture: "https://www.solarsystemscope.com/textures/download/2k_neptune.jpg", color: 0x5982ff, tilt: 0.52 },
  ];

  const planets = [];
  const orbitMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 });
  const orbitPoints = [];
  for (let i = 0; i <= 128; i += 1) {
    const angle = (i / 128) * Math.PI * 2;
    orbitPoints.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
  }
  const baseOrbit = new THREE.BufferGeometry().setFromPoints(orbitPoints);

  planetDefs.forEach(async (planet, index) => {
    const pivot = new THREE.Group();
    pivot.rotation.y = THREE.MathUtils.degToRad(index * 39);
    const material = new THREE.MeshStandardMaterial({
      color: planet.color,
      roughness: 0.92,
      metalness: 0.02,
      emissive: new THREE.Color(planet.color).multiplyScalar(0.05),
    });
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(planet.size, 48, 48),
      material
    );
    mesh.position.x = planet.orbit;
    mesh.rotation.z = planet.tilt;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const label = makeLabelSprite(planet.name);
    if (label) {
      label.position.set(planet.orbit, planet.size + 18, 0);
      pivot.add(label);
    }

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(planet.size * 1.05, 40, 40),
      new THREE.MeshPhongMaterial({
        color: planet.name === "Earth" ? 0xa7d8ff : planet.color,
        transparent: true,
        opacity: planet.name === "Earth" ? 0.14 : 0.06,
        side: THREE.DoubleSide,
      })
    );
    atmosphere.position.copy(mesh.position);
    pivot.add(atmosphere);

    if (planet.ring) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(planet.size * 1.35, planet.size * 2.25, 96),
        new THREE.MeshBasicMaterial({
          color: 0xe8d7ae,
          transparent: true,
          side: THREE.DoubleSide,
          opacity: 0.92,
        })
      );
      ring.position.copy(mesh.position);
      ring.rotation.x = Math.PI / 2.3;
      ring.rotation.z = 0.22;
      pivot.add(ring);
      loadTextureSafe(planet.ring).then((ringTexture) => {
        if (ringTexture) {
          ring.material.map = ringTexture;
          ring.material.needsUpdate = true;
        }
      });
    }

    const orbit = new THREE.LineLoop(baseOrbit.clone(), orbitMat.clone());
    orbit.scale.set(planet.orbit, 1, planet.orbit * 0.82);
    orbit.rotation.x = THREE.MathUtils.degToRad(72);
    systemRoot.add(orbit);

    pivot.add(mesh);
    systemRoot.add(pivot);
    planets.push({ def: planet, pivot, mesh, atmosphere });

    loadTextureSafe(planet.texture).then((texture) => {
      if (texture) {
        material.map = texture;
        material.needsUpdate = true;
      }
    });
  });

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let targetRotX = -0.42;
  let targetRotY = 0.35;
  let currentRotX = targetRotX;
  let currentRotY = targetRotY;

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
    targetRotX = Math.max(-0.9, Math.min(0.08, targetRotX));
    startX = event.clientX;
    startY = event.clientY;
  };

  const onPointerUp = (event) => {
    dragging = false;
    mount.releasePointerCapture?.(event.pointerId);
  };

  mount.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  const resize = () => {
    const width = mount.clientWidth || 640;
    const height = mount.clientHeight || 520;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.set(0, width < 640 ? 170 : 210, width < 640 ? 520 : 620);
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const EARTH_YEAR_MS = 60000;
  const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

  loadTextureSafe("https://www.solarsystemscope.com/textures/download/2k_sun.jpg").then((texture) => {
    if (texture) {
      sun.material.map = texture;
      sun.material.needsUpdate = true;
    }
  });

  fallbackHost.classList.add("planetarium--webgl-ready");

  const animate = () => {
    const elapsed = Date.now() - EPOCH_MS;
    currentRotX += (targetRotX - currentRotX) * 0.06;
    currentRotY += (targetRotY - currentRotY) * 0.06;
    systemRoot.rotation.x = currentRotX;
    systemRoot.rotation.y = currentRotY;
    stars.rotation.y += 0.00008;
    sun.rotation.y += 0.0015;

    planets.forEach(({ def, pivot, mesh, atmosphere }) => {
      const cycleMs = EARTH_YEAR_MS * (def.periodDays / 365.26);
      const orbitT = ((elapsed % cycleMs) / cycleMs) * Math.PI * 2;
      pivot.rotation.y = orbitT;
      mesh.rotation.y += 0.008;
      atmosphere.rotation.y += 0.004;
    });

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();
}
