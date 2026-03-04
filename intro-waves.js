(() => {
  const canvas = document.getElementById("waveCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });

  let w = 0, h = 0, dpr = 1;
  function resize(){
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  // Grid of points
  const spacing = 26;                    // كثافة النقاط
  const cols = Math.ceil(w / spacing) + 2;
  const rows = Math.ceil(h / spacing) + 2;

  // We'll rebuild points on resize (simple approach)
  let points = [];
  function buildPoints(){
    points = [];
    const c = Math.ceil(w / spacing) + 2;
    const r = Math.ceil(h / spacing) + 2;
    const ox = -spacing; // offset
    const oy = -spacing;

    for (let y = 0; y < r; y++){
      for (let x = 0; x < c; x++){
        const px = ox + x * spacing;
        const py = oy + y * spacing;
        points.push({
          x: px,
          y: py,
          bx: px,
          by: py,
          vx: 0,
          vy: 0,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
  }
  buildPoints();

  let pointer = { x: w * 0.5, y: h * 0.45, down: false, active: false };
  const ripple = { x: pointer.x, y: pointer.y, t: 0, strength: 0 };

  function setPointer(x, y){
    pointer.x = x;
    pointer.y = y;
    pointer.active = true;
    ripple.x = x;
    ripple.y = y;
    ripple.t = 0;
    ripple.strength = pointer.down ? 1.2 : 0.85;
  }

  window.addEventListener("mousemove", (e) => setPointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener("mousedown", () => { pointer.down = true; ripple.strength = 1.2; }, { passive: true });
  window.addEventListener("mouseup", () => { pointer.down = false; ripple.strength = 0.85; }, { passive: true });

  window.addEventListener("touchstart", (e) => {
    pointer.down = true;
    const t = e.touches[0];
    if (t) setPointer(t.clientX, t.clientY);
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (t) setPointer(t.clientX, t.clientY);
  }, { passive: true });

  window.addEventListener("touchend", () => { pointer.down = false; }, { passive: true });

  // Performance: pause when hidden
  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(loop);
  });

  function draw(){
    ctx.clearRect(0, 0, w, h);

    // Background glaze
    const g = ctx.createRadialGradient(pointer.x, pointer.y, 20, pointer.x, pointer.y, Math.max(w, h));
    g.addColorStop(0, "rgba(214,178,94,0.14)");
    g.addColorStop(0.35, "rgba(240,220,164,0.06)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    // Connections
    const maxLink = 46; // ربط نقاط قريبة
    ctx.lineWidth = 1;

    // update ripple time
    ripple.t += 0.04;

    for (let i = 0; i < points.length; i++){
      const p = points[i];

      // base subtle wave
      const wave = Math.sin(ripple.t + p.phase) * 0.15;

      // ripple around pointer
      const dx = p.bx - ripple.x;
      const dy = p.by - ripple.y;
      const dist = Math.hypot(dx, dy);

      // ripple ring effect
      const ring = Math.cos((dist * 0.12) - ripple.t * 3.0);
      const falloff = Math.exp(-dist * 0.02);
      const push = ring * falloff * (22 * ripple.strength);

      // soft attraction when pointer active
      const attract = pointer.active ? (Math.max(0, 120 - dist) / 120) : 0;

      // desired position
      const tx = p.bx + (dx / (dist || 1)) * push + wave;
      const ty = p.by + (dy / (dist || 1)) * push + wave;

      // spring physics to position
      const spring = 0.06 + attract * 0.02;
      p.vx += (tx - p.x) * spring;
      p.vy += (ty - p.y) * spring;

      // damping
      p.vx *= 0.88;
      p.vy *= 0.88;

      p.x += p.vx;
      p.y += p.vy;
    }

    // draw links (simple N^2 would be heavy; we do neighbor checks by grid-ish assumption)
    // We'll just link within a local window by checking the next few points
    ctx.strokeStyle = "rgba(240,220,164,0.10)";
    for (let i = 0; i < points.length; i++){
      const a = points[i];
      for (let j = i + 1; j < i + 14 && j < points.length; j++){
        const b = points[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < maxLink){
          const alpha = (1 - d / maxLink) * 0.22;
          ctx.strokeStyle = `rgba(240,220,164,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // draw points
    for (let i = 0; i < points.length; i++){
      const p = points[i];
      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const dist = Math.hypot(dx, dy);

      const glow = Math.max(0, 1 - dist / 220);
      const r = 1.15 + glow * 1.4;

      ctx.beginPath();
      ctx.fillStyle = `rgba(240,220,164,${0.35 + glow * 0.35})`;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // pointer halo
    if (pointer.active){
      const halo = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 120);
      halo.addColorStop(0, "rgba(240,220,164,0.20)");
      halo.addColorStop(1, "rgba(240,220,164,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, 120, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop(){
    if (!running) return;
    draw();
    requestAnimationFrame(loop);
  }
  loop();

  // rebuild points on resize (throttled)
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      buildPoints();
    }, 120);
  }, { passive: true });
})();