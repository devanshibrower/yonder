# MoonIndicator.tsx — Learning Document

## 1. Component Setup & Props

```tsx
interface MoonIndicatorProps {
  currentDay: number;
  yearProgress: number;
  opacity: number;
}
```

TypeScript `interface` defines the shape of data this component expects from its parent. This component receives:
- `currentDay` — which day of the year (1-365) to show the moon phase for
- `yearProgress` — how far through the year we are (0 to 1)
- `opacity` — how visible the whole component is (used for fade-in/out)

The parent component controls what the moon shows by passing different props.

---

## 2. Refs — Three Different Uses

```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);
const labelRef = useRef<HTMLDivElement>(null);
const stateRef = useRef({ day: currentDay, progress: yearProgress, frameCount: 0 });
const propsRef = useRef({ currentDay, yearProgress });
```

Refs have a key property: **they persist across re-renders without causing re-renders**. This component uses refs for three different purposes:

### DOM access (`canvasRef`, `labelRef`)
These grab actual DOM elements so we can draw on the canvas and update text directly. React normally controls the DOM, but canvas drawing requires direct access.

### Animation state (`stateRef`)
Stores the *current animated values* of day and progress. These change every frame (60 times per second). If these were `useState`, React would re-render the entire component 60 times per second — wasteful since we're drawing directly to canvas anyway. A ref lets us mutate values without triggering renders.

### Latest props bridge (`propsRef`)
```tsx
const propsRef = useRef({ currentDay, yearProgress });
propsRef.current = { currentDay, yearProgress };
```

This is a common pattern when combining React props with animation loops. The problem: `useEffect` with `[]` runs once and captures the initial props in a closure. If the parent passes new props later, the animation loop would still see the old values. By writing props into a ref on every render (line 29 runs on each render, outside useEffect), the animation loop can always read the latest values via `propsRef.current`.

---

## 3. Canvas HiDPI Setup

```tsx
const CSS_SIZE = 72;
const dpr = window.devicePixelRatio || 1;
canvas.width = CSS_SIZE * dpr;
canvas.height = CSS_SIZE * dpr;
canvas.style.width = CSS_SIZE + "px";
canvas.style.height = CSS_SIZE + "px";
```

Two sizes are being set independently:

- **`canvas.width` / `canvas.height`** — the internal pixel buffer. How many actual pixels the canvas has to draw with. On a 2x Retina display: `72 * 2 = 144` real pixels.
- **`canvas.style.width` / `canvas.style.height`** — the CSS display size. How big the canvas appears on screen: 72 CSS pixels.

The result: the canvas *appears* 72px but has 144 real pixels to work with on a 2x screen, so drawings are sharp instead of blurry.

Using a `CSS_SIZE` constant avoids the magic number `72` being repeated everywhere. If you wanted to resize the moon, you'd change one number.

---

## 4. setTransform — Coordinate Scaling

```tsx
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

The six arguments form a 2D transformation matrix:
```
setTransform(scaleX, skewY, skewX, scaleY, translateX, translateY)
```

This sets scale to `dpr` in both axes, no skew, no translation. After this, all drawing coordinates are automatically multiplied by `dpr`. So you write `arc(36, 36, ...)` thinking in 72px space, but on a 2x screen it actually draws at pixel 72,72 in the 144px buffer — hitting the right physical pixels.

This is called *inside* the draw function (not just once at setup) because `ctx.restore()` resets the transform. Each frame needs to re-apply it.

---

## 5. The Animation Loop

```tsx
let raf = 0;

const draw = () => {
  // ... drawing code ...
  raf = requestAnimationFrame(draw);
};

raf = requestAnimationFrame(draw);

