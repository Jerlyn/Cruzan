/* Crucian Heritage Archive — three.js hero visualization.
   Renders the glossary as a particle constellation: one point per dictionary
   word, colored by linguistic origin, arranged on a Fibonacci sphere. Click
   (or tap) a particle to reveal that word via the onSelect callback — this
   is a discovery mechanic, not just ambient decoration. Slow auto-rotation +
   mouse parallax. Falls back to a static caption if WebGL or three.js itself
   is unavailable, and skips motion for prefers-reduced-motion (click/tap
   selection still works in that mode). */

window.CrucianScene = (function () {
  let renderer, scene, camera, points, raf, canvas;
  let entriesRef = [];
  let targetRotX = 0, targetRotY = 0, curRotX = 0, curRotY = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const raycaster = new THREE.Raycaster ? new THREE.Raycaster() : null;
  if (raycaster) raycaster.params.Points = { threshold: 0.28 };
  const pointer = { x: 0, y: 0 };

  function fibonacciSphere(count, radius) {
    const pts = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2; // -1..1
      const r = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      pts.push([x * radius, y * radius, z * radius]);
    }
    return pts;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function setPointerFromEvent(e, rect) {
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickIndex() {
    if (!raycaster || !points) return -1;
    points.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(points);
    return hits.length ? hits[0].index : -1;
  }

  function init(containerId, entries, onSelect) {
    const container = document.getElementById(containerId);
    const fallback = document.getElementById("hero-scene-fallback");
    entriesRef = entries;
    if (!container || typeof THREE === "undefined") {
      if (fallback) fallback.style.display = "flex";
      return;
    }

    try {
      const width = container.clientWidth;
      const height = container.clientHeight;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
      camera.position.z = 13;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      canvas = renderer.domElement;
      container.appendChild(canvas);

      const count = Math.min(entries.length, 420);
      const sphere = fibonacciSphere(count, 5.2);

      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const [x, y, z] = sphere[i];
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        const [r, g, b] = hexToRgb(entries[i % entries.length].color);
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.22,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      points = new THREE.Points(geometry, material);
      scene.add(points);

      // faint core sphere = "St. Croix"
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(2, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x0d9488, transparent: true, opacity: 0.06 })
      );
      scene.add(core);

      if (!reducedMotion) {
        container.addEventListener("pointermove", (e) => {
          const rect = container.getBoundingClientRect();
          const nx = (e.clientX - rect.left) / rect.width - 0.5;
          const ny = (e.clientY - rect.top) / rect.height - 0.5;
          targetRotY = nx * 0.6;
          targetRotX = ny * 0.4;
        });
      }

      // Hover feedback: swap cursor when a particle is under the pointer.
      container.addEventListener("pointermove", (e) => {
        const rect = container.getBoundingClientRect();
        setPointerFromEvent(e, rect);
        const idx = pickIndex();
        canvas.classList.toggle("is-hoverable", idx !== -1);
      });

      // Click/tap a particle to surface that word; click empty space to dismiss.
      container.addEventListener("click", (e) => {
        const rect = container.getBoundingClientRect();
        setPointerFromEvent(e, rect);
        const idx = pickIndex();
        if (typeof onSelect === "function") {
          const entry = idx !== -1 ? entriesRef[idx % entriesRef.length] : null;
          onSelect(entry, e.clientX - rect.left, e.clientY - rect.top);
        }
      });

      const ro = new ResizeObserver(() => {
        const w = container.clientWidth, h = container.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      ro.observe(container);

      animate();
    } catch (err) {
      console.warn("CrucianScene failed to initialize:", err);
      if (fallback) fallback.style.display = "flex";
    }
  }

  function animate() {
    if (reducedMotion) {
      points.rotation.y = 0.4;
      renderer.render(scene, camera);
      return; // single static frame, no rAF loop (click-to-select still works)
    }
    raf = requestAnimationFrame(animate);
    curRotX += (targetRotX - curRotX) * 0.04;
    curRotY += (targetRotY - curRotY) * 0.04;
    points.rotation.y += 0.0022;
    points.rotation.x = curRotX * 0.3;
    points.rotation.y += curRotY * 0.0005;
    renderer.render(scene, camera);
  }

  function destroy() {
    if (raf) cancelAnimationFrame(raf);
    if (renderer) renderer.dispose();
  }

  return { init, destroy };
})();
