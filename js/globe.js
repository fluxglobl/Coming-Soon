/**
 * Spinning globe canvas + airplane animation (hero-right panel).
 * Requires: GSAP, MotionPathPlugin, Lucide (for plane icon).
 */
(function initNeuralPanel() {
  const stage = document.querySelector(".neural-stage");
  const canvas = document.getElementById("neuralCanvas");
  if (!stage || !canvas) return;

  const ctx = canvas.getContext("2d");
  let nodes = [];
  let startTime = Date.now();
  let lastFrameTime = Date.now();
  let spinDir = -1;
  let globeRotY = 0;
  let currentTimeline = null;
  let resizeTimeout = null;

  if (window.gsap && window.MotionPathPlugin) {
    gsap.registerPlugin(MotionPathPlugin);
  }

  function initIcons() {
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
  }

  function getRect() {
    return stage.getBoundingClientRect();
  }

  function getGlobeLayout() {
    const rect = getRect();
    const w = rect.width;
    const h = rect.height;
    const cx = w * 0.55;
    const cy = h * (w < 640 ? 0.36 : 0.40);
    const radius = Math.min(w, h) * (w < 640 ? 0.44 : 0.40);
    return { w, h, cx, cy, radius };
  }

  function resizeCanvas() {
    const rect = getRect();
    const w = rect.width;
    const h = rect.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initNodes();
    positionAfricaOutline();
    positionNorthAmericaOutline();
    restartAirplaneSoon();
  }

  class Node {
    constructor(x, y, label) {
      this.x = x;
      this.y = y;
      this.baseX = x;
      this.baseY = y;
      this.label = label;
      this.opacity = 0;
      this.radius = 4;
    }

    update() {
      this.x = this.baseX;
      this.y = this.baseY;
      if (this.opacity < 1) this.opacity += 0.02;
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.opacity;

      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.radius * 3
      );
      gradient.addColorStop(0, "rgba(17, 25, 40, 0.3)");
      gradient.addColorStop(1, "rgba(17, 25, 40, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#111928";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      if (this.label && window.innerWidth > 640) {
        ctx.fillStyle = "#6B7280";
        ctx.font = "11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(this.label, this.x, this.y + 20);
      }

      ctx.restore();
    }
  }

  const regions = [
    { label: "North America", x: 0.2, y: 0.2 },
    { label: "Europe", x: 0.5, y: 0.15 },
    { label: "Asia", x: 0.75, y: 0.25 },
    { label: "South America", x: 0.25, y: 0.5 },
    { label: "Africa", x: 0.5, y: 0.45 },
    { label: "Australia", x: 0.8, y: 0.55 },
    { label: "Middle East", x: 0.6, y: 0.32 },
  ];

  function getNetworkOffsetX(w) {
    return Math.round(w * 0.10);
  }

  function initNodes() {
    const { w, h, cx, cy, radius } = getGlobeLayout();
    const offsetX = getNetworkOffsetX(w);

    nodes = regions.map((region) => {
      if (region.label === "North America") {
        return new Node(cx - radius * 0.46, cy - radius * 0.30, region.label);
      }
      if (region.label === "Africa") {
        return new Node(cx + radius * 0.26, cy + radius * 0.22, region.label);
      }
      return new Node(w * region.x + offsetX, h * region.y, region.label);
    });
  }

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const OUTLINE_VIEWBOX_SIZE = 1024;
  const outlinePointCache = new Map();

  function parsePathDToPoints(d, step = 6) {
    if (!d) return [];
    const tokens = d.match(/[MLZ]|-?\d+(?:\.\d+)?/g) || [];
    const pts = [];
    let i = 0;
    let cmd = null;

    while (i < tokens.length) {
      const t = tokens[i++];
      if (t === "M" || t === "L" || t === "Z") {
        cmd = t;
        continue;
      }
      if (cmd === "M" || cmd === "L") {
        const x = Number(t);
        const y = Number(tokens[i++]);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          pts.push({
            x: x / OUTLINE_VIEWBOX_SIZE - 0.5,
            y: y / OUTLINE_VIEWBOX_SIZE - 0.5,
          });
        }
      }
    }

    if (pts.length <= 2) return pts;
    if (step <= 1) return pts;
    const decimated = [];
    for (let j = 0; j < pts.length; j += step) decimated.push(pts[j]);
    if (decimated[decimated.length - 1] !== pts[pts.length - 1]) decimated.push(pts[pts.length - 1]);
    return decimated;
  }

  function getOutlinePointsCached(pathElId, step = 6) {
    const key = `${pathElId}:${step}`;
    const cached = outlinePointCache.get(key);
    if (cached) return cached;
    const el = document.getElementById(pathElId);
    const d = el?.getAttribute("d") || "";
    const pts = parsePathDToPoints(d, step);
    outlinePointCache.set(key, pts);
    return pts;
  }

  function vecFromLatLon(latDeg, lonDeg) {
    const lat = latDeg * DEG;
    const lon = lonDeg * DEG;
    const cl = Math.cos(lat);
    return { x: cl * Math.cos(lon), y: Math.sin(lat), z: cl * Math.sin(lon) };
  }

  function slerp(a, b, t) {
    const dot = clamp(a.x * b.x + a.y * b.y + a.z * b.z, -1, 1);
    const omega = Math.acos(dot);
    if (omega < 1e-6) return { x: a.x, y: a.y, z: a.z };
    const s = Math.sin(omega);
    const s1 = Math.sin((1 - t) * omega) / s;
    const s2 = Math.sin(t * omega) / s;
    return { x: a.x * s1 + b.x * s2, y: a.y * s1 + b.y * s2, z: a.z * s1 + b.z * s2 };
  }

  function rotateX(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
  }

  function rotateY(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
  }

  function projectToScreen(p, cx, cy, radius) {
    const depth = 2.4;
    const k = depth / (depth - p.z);
    return { x: cx + p.x * radius * k, y: cy - p.y * radius * k, k };
  }

  function inverseProjectToSphere(sx, sy, cx, cy, radius) {
    const depth = 2.4;
    let dx = (sx - cx) / radius;
    let dy = (cy - sy) / radius;

    const A0 = dx * dx + dy * dy;
    if (A0 > 0.98) {
      const scale = Math.sqrt(0.98 / A0);
      dx *= scale;
      dy *= scale;
    }

    const A = dx * dx + dy * dy;
    const d2 = depth * depth;
    const denom = A + d2;
    const inner = d2 * d2 - denom * (d2 - 1);
    if (inner < 0) return null;

    const t = (d2 - Math.sqrt(inner)) / denom;
    const p = { x: dx * t, y: dy * t, z: depth * (1 - t) };
    const n = Math.hypot(p.x, p.y, p.z) || 1;
    return { x: p.x / n, y: p.y / n, z: p.z / n };
  }

  function vecToLatLon(v) {
    const lat = Math.asin(clamp(v.y, -1, 1)) / DEG;
    const lon = Math.atan2(v.z, v.x) / DEG;
    return { lat, lon };
  }

  function getAnchorLatLonFromNode(label, cx, cy, radius, rotX, rotY) {
    const pos = getNodePosition(label);
    if (!pos || (!pos.x && !pos.y)) return null;
    const pView = inverseProjectToSphere(pos.x, pos.y, cx, cy, radius);
    if (!pView) return null;
    const p = rotateX(rotateY(pView, -rotY), -rotX);
    return vecToLatLon(p);
  }

  const globePoints = (() => {
    const pts = [];
    const count = 1200;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const a = golden * i;
      pts.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
    }
    return pts;
  })();

  const arcPairs = [
    [vecFromLatLon(40, -100), vecFromLatLon(7, 0)],
    [vecFromLatLon(52, 10), vecFromLatLon(35, 105)],
    [vecFromLatLon(25, 45), vecFromLatLon(-25, 135)],
  ];

  function drawGlobe(timeMs) {
    const { cx, cy, radius } = getGlobeLayout();
    const rotY = globeRotY;
    const rotX = -0.38;

    ctx.save();

    const sphere = ctx.createRadialGradient(
      cx - radius * 0.35, cy - radius * 0.35, radius * 0.1,
      cx, cy, radius * 1.05
    );
    sphere.addColorStop(0, "rgba(17, 25, 40, 0.10)");
    sphere.addColorStop(0.55, "rgba(11, 18, 32, 0.06)");
    sphere.addColorStop(1, "rgba(17, 25, 40, 0.02)");
    ctx.fillStyle = sphere;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(17, 25, 40, 0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.stroke();

    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 4) {
        let p = vecFromLatLon(lat, lon);
        p = rotateY(rotateX(p, rotX), rotY);
        const a = clamp((p.z + 0.25) / 1.25, 0, 1) * 0.12;
        if (a <= 0.001) continue;
        const s = projectToScreen(p, cx, cy, radius);
        if (!started) {
          ctx.strokeStyle = `rgba(35, 45, 60, ${a})`;
          ctx.moveTo(s.x, s.y);
          started = true;
        } else {
          ctx.lineTo(s.x, s.y);
        }
      }
      if (started) ctx.stroke();
    }

    for (let lon = -150; lon <= 180; lon += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -90; lat <= 90; lat += 4) {
        let p = vecFromLatLon(lat, lon);
        p = rotateY(rotateX(p, rotX), rotY);
        const a = clamp((p.z + 0.25) / 1.25, 0, 1) * 0.10;
        if (a <= 0.001) continue;
        const s = projectToScreen(p, cx, cy, radius);
        if (!started) {
          ctx.strokeStyle = `rgba(45, 55, 72, ${a})`;
          ctx.moveTo(s.x, s.y);
          started = true;
        } else {
          ctx.lineTo(s.x, s.y);
        }
      }
      if (started) ctx.stroke();
    }

    (function drawProjectedOutlines() {
      const africaPts = getOutlinePointsCached("africaOutlinePath", 7);
      const naPts = getOutlinePointsCached("northAmericaOutlinePath", 6);
      const naAnchor = getAnchorLatLonFromNode("North America", cx, cy, radius, rotX, rotY);
      const africaAnchor = getAnchorLatLonFromNode("Africa", cx, cy, radius, rotX, rotY);
      const centroid = (pts) => {
        if (!pts || pts.length === 0) return { x: 0, y: 0 };
        let sx = 0, sy = 0;
        for (const p of pts) { sx += p.x; sy += p.y; }
        return { x: sx / pts.length, y: sy / pts.length };
      };
      const naCenter = centroid(naPts);
      const AFRICA_ANCHOR_OFFSET = { x: -9.7, y: -0.1 };
      const africaCentroid = centroid(africaPts);
      const africaCenter = { x: africaCentroid.x + AFRICA_ANCHOR_OFFSET.x, y: africaCentroid.y + AFRICA_ANCHOR_OFFSET.y };

      function drawOutline(normPts, { baseLat, baseLon, latSpan, lonSpan, alphaScale, center }) {
        if (!normPts || normPts.length < 2) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, TAU);
        ctx.clip();

        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        for (let i = 1; i < normPts.length; i++) {
          const a = normPts[i - 1];
          const b = normPts[i];

          const cxn = center?.x ?? 0;
          const cyn = center?.y ?? 0;
          const ax = -(a.x - cxn);
          const ay = -(a.y - cyn);
          const bx = -(b.x - cxn);
          const by = -(b.y - cyn);
          let pa = vecFromLatLon(baseLat + ay * latSpan, baseLon + ax * lonSpan);
          let pb = vecFromLatLon(baseLat + by * latSpan, baseLon + bx * lonSpan);

          pa = rotateY(rotateX(pa, rotX), rotY);
          pb = rotateY(rotateX(pb, rotX), rotY);

          if (pa.z < -0.02 && pb.z < -0.02) continue;
          const horizonFade = clamp((Math.min(pa.z, pb.z) + 0.12) / 0.24, 0, 1);
          const frontness = clamp((Math.max(pa.z, pb.z) + 1) / 2, 0, 1);
          const alpha = alphaScale * horizonFade * (0.35 + 0.65 * frontness);
          if (alpha <= 0.002) continue;

          const sa = projectToScreen(pa, cx, cy, radius);
          const sb = projectToScreen(pb, cx, cy, radius);

          ctx.strokeStyle = `rgba(45, 55, 72, ${alpha})`;
          ctx.lineWidth = Math.max(1, radius * 0.010) * ((sa.k + sb.k) / 2);
          ctx.beginPath();
          ctx.moveTo(sa.x, sa.y);
          ctx.lineTo(sb.x, sb.y);
          ctx.stroke();
        }

        ctx.restore();
      }

      if (naAnchor) {
        drawOutline(naPts, { baseLat: naAnchor.lat, baseLon: naAnchor.lon, latSpan: 30, lonSpan: 34, alphaScale: 0.55, center: naCenter });
      }
      if (africaAnchor) {
        drawOutline(africaPts, { baseLat: africaAnchor.lat, baseLon: africaAnchor.lon, latSpan: 34, lonSpan: 38, alphaScale: 0.50, center: africaCenter });
      }
    })();

    for (const [a0, b0] of arcPairs) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 64; i++) {
        const t = i / 64;
        let p = slerp(a0, b0, t);
        const lift = 1.02 + 0.10 * Math.sin(Math.PI * t);
        p = { x: p.x * lift, y: p.y * lift, z: p.z * lift };
        p = rotateY(rotateX(p, rotX), rotY);
        const a = clamp((p.z + 0.15) / 1.15, 0, 1) * 0.35;
        if (a <= 0.001) continue;
        const s = projectToScreen(p, cx, cy, radius);
        if (!started) {
          ctx.strokeStyle = `rgba(28, 38, 52, ${a})`;
          ctx.lineWidth = 1.5;
          ctx.moveTo(s.x, s.y);
          started = true;
        } else {
          ctx.lineTo(s.x, s.y);
        }
      }
      if (started) ctx.stroke();
    }

    for (let i = 0; i < globePoints.length; i++) {
      let p = globePoints[i];
      p = rotateY(rotateX(p, rotX), rotY);
      const front = clamp((p.z + 1) / 2, 0, 1);
      const alpha = 0.03 + front * 0.16;
      const s = projectToScreen(p, cx, cy, radius);
      const r = 0.7 + front * 0.9;
      ctx.fillStyle = `rgba(45, 55, 72, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  function animate() {
    const rect = getRect();
    const now = Date.now();
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    globeRotY += dt * 0.00018 * spinDir;

    ctx.clearRect(0, 0, rect.width, rect.height);
    drawGlobe(now - startTime);
    nodes.forEach((node) => {
      node.update(now - startTime);
    });

    requestAnimationFrame(animate);
  }

  function getNodePosition(label) {
    const node = nodes.find((n) => n.label === label);
    return node ? { x: node.baseX, y: node.baseY } : { x: 0, y: 0 };
  }

  function positionAfricaOutline() {
    const africaEl = document.getElementById("africaOutline");
    if (!africaEl) return;
    const { cx, cy, radius } = getGlobeLayout();
    const africaPos = { x: cx - radius * 0.42, y: cy + radius * 0.32 };

    const size = Math.max(140, Math.min(320, Math.round(radius * 0.85)));
    africaEl.style.width = `${size}px`;
    africaEl.style.height = `${size}px`;
    const offsetX = Math.round(size * 0.21);
    const offsetY = Math.round(size * 0.10);
    africaEl.style.left = `${africaPos.x + offsetX}px`;
    africaEl.style.top = `${africaPos.y + offsetY}px`;
  }

  function positionNorthAmericaOutline() {
    const naEl = document.getElementById("northAmericaOutline");
    if (!naEl) return;
    const { cx, cy, radius } = getGlobeLayout();
    const naPos = { x: cx - radius * 0.46, y: cy - radius * 0.30 };

    const size = Math.max(170, Math.min(380, Math.round(radius * 0.95)));
    naEl.style.width = `${size}px`;
    naEl.style.height = `${size}px`;

    const offsetX = Math.round(size * 0.08);
    const offsetY = Math.round(size * 0.10);
    naEl.style.left = `${Math.round(naPos.x + offsetX)}px`;
    naEl.style.top = `${Math.round(naPos.y + offsetY)}px`;
  }

  function getControlPoints(startPos, endPos) {
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const arcOffset = distance * 0.05;
    const perpX = dy / distance;
    const perpY = -dx / distance;
    const cp1 = {
      x: startPos.x + dx * 0.33 + perpX * arcOffset * 0.5,
      y: startPos.y + dy * 0.33 + perpY * arcOffset * 0.5,
    };
    const cp2 = {
      x: startPos.x + dx * 0.67 + perpX * arcOffset * 0.5,
      y: startPos.y + dy * 0.67 + perpY * arcOffset * 0.5,
    };
    return { cp1, cp2 };
  }

  function animateAirplane() {
    if (!window.gsap || !window.MotionPathPlugin) return;
    const airplaneEl = document.getElementById("airplane");
    if (!airplaneEl) return;

    if (currentTimeline) currentTimeline.kill();

    const startPos = getNodePosition("North America");
    const endPos = getNodePosition("Africa");
    const { cp1: f1, cp2: f2 } = getControlPoints(startPos, endPos);
    const { cp1: b1, cp2: b2 } = getControlPoints(endPos, startPos);

    currentTimeline = gsap.timeline({ repeat: -1, repeatDelay: 0.5, repeatRefresh: true });

    currentTimeline
      .set(airplaneEl, {
        x: startPos.x,
        y: startPos.y,
        rotation: 0,
        opacity: 0,
        scale: 0.8,
        xPercent: -50,
        yPercent: -50,
      })
      .to(airplaneEl, {
        opacity: 1,
        scale: 1,
        duration: 0.8,
        ease: "power2.out",
      })
      .to(
        airplaneEl,
        {
          motionPath: {
            path: [
              { x: startPos.x, y: startPos.y },
              { x: f1.x, y: f1.y },
              { x: f2.x, y: f2.y },
              { x: endPos.x, y: endPos.y },
            ],
            type: "cubic",
            autoRotate: 65,
            alignOrigin: [0.5, 0.5],
          },
          duration: 7,
          ease: "power1.inOut",
        },
        "-=0.4"
      )
      .set(airplaneEl, { x: endPos.x, y: endPos.y })
      .call(() => { spinDir = 1; })
      .to(airplaneEl, {
        motionPath: {
          path: [
            { x: endPos.x, y: endPos.y },
            { x: b1.x, y: b1.y },
            { x: b2.x, y: b2.y },
            { x: startPos.x, y: startPos.y },
          ],
          type: "cubic",
          autoRotate: 65,
          alignOrigin: [0.5, 0.5],
        },
        duration: 7,
        ease: "power1.inOut",
      })
      .set(airplaneEl, { x: startPos.x, y: startPos.y })
      .call(() => { spinDir = -1; })
      .to(airplaneEl, { opacity: 0.85, scale: 0.95, duration: 0.35, ease: "power2.out" }, "-=0.2");
  }

  function restartAirplaneSoon() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      initIcons();
      animateAirplane();
    }, 200);
  }

  window.addEventListener("resize", resizeCanvas);

  initIcons();
  resizeCanvas();
  animate();

  window.addEventListener("load", () => {
    setTimeout(() => {
      positionAfricaOutline();
      positionNorthAmericaOutline();
      animateAirplane();
    }, 120);
  });
})();
