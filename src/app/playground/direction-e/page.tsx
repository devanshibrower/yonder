"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import ScrollDrivenCanvas from "@/components/ui/ScrollDrivenCanvas";
import {
  ALL_SHOWERS,
  buildYearConfigs,
  monthName,
} from "@/lib/playground-utils";
import { MeteorShower } from "@/data/types";

// --- Narratives ---

const SHOWER_NARRATIVES: Record<string, string> = {
  quadrantids:
    "Look northeast after midnight. Medium-speed streaks from the remains of an extinct comet, often bright and sharply defined. A nearly full moon will wash out fainter meteors, but the brief six-hour peak can still produce up to 120 per hour for the brightest streaks.",
  lyrids:
    "Face east after midnight near the bright star Vega. A modest but reliable shower with occasional fireballs. The crescent moon sets before midnight, leaving dark skies for up to 18 per hour.",
  "eta-aquariids":
    "Set your alarm for the hours before dawn. Fast meteors with long persistent trains, debris from Halley's Comet itself. The nearly full moon will wash out fainter streaks, but the brightest ones cut right through the glow.",
  "alpha-capricornids":
    "A gentle shower best known for bright, slow fireballs. Only a handful per hour, but they tend to be vivid. The full moon will challenge most observers this year.",
  "southern-delta-aquariids":
    "Best seen from the southern hemisphere before dawn. Medium-speed faint meteors that struggle against the full moon. Watch for the occasional bright streak breaking through.",
  perseids:
    "Face northeast on a warm August night. Swift bright streaks with colorful trains, courtesy of Comet Swift-Tuttle. A new moon means perfect darkness. Count up to 100 per hour at the peak.",
  orionids:
    "Look east after midnight as Orion rises. Another gift from Halley's Comet, fast meteors with persistent trains. A bright gibbous moon makes this a year to focus on the boldest streaks.",
  "southern-taurids":
    "Slow, lazy fireballs drifting from the direction of Taurus. Only a few per hour, but their brightness makes up for it. A thin crescent moon keeps the sky dark.",
  "northern-taurids":
    "The Northern Taurids overlap with their southern sibling, doubling the chance of a bright fireball. Just a handful per hour, but conditions are nearly ideal with a sliver of moon.",
  leonids:
    "Look east after midnight as Leo rises. The fastest meteors of the year, bright and knife-thin, sometimes leaving green afterglows. A half-moon sets around midnight, leaving a modest 15 per hour in dark skies.",
  geminids:
    "Step outside before midnight. This shower starts early. Medium-speed meteors in white, yellow, and green from the unusual asteroid Phaethon. A slim crescent moon won't interfere with the year's richest display at 150 per hour.",
  ursids:
    "A quiet shower near the winter solstice. Look toward the north star for medium-speed meteors. The nearly full moon drowns out all but the brightest, leaving perhaps 10 per hour.",
};

// --- Layout constants (in vh units) ---

const OPENING_H = 1;         // 100vh
const CLOSING_H = 0.8;       // 80vh
const GAP_H = 0.4;           // 40vh
const SHOWER_SECTION_H = 1.2; // 120vh
const SPACER_BUDGET = 3;     // 300vh total for all spacers (sqrt-distributed)

// --- Helpers ---

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function showerPeakDay(shower: MeteorShower): number {
  let doy = shower.peak.dayOfMonth;
  for (let m = 1; m < shower.peak.month; m++) doy += DAYS_IN_MONTH[m];
  return doy;
}

// Short month names for timeline
const SHORT_MONTHS = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// --- Segment-based scroll-to-day mapping ---

interface Segment {
  scrollStart: number; // in px
  scrollEnd: number;   // in px
  dayStart: number;    // 1-365
  dayEnd: number;      // 1-365
}