return () => cancelAnimationFrame(raf);
```

### requestAnimationFrame
`requestAnimationFrame(callback)` tells the browser: "call this function before the next screen repaint." It runs at the display's refresh rate (usually 60fps). Unlike `setInterval`, it:
- Syncs with the monitor's refresh rate (no tearing)
- Automatically pauses when the tab is in the background (saves CPU/battery)
- Returns an ID you can use to cancel it

### The loop pattern
`draw` calls `requestAnimationFrame(draw)` at the end of each frame, creating a loop. Each call schedules the next frame.

### Cleanup
```tsx
return () => cancelAnimationFrame(raf);
```
`useEffect` can return a cleanup function. React calls it when the component unmounts. This stops the animation loop — without it, the loop would keep running after the component is removed from the page, leaking memory and CPU.

---

## 6. Lerp Smoothing (Animation Interpolation)

```tsx
state.day += (target.currentDay - state.day) * 0.15;
state.progress += (target.yearProgress - state.progress) * 0.1;
```

"Lerp" = linear interpolation. This creates smooth animated transitions.

How it works: each frame, move 15% (or 10%) of the remaining distance toward the target. When the gap is large, the step is large (fast movement). As you approach the target, the gap shrinks, so steps get smaller (gradual slowdown). This creates an "ease-out" feel.

Example with `0.15` factor, target = 100, starting at 0:
- Frame 1: `0 + (100 - 0) * 0.15 = 15`
- Frame 2: `15 + (100 - 15) * 0.15 = 27.75`
- Frame 3: `27.75 + (100 - 27.75) * 0.15 = 38.6`
- ... gradually approaches 100, never quite reaching it but getting imperceptibly close

The `0.15` vs `0.1` values control how fast each property catches up. Day changes faster (0.15) than progress (0.1), giving them slightly different animation feels.

---

## 7. Canvas Drawing Fundamentals

### save() and restore()
```tsx
ctx.save();
// ... modify transform, clip, styles ...
ctx.restore();
```
`save()` pushes the current canvas state (transform, clip region, styles) onto a stack. `restore()` pops it back. This lets you make temporary changes without affecting later drawing. The file has nested save/restore — one for the overall transform, one for the moon clipping region.

### clearRect
```tsx
ctx.clearRect(0, 0, CSS_SIZE, CSS_SIZE);
```
Erases everything on the canvas. Necessary because each animation frame redraws from scratch. Without it, frames would stack on top of each other.

### Paths and the beginPath/fill/stroke pattern
Canvas drawing follows a consistent pattern:
```tsx
ctx.beginPath();           // start a new shape
ctx.arc(x, y, r, 0, 2*PI); // define the shape
ctx.fillStyle = "color";   // set how to fill it
ctx.fill();                // actually draw it
```
`beginPath()` is important — without it, shapes accumulate and all get drawn together.

### arc() — Drawing circles
```tsx
ctx.arc(cx, cy, radius, startAngle, endAngle)
```
- `cx, cy` — center point
- `radius` — size
- `startAngle, endAngle` — in radians (not degrees)
- Full circle: `0` to `Math.PI * 2` (0 to 360 degrees)

---

## 8. The Year-Progress Ring

```tsx
// Faint background circle
ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
ctx.strokeStyle = "rgba(255,255,255,0.08)";
ctx.stroke();

