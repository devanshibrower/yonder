"use client";

import { useEffect, useRef } from "react";
import * as SunCalc from "suncalc";

// A horizontal "wave" timeline for picking a date. It draws the moon's
// illumination as a curve over a window of days (a month or a week), and you
// drag a marker along it to pick a day. Drag to the edge and hold, and the wave
// scrolls so you can slide across the whole year on one track.
//
// Controlled, like DateField: the parent owns the date. We show `value` and call
// `onChange` when the user picks a different day.
type MoonTimelineProps = {
  value: Date;
  onChange: (date: Date) => void;
};

const DAY = 86_400_000;
const HOUR = 3_600_000;
const TAU = Math.PI * 2;
const PAD = 18; // horizontal inset so the curve/marker clear the edges
const TOP = 22; // top inset
const CANVAS_H = 116;
const EDGE = 26; // px zone at each end that triggers auto-scroll
const STEP_MS = 48; // one day per this many ms while held at the edge
const WINDOW = 30; // days visible at once

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
// Real illumination from SunCalc (0 = new, 1 = full), not an approximation.
function illumAt(t: number) {
  return SunCalc.getMoonIllumination(new Date(t)).fraction;
}
function fmtChip(t: number) {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtMonthYear(t: number) {
  return new Date(t).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function fmtLong(t: number, today: number) {
  return t === today
    ? "Today"
    : new Date(t).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const TODAY = startOfDay(Date.now());

export function MoonTimeline({ value, onChange }: MoonTimelineProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Interaction and view state live in refs so the animation-frame loop and the
  // pointer handlers always read the latest values without stale closures.
  const selRef = useRef(startOfDay(value.getTime())); // selected day (local midnight)
  const viewStartRef = useRef(0); // index of the leftmost visible day within the year
  const hoverRef = useRef<number | null>(null);
  const widthRef = useRef(0);
  const winRef = useRef(WINDOW);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const ui = useRef({ dragging: false, scrollDir: 0, rafId: 0, lastTs: 0, acc: 0 });

  // Year bounds are derived from the selected day's year, so the timeline always
  // contains the current selection.
  const yearBounds = () => {
    const y = new Date(selRef.current).getFullYear();
    const start = startOfDay(new Date(y, 0, 1).getTime());
    const end = startOfDay(new Date(y, 11, 31).getTime());
    return { start, end, span: Math.round((end - start) / DAY) + 1 };
  };
  const idxOfDay = (t: number, start: number) => Math.round((startOfDay(t) - start) / DAY);

  const clampView = () => {
    const { span } = yearBounds();
    viewStartRef.current = Math.max(0, Math.min(span - winRef.current, viewStartRef.current));
  };
  const ensureVisible = () => {
    const { start } = yearBounds();
    const i = idxOfDay(selRef.current, start);
    if (i < viewStartRef.current) viewStartRef.current = i;
    else if (i > viewStartRef.current + winRef.current - 1) viewStartRef.current = i - winRef.current + 1;
    clampView();
  };

  // Push the current selection up to the parent. "Today" reports the current
  // time (so the moon is accurate right now); any other day reports its noon.
  const emit = () => {
    const out = selRef.current === TODAY ? new Date() : new Date(selRef.current + 12 * HOUR);
    onChangeRef.current(out);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = widthRef.current;
    const w = winRef.current;
    const { start, span } = yearBounds();
    const viewStart = viewStartRef.current;
    const sel = selRef.current;
    const hover = hoverRef.current;

    const base = CANVAS_H - 14;
    const amp = base - TOP;
    const ppd = (W - 2 * PAD) / (w - 1);
    const dayOfIdx = (i: number) => start + i * DAY;
    const xForIdx = (i: number) => PAD + (i - viewStart) * ppd;
    const tAtX = (x: number) => dayOfIdx(viewStart) + ((x - PAD) / ppd) * DAY;
    const yForT = (t: number) => base - illumAt(t) * amp;

    ctx.clearRect(0, 0, W, CANVAS_H);

    // quiet month context, top-left
    ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillText(fmtMonthYear(dayOfIdx(viewStart + Math.floor(w / 2))), PAD, 5);

    // soft fill under the curve
    const grad = ctx.createLinearGradient(0, TOP, 0, base);
    grad.addColorStop(0, "rgba(232,227,200,0.07)");
    grad.addColorStop(1, "rgba(232,227,200,0.004)");
    ctx.beginPath();
    ctx.moveTo(PAD, base);
    for (let x = PAD; x <= W - PAD; x += 2) ctx.lineTo(x, yForT(tAtX(x)));
    ctx.lineTo(W - PAD, base);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // the curve — quiet neutral line, not shouting
    ctx.beginPath();
    for (let x = PAD; x <= W - PAD; x += 2) {
      const y = yForT(tAtX(x));
      x === PAD ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(232,227,200,0.5)";
    ctx.lineWidth = 1.25;
    ctx.lineJoin = "round";
    ctx.stroke();

    // full / new moons as quiet dots (no labels) — the peaks and troughs already read
    for (let i = viewStart - 2; i <= viewStart + w + 1; i++) {
      if (i < 1 || i > span - 2) continue;
      const t = dayOfIdx(i) + 12 * HOUR;
      const f = illumAt(t);
      const fp = illumAt(t - DAY);
      const fn = illumAt(t + DAY);
      const full = f > fp && f >= fn && f > 0.9;
      const isNew = f < fp && f <= fn && f < 0.1;
      if (!full && !isNew) continue;
      const x = xForIdx(i);
      if (x < PAD + 3 || x > W - PAD - 3) continue;
      const y = yForT(t);
      if (full) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, TAU);
        ctx.fillStyle = "rgba(232,227,200,0.12)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, TAU);
        ctx.fillStyle = "rgba(243,241,231,0.85)";
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, TAU);
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fill();
      }
    }

    // today reference: a small dot on the baseline
    const ti = idxOfDay(TODAY, start);
    if (ti >= viewStart && ti <= viewStart + w - 1) {
      ctx.beginPath();
      ctx.arc(xForIdx(ti), base, 1.8, 0, TAU);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fill();
    }

    // hover preview
    if (hover !== null && hover !== sel) {
      const i = idxOfDay(hover, start);
      if (i >= viewStart && i <= viewStart + w - 1) {
        ctx.beginPath();
        ctx.arc(xForIdx(i), yForT(hover), 3.5, 0, TAU);
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
    }

    // selected marker — the only gold on the timeline: thin guide, dot, quiet date
    const si = idxOfDay(sel, start);
    if (si >= viewStart && si <= viewStart + w - 1) {
      const x = xForIdx(si);
      const y = yForT(sel);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.moveTo(x, TOP - 4);
      ctx.lineTo(x, base);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, TAU);
      ctx.fillStyle = "#e8c37a";
      ctx.fill();
      ctx.strokeStyle = "#0f1013";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const txt = fmtChip(sel);
      ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
      const half = ctx.measureText(txt).width / 2;
      const cx = Math.max(PAD + half, Math.min(W - PAD - half, x));
      ctx.fillStyle = "rgba(232,195,122,0.95)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(txt, cx, 4);
    }
  };

  // commit a day (local midnight), keep it in view, tell the parent, redraw
  const commit = (day: number) => {
    const { start, end } = yearBounds();
    selRef.current = Math.max(start, Math.min(end, day));
    ensureVisible();
    emit();
    draw();
  };
  const dayFromX = (px: number) => {
    const W = widthRef.current;
    const w = winRef.current;
    const { start, span } = yearBounds();
    const ppd = (W - 2 * PAD) / (w - 1);
    const i = Math.max(0, Math.min(span - 1, viewStartRef.current + Math.round((px - PAD) / ppd)));
    return start + i * DAY;
  };

  const autoScroll = (ts: number) => {
    const s = ui.current;
    if (!s.dragging || s.scrollDir === 0) {
      s.rafId = 0;
      return;
    }
    if (!s.lastTs) s.lastTs = ts;
    s.acc += ts - s.lastTs;
    s.lastTs = ts;
    const steps = Math.floor(s.acc / STEP_MS);
    if (steps > 0) {
      s.acc -= steps * STEP_MS;
      commit(selRef.current + s.scrollDir * steps * DAY);
    }
    s.rafId = requestAnimationFrame(autoScroll);
  };
  const startScroll = (dir: number) => {
    const s = ui.current;
    if (s.scrollDir === dir && s.rafId) return;
    s.scrollDir = dir;
    s.lastTs = 0;
    s.acc = 0;
    if (!s.rafId) s.rafId = requestAnimationFrame(autoScroll);
  };
  const stopScroll = () => {
    const s = ui.current;
    s.scrollDir = 0;
    if (s.rafId) {
      cancelAnimationFrame(s.rafId);
      s.rafId = 0;
    }
  };

  const localX = (clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return clientX - rect.left;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ui.current.dragging = true;
    hoverRef.current = null;
    commit(dayFromX(localX(e.clientX)));
    (e.currentTarget as HTMLElement).focus();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const px = localX(e.clientX);
    const W = widthRef.current;
    if (ui.current.dragging) {
      if (px > W - EDGE) {
        startScroll(1);
        commit(startOfDay(dayFromX(W - EDGE)));
      } else if (px < EDGE) {
        startScroll(-1);
        commit(startOfDay(dayFromX(EDGE)));
      } else {
        stopScroll();
        commit(dayFromX(px));
      }
    } else {
      const h = dayFromX(px);
      if (h !== hoverRef.current) {
        hoverRef.current = h;
        draw();
      }
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    ui.current.dragging = false;
    stopScroll();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };
  const onPointerLeave = () => {
    if (hoverRef.current !== null) {
      hoverRef.current = null;
      draw();
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    let ok = true;
    if (e.key === "ArrowRight") commit(selRef.current + DAY);
    else if (e.key === "ArrowLeft") commit(selRef.current - DAY);
    else if (e.key === "PageUp") commit(selRef.current + 7 * DAY);
    else if (e.key === "PageDown") commit(selRef.current - 7 * DAY);
    else if (e.key === "Home") commit(TODAY);
    else ok = false;
    if (ok) e.preventDefault();
  };

  // Size the backing store to the container (crisp on retina) and redraw.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const width = wrap.clientWidth;
      widthRef.current = width;
      canvas.style.height = `${CANVAS_H}px`;
      canvas.width = width * dpr;
      canvas.height = CANVAS_H * dpr;
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync to external changes to `value` (e.g. DateField editing the same date),
  // recenter the window on it, then redraw.
  useEffect(() => {
    const day = startOfDay(value.getTime());
    if (day !== selRef.current) {
      selRef.current = day;
    }
    const { start, span } = yearBounds();
    viewStartRef.current = Math.max(
      0,
      Math.min(span - WINDOW, idxOfDay(selRef.current, start) - Math.floor(WINDOW / 2)),
    );
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        ref={wrapRef}
        role="slider"
        tabIndex={0}
        aria-label="Pick a day in the year"
        aria-valuetext={fmtLong(startOfDay(value.getTime()), TODAY)}
        className="w-full cursor-grab touch-none outline-none focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-[#e8c37a] active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvasRef} className="block w-full" />
      </div>

      <button
        type="button"
        onClick={() => commit(TODAY)}
        className="rounded-full px-3 py-1 text-[13px] text-white/45 transition-colors hover:text-white/80"
      >
        Today
      </button>
    </div>
  );
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