function buildSegments(
  showers: MeteorShower[],
  spacerHeights: number[],
  vh: number
): Segment[] {
  const segments: Segment[] = [];
  if (vh === 0) return segments;

  // Opening section + gap before year
  const preYearPx = (OPENING_H + GAP_H) * vh;
  let cursor = preYearPx; // scroll position where year content begins

  for (let i = 0; i < showers.length; i++) {
    const peakDay = showerPeakDay(showers[i]);

    // Spacer before this shower
    if (spacerHeights[i] > 0) {
      const spacerPx = spacerHeights[i] * vh;
      const prevPeakDay = i === 0 ? 1 : showerPeakDay(showers[i - 1]);
      segments.push({
        scrollStart: cursor,
        scrollEnd: cursor + spacerPx,
        dayStart: prevPeakDay,
        dayEnd: peakDay,
      });
      cursor += spacerPx;
    }

    // Shower section: covers peak +/- 2 days (4 days over 150vh)
    const sectionPx = SHOWER_SECTION_H * vh;
    segments.push({
      scrollStart: cursor,
      scrollEnd: cursor + sectionPx,
      dayStart: Math.max(1, peakDay - 2),
      dayEnd: Math.min(365, peakDay + 2),
    });
    cursor += sectionPx;
  }

  // Final spacer after last shower to Dec 31
  const lastPeak = showerPeakDay(showers[showers.length - 1]);
  if (lastPeak < 365) {
    const finalSpacerPx = spacerHeights[showers.length] * vh;
    if (finalSpacerPx > 0) {
      segments.push({
        scrollStart: cursor,
        scrollEnd: cursor + finalSpacerPx,
        dayStart: lastPeak,
        dayEnd: 365,
      });
    }
  }

  return segments;
}

function scrollYToDay(scrollY: number, vh: number, segments: Segment[]): number {
  if (segments.length === 0 || vh === 0) return 1;

  // Before first segment: Jan 1
  if (scrollY <= segments[0].scrollStart) return 1;

  // After last segment: Dec 31
  const last = segments[segments.length - 1];
  if (scrollY >= last.scrollEnd) return 365;

  // Find segment
  for (const seg of segments) {
    if (scrollY >= seg.scrollStart && scrollY < seg.scrollEnd) {
      const t = (scrollY - seg.scrollStart) / (seg.scrollEnd - seg.scrollStart);
      return Math.round(seg.dayStart + (seg.dayEnd - seg.dayStart) * t);
    }
  }

  return 1;
}

// --- Page component ---

