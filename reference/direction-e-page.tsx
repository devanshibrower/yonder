"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import ScrollDrivenCanvas from "@/components/ui/ScrollDrivenCanvas";
import MoonIndicator from "@/components/ui/MoonIndicator";
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

// --- Layout constants ---

const SHOWER_HEIGHT_VH = 100;
const SPACER_HEIGHT_VH = 80;
const MIN_GAP_FOR_SPACER = 20; // days
const OPENING_VH = 100;
const CLOSING_VH = 80;

// --- Helpers ---

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const MONTH_NAMES_FULL = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function showerPeakDay(shower: MeteorShower): number {
  let doy = shower.peak.dayOfMonth;
  for (let m = 1; m < shower.peak.month; m++) doy += DAYS_IN_MONTH[m];
  return doy;
}

function dayOfYearToMonth(dayOfYear: number): number {
  let remaining = dayOfYear;
  for (let m = 1; m <= 12; m++) {
    if (remaining <= DAYS_IN_MONTH[m]) return m;
    remaining -= DAYS_IN_MONTH[m];
  }
  return 12;
}

function monthStartDayOfYear(month: number): number {
  let d = 1;
  for (let m = 1; m < month; m++) d += DAYS_IN_MONTH[m];
  return d;
}

// --- Layout types ---

interface ShowerSection {
  type: "shower";
  shower: MeteorShower;
  peakDay: number;
  heightVh: number;
}

interface SpacerSection {
  type: "spacer";
  startDay: number;
  endDay: number;
  label: string;
  count: number; // number of spacer units
  heightVh: number;
}

type LayoutSection = ShowerSection | SpacerSection;

function buildLayout(showers: MeteorShower[]): LayoutSection[] {
  const layout: LayoutSection[] = [];
  const peakDays = showers.map(showerPeakDay);

  function addSpacers(fromDay: number, toDay: number) {
    const totalGap = toDay - fromDay;
    if (totalGap <= MIN_GAP_FOR_SPACER) return;

    const startMonth = dayOfYearToMonth(fromDay);
    const endMonth = dayOfYearToMonth(toDay);

    for (let m = startMonth; m <= endMonth; m++) {
      const mStart = monthStartDayOfYear(m);
      const mEnd = mStart + DAYS_IN_MONTH[m];
      const spacerStart = Math.max(fromDay, mStart);
      const spacerEnd = Math.min(toDay, mEnd);
      const days = spacerEnd - spacerStart;

      if (days < 5) continue;

      const count = Math.max(1, Math.round(days / 30));
      layout.push({
        type: "spacer",
        startDay: spacerStart,
        endDay: spacerEnd,
        label: MONTH_NAMES_FULL[m],
        count,
        heightVh: SPACER_HEIGHT_VH * count,
      });
    }
  }

  for (let i = 0; i < showers.length; i++) {
    const prevDay = i === 0 ? 1 : peakDays[i - 1];
    addSpacers(prevDay, peakDays[i]);

    layout.push({
      type: "shower",
      shower: showers[i],
      peakDay: peakDays[i],
      heightVh: SHOWER_HEIGHT_VH,
    });
  }

  // Trailing spacer after last shower to Dec 31
  const lastPeak = peakDays[peakDays.length - 1];
  addSpacers(lastPeak, 365);

  return layout;
}

// --- Format helpers ---

function formatActiveRange(shower: MeteorShower): string {
  return `${shower.activePeriod.start} – ${shower.activePeriod.end}`;
}

function formatPeakDate(shower: MeteorShower): string {
  return `Peak ${monthName(shower.peak.month)} ${shower.peak.dayOfMonth}`;
}

// --- Page component ---

