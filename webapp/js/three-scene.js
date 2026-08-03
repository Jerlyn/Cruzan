/* Crucian Heritage Archive — three.js hero visualization.
   Renders the glossary as a particle constellation: one point per dictionary
   word, colored by linguistic origin, arranged on a Fibonacci sphere. Slow
   auto-rotation + mouse parallax. Falls back to a static caption if WebGL
   or three.js itself is unavailable, and skips motion for
   prefers-reduced-motion. */

window.CrucianScene = (function () {
  let renderer, scene, camera, points, raf;
  let targetRotX = 0, targetRotY = 0, curRotX = 0, curRotY = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  function init(containerId, entries) {
    const container = document.getElementById(containerId);
    const fallback = document.getElementById("hero-scene-fallback");
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
      container.appendChild(renderer.domElement);

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
        size: 0.16,
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
      return; // single static frame, no rAF loop
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
