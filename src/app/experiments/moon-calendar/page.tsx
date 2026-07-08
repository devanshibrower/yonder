"use client";

import { useState } from "react";
import {
  MoonCalendarSimple,
  MoonCalendarAccurate,
  moonInfo,
} from "@/components/ui/MoonCalendar";

// ---------------------------------------------------------------------------
// Flexible date parsing: accepts words or numbers in the common shapes:
//   "Jun 22"            "June 22, 2026"     "22 Jun"
//   "6/22"  "6/22/2026" "06-22-26"          "2026-06-22"
// A missing year falls back to the year already on screen.
// ---------------------------------------------------------------------------

const MONTH_TOKENS = ["jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec"];

const monthIndex = (token: string) =>
  MONTH_TOKENS.indexOf(token.toLowerCase().slice(0, 3));

// Build a Date, rejecting impossible ones (e.g. Feb 30 rolls over, so refuse).
function buildDate(year: number, monthIdx: number, day: number): Date | null {
  const date = new Date(year, monthIdx, day);
  if (date.getFullYear() !== year || date.getMonth() !== monthIdx || date.getDate() !== day) {
    return null;
  }
  return date;
}

const normalizeYear = (n: number) => (n < 100 ? 2000 + n : n);

function parseFlexibleDate(input: string, fallbackYear: number): Date | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  let m: RegExpMatchArray | null;

  // ISO: 2026-06-22
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    return buildDate(+m[1], +m[2] - 1, +m[3]);
  }
  // Numeric: 6/22, 6/22/2026, 06-22-26, 6.22
  if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/))) {
    return buildDate(m[3] ? normalizeYear(+m[3]) : fallbackYear, +m[1] - 1, +m[2]);
  }
  // Month name first: "jun 22", "june 22, 2026"
  if ((m = s.match(/^([a-z]{3,})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/))) {
    const mi = monthIndex(m[1]);
    if (mi >= 0) return buildDate(m[3] ? +m[3] : fallbackYear, mi, +m[2]);
  }
  // Day first: "22 jun", "22 june 2026"
  if ((m = s.match(/^(\d{1,2})\s+([a-z]{3,})\.?(?:,?\s+(\d{4}))?$/))) {
    const mi = monthIndex(m[2]);
    if (mi >= 0) return buildDate(m[3] ? +m[3] : fallbackYear, mi, +m[1]);
  }
  return null;
}

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function MoonCalendarPage() {
  const [date, setDate] = useState(() => new Date());

  // Text-input state: what's typed, whether we're editing, and parse errors.
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(false);

  const simple = moonInfo(date, "simple");
  const accurate = moonInfo(date, "accurate");

  const fullDate = date.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const commit = (value: string) => {
    const parsed = parseFlexibleDate(value, date.getFullYear());
    if (parsed) {
      setDate(parsed);
      setError(false);
      return true;
    }
    setError(true);
    return false;
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-zinc-950 px-6 py-16 text-zinc-200">
      <div className="flex flex-wrap items-start justify-center gap-16">
        <figure className="flex flex-col items-center gap-3">
          <MoonCalendarSimple date={date} size={260} onSelectDate={setDate} />
          <figcaption className="text-center">
            <p className="font-sans text-xs uppercase tracking-widest text-zinc-500">
              Simple · 29.53-day clock
            </p>
            <p className="mt-1 font-sans text-sm text-zinc-300">
              <span className="capitalize">{simple.phaseName}</span>
              <span className="text-zinc-600"> · </span>
              <span className="tabular-nums">{simple.litPercent}%</span>
            </p>
          </figcaption>
        </figure>

        <figure className="flex flex-col items-center gap-3">
          <MoonCalendarAccurate date={date} size={260} onSelectDate={setDate} />
          <figcaption className="text-center">
            <p className="font-sans text-xs uppercase tracking-widest text-zinc-500">
              Accurate · real orbit
            </p>
            <p className="mt-1 font-sans text-sm text-zinc-300">
              <span className="capitalize">{accurate.phaseName}</span>
              <span className="text-zinc-600"> · </span>
              <span className="tabular-nums">{accurate.litPercent}%</span>
            </p>
          </figcaption>
        </figure>
      </div>

      <div className="flex flex-col items-center gap-3">
        <p className="font-sans text-sm text-zinc-400">{fullDate}</p>
        <div className="flex items-end gap-2">
          <label className="flex flex-col items-center gap-1">
            <span className="font-sans text-xs uppercase tracking-widest text-zinc-500">
              Type any date
            </span>
            <input
              type="text"
              value={editing ? text : formatDate(date)}
              spellCheck={false}
              autoComplete="off"
              placeholder="Jun 22, 6/22, or 2026-06-22"
              onFocus={() => {
                setText(formatDate(date));
                setEditing(true);
                setError(false);
              }}
              onChange={(e) => {
                setText(e.target.value);
                setError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (commit(text)) {
                    setEditing(false);
                    e.currentTarget.blur();
                  }
                } else if (e.key === "Escape") {
                  setEditing(false);
                  setError(false);
                  e.currentTarget.blur();
                }
              }}
              onBlur={() => {
                if (editing) commit(text);
                setEditing(false);
              }}
              className={`w-56 rounded-md border bg-zinc-900 px-3 py-1.5 text-center font-mono text-sm outline-none transition-colors ${
                error
                  ? "border-red-500/70 text-red-400"
                  : "border-zinc-700 text-zinc-200 focus:border-zinc-500"
              }`}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setDate(new Date());
              setEditing(false);
              setError(false);
            }}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-sans text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
          >
            Today
          </button>
        </div>

        <p className="font-sans text-xs text-zinc-600">
          Hover the ring to read a date · click or arrow-key to pick one
        </p>
      </div>
    </main>
  );
}