export default function DirectionEPage() {
  const [scrollY, setScrollY] = useState(0);
  const [vh, setVh] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Build layout sections
  const layout = useMemo(
    () => buildLayout(chronologicalShowers),
    [chronologicalShowers]
  );

  // Total content height in vh
  const totalContentVh = useMemo(() => {
    const bodyVh = layout.reduce((sum, s) => sum + s.heightVh, 0);
    return OPENING_VH + bodyVh + CLOSING_VH;
  }, [layout]);

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

  // Scroll-to-day mapping: pin in shower sections, interpolate in spacers
  const currentDay = useMemo(() => {
    if (vh === 0) return 1;

    // Convert vh units to px: e.g., 100 (meaning 100vh) -> window.innerHeight
    const toPx = (vhUnits: number) => (vhUnits / 100) * vh;

    const openingPx = toPx(OPENING_VH);

    // Scroll position relative to content start (after opening)
    const relScroll = scrollY - openingPx;

    if (relScroll <= 0) {
      // Before content: pin to first peak day
      const firstShower = layout.find((s) => s.type === "shower") as ShowerSection | undefined;
      return firstShower ? firstShower.peakDay : 1;
    }

    // Walk through layout sections
    let cursor = 0;
    for (const section of layout) {
      const sectionPx = toPx(section.heightVh);

      if (relScroll < cursor + sectionPx) {
        // We're in this section
        const localProgress = (relScroll - cursor) / sectionPx;

        if (section.type === "shower") {
          // Pin to peak day
          return section.peakDay;
        } else {
          // Interpolate linearly from startDay to endDay
          return Math.round(
            section.startDay + (section.endDay - section.startDay) * localProgress
          );
        }
      }

      cursor += sectionPx;
    }

    // After content: pin to last peak day
    const lastShower = [...layout].reverse().find((s) => s.type === "shower") as ShowerSection | undefined;
    return lastShower ? lastShower.peakDay : 365;
  }, [scrollY, vh, layout]);

  // scrollProgress: 0-indexed into the 365-config array
  const scrollProgress = Math.max(0, Math.min(364, currentDay - 1));

  // Year progress for moon indicator (0 to 1)
  const yearProgress = (currentDay - 1) / 364;

  // Opening fraction (0 = top, 1 = fully scrolled past opening)
  const openingPx = (OPENING_VH / 100) * vh;
  const openingFrac = vh > 0 ? Math.min(1, Math.max(0, scrollY / openingPx)) : 0;

  // Closing fraction
  const totalPx = (totalContentVh / 100) * vh;
  const closingPx = (CLOSING_VH / 100) * vh;
  const closingStartPx = totalPx - closingPx;
  const closingFrac = vh > 0
    ? Math.min(1, Math.max(0, (scrollY - closingStartPx) / closingPx))
    : 0;

  // Opening overlay opacity
  const openingOpacity = Math.max(0, Math.min(1, 1 - openingFrac * 2.5));

  // Closing overlay opacity
  const closingOpacity = Math.max(0, Math.min(0.9, (closingFrac - 0.1) * 1.3));

  // Moon visibility
  const moonVisible = openingFrac > 0.5 && closingFrac < 0.7;

  return (
    <div
      className="relative"
      style={{ scrollSnapType: "y proximity" }}
      ref={scrollContainerRef}
    >
      {/* Fixed canvas */}
      <ScrollDrivenCanvas configs={yearConfigs} scrollProgress={scrollProgress} />

      {/* Opening overlay */}
      {openingOpacity > 0.01 && (
        <div
          className="fixed inset-0 z-[1] bg-black pointer-events-none"
          style={{ opacity: openingOpacity }}
        />
      )}

      {/* Closing overlay */}
      {closingOpacity > 0.01 && (
        <div
          className="fixed inset-0 z-[1] bg-black pointer-events-none"
          style={{ opacity: closingOpacity }}
        />
      )}

      {/* Moon indicator */}
      <div
        className="fixed z-20 pointer-events-none"
        style={{ top: 72, right: 24 }}
      >
        <MoonIndicator
          currentDay={currentDay}
          yearProgress={yearProgress}
          opacity={moonVisible ? 1 : 0}
        />
      </div>

      {/* Scrollable content */}
      <div className="relative z-10">

        {/* Opening section */}
        <section style={{ height: `${OPENING_VH}vh` }}>
          <div className="sticky top-0 h-screen flex items-center justify-center px-6">
            <div style={{ maxWidth: 400, textAlign: "center" }}>
              <p
                style={{
                  fontSize: "clamp(18px, 3vw, 22px)",
                  fontFamily: "Georgia, serif",
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.75,
                }}
              >
                In 2026, twelve meteor showers will cross our sky.
              </p>
            </div>
          </div>
        </section>

        {/* Year content: layout sections */}
        {layout.map((section, i) => {
          if (section.type === "spacer") {
            return (
              <div
                key={`spacer-${i}`}
                style={{
                  height: `${section.heightVh}vh`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "clamp(13px, 2vw, 15px)",
                    fontFamily: "Georgia, serif",
                    color: "rgba(255,255,255,0.12)",
                    letterSpacing: "0.04em",
                    userSelect: "none",
                  }}
                >
                  {section.label}
                </span>
              </div>
            );
          }

          // Shower section
          const shower = section.shower;
          return (
            <section
              key={shower.id}
              style={{
                height: `${section.heightVh}vh`,
                scrollSnapAlign: "start",
              }}
            >
              <div className="sticky top-0 h-screen flex items-center justify-center">
                <div
                  style={{
                    maxWidth: 480,
                    padding: "0 28px",
                    textAlign: "center",
                  }}
                >
                  {/* Name */}
                  <h2
                    style={{
                      fontSize: "clamp(28px, 5vw, 40px)",
                      fontFamily: "Georgia, serif",
                      color: "rgba(255,255,255,0.88)",
                      fontWeight: 400,
                      lineHeight: 1.15,
                      marginBottom: 8,
                      marginTop: 0,
                    }}
                  >
                    {shower.name}
                  </h2>

                  {/* Active range */}
                  <p
                    style={{
                      fontSize: 11,
                      fontFamily: "system-ui, sans-serif",
                      color: "rgba(255,255,255,0.28)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 6,
                      marginTop: 0,
                    }}
                  >
                    {formatActiveRange(shower)}
                  </p>

                  {/* Peak date */}
                  <p
                    style={{
                      fontSize: 11,
                      fontFamily: "system-ui, sans-serif",
                      color: "rgba(255,255,255,0.5)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 28,
                      marginTop: 0,
                    }}
                  >
                    {formatPeakDate(shower)}
                  </p>

                  {/* Narrative */}
                  <p
                    style={{
                      fontSize: "clamp(15px, 2.2vw, 17px)",
                      fontFamily: "Georgia, serif",
                      color: "rgba(255,255,255,0.42)",
                      lineHeight: 1.8,
                      marginTop: 0,
                      marginBottom: 0,
                    }}
                  >
                    {SHOWER_NARRATIVES[shower.id] ?? shower.description}
                  </p>
                </div>
              </div>
            </section>
          );
        })}

        {/* Closing section */}
        <section
          style={{
            height: `${CLOSING_VH}vh`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
          }}
        >
          <p
            style={{
              fontSize: 18,
              fontFamily: "Georgia, serif",
              color: "rgba(255,255,255,0.35)",
              textAlign: "center",
            }}
          >
            Clear skies.
          </p>
        </section>
      </div>
    </div>
  );
}
