// Party-popper burst from both bottom corners of a container (the cart drawer on the storefront,
// the preview box here). Used by the dashboard's "Test the confetti" button; the storefront script
// (extensions/boostify-theme/assets/cart-progress.js) has its own copy.

export function blastConfetti(target, colors) {
  if (typeof document === "undefined" || !document.body.animate || !target)
    return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const r = target.getBoundingClientRect();
  if (r.width < 50 || r.height < 50) return;

  const palette = [
    ...(colors || []),
    "#f59e0b",
    "#ef4444",
    "#3b82f6",
    "#a855f7",
    "#ec4899",
    "#14b8a6",
    "#22c55e",
  ];
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  // Clipped to the container, exactly like inside the real cart drawer
  layer.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;pointer-events:none;overflow:hidden;z-index:2147483000;`;
  const w = r.width;
  const h = r.height;

  for (let i = 0; i < 80; i++) {
    const fromLeft = i % 2 === 0;
    const size = 6 + Math.random() * 6;
    const piece = document.createElement("div");
    piece.style.cssText = `position:absolute;display:block;width:${size}px;height:${
      size * (0.5 + Math.random() * 0.8)
    }px;background:${palette[i % palette.length]};border-radius:${
      Math.random() < 0.3 ? "50%" : "2px"
    };left:${fromLeft ? 0 : w - size}px;top:${h - size}px;opacity:0;`;
    layer.appendChild(piece);

    const angle =
      ((fromLeft ? 58 + Math.random() * 28 : 122 - Math.random() * 28) *
        Math.PI) /
      180;
    const speed = 0.5 * h + Math.random() * 0.5 * h;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const gravity = 1.8 * h;
    const spin = Math.random() * 720 - 360;
    const steps = 12;
    const frames = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      frames.push({
        transform: `translate(${(vx * t).toFixed(1)}px,${(
          -(vy * t) +
          0.5 * gravity * t * t
        ).toFixed(1)}px) rotate(${spin * t}deg)`,
        opacity: s === 0 ? 0 : s > steps - 2 ? 0 : 1,
        offset: t,
      });
    }
    piece.animate(frames, {
      duration: 1700 + Math.random() * 1000,
      delay: Math.random() * 150,
      easing: "cubic-bezier(.2,.7,.4,1)",
      fill: "forwards",
    });
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3300);
}
