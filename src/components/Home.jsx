import { useEffect, useRef } from "react";

/**
 * DragonCursor
 * An SVG dragon: the head chases your cursor, and every body segment
 * follows the one in front of it (follow-the-leader / inverse kinematics lite).
 * No dependencies besides React.
 */

const SEGMENTS = 28;        // body length
const SEG_DIST = 16;        // distance between segments (px)
const HEAD_EASE = 0.12;     // how quickly the head chases the cursor (0-1)

export default function DragonCursor() {
  const svgRef = useRef(null);
  const bodyRef = useRef([]);   // <circle>/<path> refs for body parts
  const spineRef = useRef(null);
  const headRef = useRef(null);
  const wingL = useRef(null);
  const wingR = useRef(null);

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const mouse = { x: w / 2, y: h / 2 };
    const pts = Array.from({ length: SEGMENTS }, () => ({ x: w / 2, y: h / 2 }));
    let raf;
    let t = 0;

    const onMove = (e) => {
      const p = e.touches ? e.touches[0] : e;
      mouse.x = p.clientX;
      mouse.y = p.clientY;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tick = () => {
      t += 0.05;

      // 1) head eases toward the cursor
      const head = pts[0];
      head.x += (mouse.x - head.x) * HEAD_EASE;
      head.y += (mouse.y - head.y) * HEAD_EASE;

      // 2) each segment is pulled to stay SEG_DIST behind the previous one
      for (let i = 1; i < SEGMENTS; i++) {
        const prev = pts[i - 1];
        const cur = pts[i];
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        const d = Math.hypot(dx, dy) || 1;
        // small sine wiggle makes it swim instead of sliding stiffly
        const wiggle = reduce ? 0 : Math.sin(t * 2 - i * 0.5) * 0.6;
        cur.x = prev.x + (dx / d) * SEG_DIST - (dy / d) * wiggle;
        cur.y = prev.y + (dy / d) * SEG_DIST + (dx / d) * wiggle;
      }

      // 3) draw spine (smooth path through all points)
      const spine = spineRef.current;
      if (spine) {
        let dStr = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < SEGMENTS - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          dStr += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
        }
        spine.setAttribute("d", dStr);
      }

      // 4) scales / body discs, tapering toward the tail
      bodyRef.current.forEach((el, i) => {
        if (!el) return;
        const p = pts[i];
        const k = 1 - i / SEGMENTS;
        const r = 4 + k * 12;
        el.setAttribute("cx", p.x);
        el.setAttribute("cy", p.y);
        el.setAttribute("r", r);
      });

      // 5) head rotation (points toward its movement direction)
      const a = Math.atan2(pts[0].y - pts[2].y, pts[0].x - pts[2].x);
      const deg = (a * 180) / Math.PI;
      if (headRef.current) {
        headRef.current.setAttribute(
          "transform",
          `translate(${pts[0].x} ${pts[0].y}) rotate(${deg})`
        );
      }

      // 6) wings attached near the shoulders (segment 5), flapping
      const sh = pts[5];
      const sa = Math.atan2(pts[4].y - pts[6].y, pts[4].x - pts[6].x);
      const sdeg = (sa * 180) / Math.PI;
      const flap = reduce ? 0 : Math.sin(t * 3) * 14;
      if (wingL.current)
        wingL.current.setAttribute(
          "transform",
          `translate(${sh.x} ${sh.y}) rotate(${sdeg - 90 + flap})`
        );
      if (wingR.current)
        wingR.current.setAttribute(
          "transform",
          `translate(${sh.x} ${sh.y}) rotate(${sdeg + 90 - flap}) scale(1 -1)`
        );

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#10151c", cursor: "none", overflow: "hidden" }}>
      <svg ref={svgRef} width="100%" height="100%" style={{ display: "block" }}>
        <defs>
          <linearGradient id="scale" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2f9e6b" />
            <stop offset="1" stopColor="#0f5c46" />
          </linearGradient>
          <linearGradient id="wing" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c0392b" stopOpacity="0.9" />
            <stop offset="1" stopColor="#6e1b14" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {/* wings sit behind the body */}
        <g ref={wingL}>
          <path d="M0 0 C 10 -30, 50 -70, 90 -60 C 70 -45, 70 -30, 55 -22 C 45 -28, 35 -14, 0 0 Z" fill="url(#wing)" />
        </g>
        <g ref={wingR}>
          <path d="M0 0 C 10 -30, 50 -70, 90 -60 C 70 -45, 70 -30, 55 -22 C 45 -28, 35 -14, 0 0 Z" fill="url(#wing)" />
        </g>

        {/* spine line */}
        <path ref={spineRef} fill="none" stroke="#0a3d2e" strokeWidth="6" strokeLinecap="round" />

        {/* body discs, drawn tail -> head so the head ends up on top */}
        {Array.from({ length: SEGMENTS }, (_, i) => SEGMENTS - 1 - i).map((i) => (
          <circle
            key={i}
            ref={(el) => (bodyRef.current[i] = el)}
            fill="url(#scale)"
            stroke="#0a3d2e"
            strokeWidth="1.5"
          />
        ))}

        {/* head (local coords, faces +x) */}
        <g ref={headRef}>
          {/* horns */}
          <path d="M-4 -10 L-26 -26 L-10 -6 Z" fill="#e8d9a8" />
          <path d="M-4 10 L-26 26 L-10 6 Z" fill="#e8d9a8" />
          {/* skull + snout */}
          <path d="M-14 -13 C 0 -18, 20 -12, 34 -5 L34 5 C 20 12, 0 18, -14 13 Z" fill="#1f8059" stroke="#0a3d2e" strokeWidth="2" />
          {/* nostrils */}
          <circle cx="29" cy="-2.5" r="1.4" fill="#0a3d2e" />
          <circle cx="29" cy="2.5" r="1.4" fill="#0a3d2e" />
          {/* eyes */}
          <ellipse cx="8" cy="-8" rx="3.6" ry="2.6" fill="#ffd54a" />
          <ellipse cx="8" cy="8" rx="3.6" ry="2.6" fill="#ffd54a" />
          <circle cx="9" cy="-8" r="1.2" fill="#111" />
          <circle cx="9" cy="8" r="1.2" fill="#111" />
        </g>
      </svg>
    </div>
  );
}