export default function DirectionEPage() {
  const [scrollY, setScrollY] = useState(0);
  const [vh, setVh] = useState(0);

  // Sort showers by peak date
  const chronologicalShowers = useMemo(
    () =>
      [...ALL_SHOWERS].sort((a, b) =>
        a.peak.month !== b.peak.month
          ? a.peak.month - b.peak.month
          : a.peak.dayOfMonth - b.peak.dayOfMonth
      ),
    []
  );

  // Build 365 daily configs
  const yearConfigs = useMemo(
    () => buildYearConfigs(ALL_SHOWERS),
    []
  );

  // Compute spacer heights using sqrt scaling to compress large gaps
  const spacerHeights = useMemo(() => {
    const peakDays = chronologicalShowers.map(showerPeakDay);
    // Gap days: before first shower (from day 1), between consecutive, after last (to day 365)
    const gapDays: number[] = [];
    gapDays.push(peakDays[0] - 1); // Jan 1 to first peak
    for (let i = 1; i < peakDays.length; i++) {
      gapDays.push(Math.max(0, peakDays[i] - peakDays[i - 1]));
    }
    gapDays.push(Math.max(0, 365 - peakDays[peakDays.length - 1])); // last peak to Dec 31

    // Sqrt scaling: compresses large gaps while keeping small gaps visible
    const sqrtDays = gapDays.map((d) => Math.sqrt(d));
    const totalSqrt = sqrtDays.reduce((a, b) => a + b, 0);
    if (totalSqrt === 0) return gapDays.map(() => 0);
    return sqrtDays.map((s) => (s / totalSqrt) * SPACER_BUDGET);
  }, [chronologicalShowers]);

  // Build segments for scroll-to-day mapping
  const segments = useMemo(
    () => buildSegments(chronologicalShowers, spacerHeights, vh),
    [chronologicalShowers, spacerHeights, vh]
  );

  useEffect(() => {
    const updateVh = () => setVh(window.innerHeight);
    updateVh();
    window.addEventListener("resize", updateVh);

    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", updateVh);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Current day-of-year from scroll position
  const currentDay = scrollYToDay(scrollY, vh, segments);

  // scrollProgress: 0-indexed into the 365-config array
  const scrollProgress = Math.max(0, Math.min(364, currentDay - 1));

  // Opening overlay: black -> transparent
  const openingProgress = vh > 0 ? Math.min(1, scrollY / (OPENING_H * vh)) : 0;
  const openingOpacity = 1 - openingProgress;

  // Closing: compute total scroll height, then fade in
  const totalYearContent = spacerHeights.reduce((a, b) => a + b, 0) +
    chronologicalShowers.length * SHOWER_SECTION_H;
  const closingStart = (OPENING_H + GAP_H + totalYearContent + GAP_H) * vh;
  const closingProgress = vh > 0
    ? Math.max(0, Math.min(1, (scrollY - closingStart) / (CLOSING_H * vh)))
    : 0;
  const closingOpacity = closingProgress;

  // Format date range string for a shower
  const formatDateRange = (shower: MeteorShower) => {
    return `${shower.activePeriod.start} to ${shower.activePeriod.end}, peak ${monthName(shower.peak.month)} ${shower.peak.dayOfMonth}`;
  };

  // Current month for timeline (1-12)
  const currentMonth = Math.min(12, Math.max(1, Math.ceil(currentDay / 30.44)));

  return (
    <div className="relative">
      {/* Fixed canvas */}
      <ScrollDrivenCanvas configs={yearConfigs} scrollProgress={scrollProgress} />

      {/* Opening overlay */}
      {openingOpacity > 0.01 && (
        <div
          className="fixed inset-0 z-1 bg-black pointer-events-none"
          style={{ opacity: openingOpacity }}
        />
      )}

      {/* Closing overlay */}
      {closingOpacity > 0.01 && (
        <div
          className="fixed inset-0 z-1 bg-black pointer-events-none"
          style={{ opacity: closingOpacity }}
        />
      )}

      {/* Left-side timeline */}
      <div className="fixed left-6 top-1/2 -translate-y-1/2 z-10 hidden md:flex flex-col items-center"
           style={{ height: 280 }}>
        {/* Vertical line */}
        <div className="absolute inset-0 flex justify-center">
          <div className="w-px h-full bg-white/10" />
        </div>
        {/* Month labels and dot */}
        <div className="relative flex flex-col justify-between h-full">
          {Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const isCurrentMonth = month === currentMonth;
            return (
              <div key={month} className="relative flex items-center">
                <span
                  className={`font-space-grotesk text-[10px] uppercase tracking-widest select-none ${
                    isCurrentMonth ? "text-white/50" : "text-white/15"
                  }`}
                >
                  {SHORT_MONTHS[month]}
                </span>
              </div>
            );
          })}
          {/* Moving dot */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/40 transition-[top] duration-300 ease-out"
            style={{
              top: `${((currentDay - 1) / 364) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="relative z-10">

        {/* Opening section */}
        <section style={{ height: `${OPENING_H * 100}vh` }}>
          <div className="sticky top-0 h-screen flex items-center justify-center px-6">
            <div className="max-w-lg">
              <p className="text-lg md:text-xl text-white/70 font-georgia leading-relaxed">
                In 2026, twelve meteor showers will cross our sky.
              </p>
            </div>
          </div>
        </section>

        {/* Gap: opening to year start */}
        <div style={{ height: `${GAP_H * 100}vh` }} />

        {/* Year content: spacers + shower sections */}
        {chronologicalShowers.map((shower, i) => (
          <Fragment key={shower.id}>
            {/* Spacer before this shower */}
            {spacerHeights[i] > 0 && (
              <div style={{ height: `${spacerHeights[i] * 100}vh` }} />
            )}

            {/* Shower section with sticky text */}
            <section style={{ height: `${SHOWER_SECTION_H * 100}vh` }}>
              <div className="sticky top-0 h-screen flex items-center justify-center px-6 md:px-16">
                <div className="max-w-xl">
                  <h2 className="text-xl md:text-2xl text-white font-georgia mb-2">
                    {shower.name}
                  </h2>
                  <p className="text-sm text-white/50 font-space-grotesk tracking-wide mb-4">
                    {formatDateRange(shower)}
                  </p>
                  <p className="text-lg md:text-xl text-white/70 font-georgia italic leading-relaxed">
                    {SHOWER_NARRATIVES[shower.id] ?? shower.description}
                  </p>
                </div>
              </div>
            </section>
          </Fragment>
        ))}

        {/* Final spacer (last peak to Dec 31) */}
        {spacerHeights[chronologicalShowers.length] > 0 && (
          <div style={{ height: `${spacerHeights[chronologicalShowers.length] * 100}vh` }} />
        )}

        {/* Gap: year end to closing */}
        <div style={{ height: `${GAP_H * 100}vh` }} />

        {/* Closing section */}
        <section style={{ height: `${CLOSING_H * 100}vh` }} className="flex items-center justify-center px-6">
          <p className="text-lg text-white/50 font-georgia text-center">
            Clear skies.
          </p>
        </section>
      </div>
    </div>
  );
}