// Progress arc from 12 o'clock
const startAngle = -Math.PI / 2;
const endAngle = startAngle + Math.PI * 2 * progress;
ctx.arc(cx, cy, ringR, startAngle, endAngle);
```

First draws a full faint circle as the "track." Then draws a brighter partial arc on top showing progress.

**Why `-Math.PI / 2`?** Canvas angles start at 3 o'clock (the rightmost point) and go clockwise. To start at 12 o'clock (top), you offset by -90 degrees, which is `-Math.PI / 2` radians.

**`Math.max(0, Math.min(1, progress))`** — clamps the value between 0 and 1. Defensive check so the arc never draws backwards or more than a full circle even if progress is slightly out of range.

### The position dot
```tsx
const dotX = cx + Math.cos(endAngle) * ringR;
const dotY = cy + Math.sin(endAngle) * ringR;
```
Uses trigonometry to find the x,y position at the end of the arc. `cos` gives the x offset and `sin` gives the y offset from center, multiplied by the radius. This places a small dot at the current progress point.

---

## 9. Moon Phase Rendering

### Clipping
```tsx
ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
ctx.clip();
```
`clip()` restricts all future drawing to inside this circle. Anything drawn outside is invisible. This means the terminator (shadow edge) and maria (dark spots) are automatically cropped to a circle — you don't need to calculate circle boundaries yourself.

### The terminator (shadow edge)
```tsx
const phaseAngle = phasePos * Math.PI * 2;
const terminatorX = Math.cos(phaseAngle);
```

`phasePos` goes from 0 (new moon) to 0.5 (full moon) to 1 (new moon again). `cos` of this mapped angle produces a value from 1 to -1 and back, which controls the width of an ellipse that forms the shadow edge.

The lit portion is drawn as a semicircle + ellipse:

```tsx
// Right semicircle (always the same shape)
ctx.arc(cx, cy, moonR, -Math.PI / 2, Math.PI / 2);
// Terminator ellipse (changes width with phase)
ctx.ellipse(cx, cy, moonR * Math.abs(terminatorX), moonR, 0, Math.PI / 2, -Math.PI / 2, terminatorX > 0);
```

The semicircle is one half. The ellipse draws the terminator boundary — its x-radius shrinks and grows with the phase. At full moon (`terminatorX = -1`), it's a full circle. At new moon (`terminatorX = 1`), the ellipse and semicircle cancel out (nothing lit). The boolean at the end controls whether the ellipse curves inward (crescent) or outward (gibbous).

### Waxing vs Waning
- **Waxing** (phasePos < 0.5): moon is growing, lit on the **right** side
- **Waning** (phasePos >= 0.5): moon is shrinking, lit on the **left** side

The code draws a right semicircle for waxing and a left semicircle for waning (using the `true` flag for counterclockwise in the arc call).

---

## 10. Visual Effects

### Radial gradients
```tsx
const litGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, moonR);
litGrad.addColorStop(0, "rgba(220,225,235,0.85)");
litGrad.addColorStop(0.7, "rgba(200,205,215,0.75)");
litGrad.addColorStop(1, "rgba(170,175,185,0.55)");
```

`createRadialGradient(x1,y1,r1, x2,y2,r2)` creates a gradient between two circles. Here both are centered on the moon — inner radius 0, outer radius `moonR`. `addColorStop` defines colors at positions from 0 (center) to 1 (edge). The moon is brighter in the center and darker at the edges.

### Halo
A larger, transparent radial gradient around the moon that simulates light scatter. Its opacity scales with `illumination` — a full moon has a visible halo, a new moon has none.

### Earthshine
```tsx
ctx.fillStyle = "rgba(80,90,110,0.12)";
```
A very faint fill on the entire moon disc. In reality, the dark side of the moon is faintly lit by light reflecting off Earth. This subtle blue-gray layer makes the dark portion not completely black.

### Maria (dark spots)
```tsx
const mariaSpots = [
  { x: -3, y: -4, r: 4.5 },
  { x: 4, y: -1, r: 3 },
  ...
];
```
"Maria" are the dark patches visible on the real moon (ancient lava plains). These are drawn as semi-transparent dark circles at fixed positions, giving the moon surface texture rather than being a flat disc.

### Limb darkening
```tsx
const limbGrad = ctx.createRadialGradient(cx, cy, moonR * 0.5, cx, cy, moonR);
limbGrad.addColorStop(0, "rgba(0,0,0,0)");
limbGrad.addColorStop(1, "rgba(0,0,0,0.3)");
```
The edges of the moon appear darker than the center in real life (light hits the surface at a steep angle near the edge). This gradient darkens the outer rim.

---

## 11. Performance: Throttled Text Updates

```tsx
if (state.frameCount % 6 === 0 && labelRef.current) {
  const phaseName = moonPhaseNameForDay(roundedDay);
  labelRef.current.textContent = `${phaseName} · ${illumPct}%`;
}
```

The animation runs at ~60fps, but updating DOM text that often is wasteful — the text doesn't change perceptibly between frames. `frameCount % 6 === 0` means the label updates every 6th frame (~10 times per second), which is plenty for readable text.

Using `labelRef.current.textContent` instead of React state avoids triggering React re-renders from inside the animation loop. This is direct DOM manipulation — normally avoided in React, but justified here for performance in a tight animation loop.

---

## 12. The Return JSX

```tsx
return (
  <div style={{ opacity, transition: "opacity 0.6s ease-out", ... }}>
    <canvas ref={canvasRef} />
    <div ref={labelRef} style={{ ... }} />
  </div>
);
```

The component's actual DOM is minimal — just a wrapper div, a canvas, and a text label. All the visual complexity lives in the canvas drawing code, not in React's component tree. The `opacity` prop with CSS transition means the parent can fade this component in/out smoothly.

---

## Key Concepts Summary

| Concept | Why it matters |
|---|---|
| `useRef` for animation state | Avoids re-renders on every frame |
| `propsRef` pattern | Bridges React props into animation loop closures |
| Canvas DPI scaling | Sharp rendering on Retina/HiDPI screens |
| `requestAnimationFrame` | Smooth, battery-efficient animation synced to display |
| Lerp smoothing | Natural-feeling transitions between values |
| `save()`/`restore()` | Isolate canvas state changes |
| `clip()` | Constrain drawing to a shape without manual boundary math |
| Cleanup return in useEffect | Prevent memory leaks when component unmounts |
| Direct DOM mutation for labels | Performance optimization inside animation loops |
