"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import ScrollDrivenCanvas from "@/components/ui/ScrollDrivenCanvas";
import { MoonIndicator } from "@/components/ui/MoonIndicator";

import {
  All_Showers,
  buildYearConfigs,
  buildLayout,
  moonIlluminationForDay,
  moonPhasePosition,
  moonPhaseNameForDay,
  monthName,
  ShowerHeight_Vh,
  SpacerHeight_Vh,
  LayoutSection,
} from "@/lib/utils";
import { MeteorShower } from "@/data/types";
import { Familjen_Grotesk } from "next/font/google";

export default function main() {
  const [scrollY, setScrollY] = useState(0);
  const [vh, setVh] = useState(0);
  const OPENING_VH = 100;
  const CLOSING_VH = 80;

  const showers = useMemo(
    () =>
      [...All_Showers].sort((a, b) =>
        a.peak.month !== b.peak.month
          ? a.peak.month - b.peak.month
          : a.peak.dayOfMonth - b.peak.dayOfMonth
      ),
    []
  );

  const yearConfigs = useMemo(() => buildYearConfigs(All_Showers), []);
  const layout = useMemo(() => buildLayout(showers), [showers]);

  // Scroll to a specific day when user clicks on the moon ring
  const scrollToDay = useCallback(
    (targetDay: number) => {
      if (vh === 0) return;

      const toPx = (vhUnits: number) => (vhUnits / 100) * vh;
      const openingPx = toPx(OPENING_VH);

      // Walk through layout sections to find the right scroll position
      let cursor = 0;
      for (const section of layout) {
        const sectionPx = toPx(section.heightVh);

        if (section.type === "shower") {
          // If target day matches this shower's peak, scroll to middle of section
          if (section.peakDay === targetDay) {
            const targetScroll = openingPx + cursor + sectionPx * 0.3;
            window.scrollTo({ top: targetScroll, behavior: "smooth" });
            return;
          }
        } else {
          // Spacer section — check if targetDay falls within its range
          if (targetDay >= section.startDay && targetDay <= section.endDay) {
            const progress =
              (targetDay - section.startDay) / (section.endDay - section.startDay);
            const targetScroll = openingPx + cursor + sectionPx * progress;
            window.scrollTo({ top: targetScroll, behavior: "smooth" });
            return;
          }
        }
        cursor += sectionPx;
      }

      // If we didn't find an exact match, find the closest section
      // (for days that fall during a shower's active period but aren't the peak)
      cursor = 0;
      for (const section of layout) {
        const sectionPx = toPx(section.heightVh);

        if (section.type === "shower") {
          // Check if targetDay is near this shower (within a few days of peak)
          if (Math.abs(section.peakDay - targetDay) <= 10) {
            const targetScroll = openingPx + cursor + sectionPx * 0.3;
            window.scrollTo({ top: targetScroll, behavior: "smooth" });
            return;
          }
        }
        cursor += sectionPx;
      }
    },
    [vh, layout]
  );

  //useeffect runs once when component mounts, it sets up two listeners -> resize (updates Vh whenever window size changes) and scroll(updates scroll whenever the user scrolls).

  useEffect(() => {
    //store the window height so we can convert vh units to pixels later
    const updatevh = () => setVh(window.innerHeight);
    updatevh(); //call once immediately to get initial value

    // {passive: true} tells the browser we wont call preventDefault(), which lets it optimize scroll performance.
    const onScroll = () => setScrollY(window.scrollY);

    window.addEventListener("resize", updatevh);
    window.addEventListener("scroll", onScroll, { passive: true });

    //remove listeners when component unmounts.
    return () => {
      window.removeEventListener("resize", updatevh);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  //------Scroll to day mapping------
  //converts pixel scroll position into a day of year (1-365), this is recalculated every time scrollY or vh changes
  const currentDay = useMemo(() => {
    //vh is 0 before the first render, so default to day 1
    if (vh === 0) return 1;

    //toPx converts our vh layout values into pixels. Eg: 100(meaning 100vh) * windownheight / 100 = actual pixels
    const toPx = (vhUnits: number) => (vhUnits / 100) * vh;

    //opening section takes up this many pixels
    const openingPx = toPx(100); //openingVh = 100
    //how far we've scrolled past the opening
    const relScroll = scrollY - openingPx;

    //still in the opening?  pin to first showers' peak day
    if (relScroll <= 0) {
      const first = layout.find((s) => s.type === "shower");
      return first && first.type === "shower" ? first.peakDay : 1;
    }

    let cursor = 0;
    for (const section of layout) {
      const sectionPx = toPx(section.heightVh);

      //is out scroll position inside this section?
      if (relScroll < cursor + sectionPx) {
        //how far through this section (0 to 1)
        const localProgress = (relScroll - cursor) / sectionPx;

        if (section.type === "shower") {
          //shower section pin to the peak day - the sky stays fixed while the shower content scrolls through
          return section.peakDay;
        } else {
          //spacer sections interpolatesmoothly transition from startday to endDay as you scroll through
          return Math.round(
            section.startDay +
              (section.endDay - section.startDay) * localProgress
          );
        }
      }
      //move cursor past this section
      cursor = cursor + sectionPx;
    }
    //past all sections, pin to last shower's peak day
    const last = [...layout].reverse().find((s) => s.type === "shower");
    return last && last.type === "shower" ? last.peakDay : 365;
  }, [scrollY, vh, layout]);

  // scrollProgress: 0-indexed into the 365-config array
  // currentDay is 1-365, but our configs array is 0-indexed (index 0 = day 1)
  const scrollProgress = Math.max(0, Math.min(364, currentDay - 1));

  // yearProgress: 0 to 1, how far through the year (for the moon ring)
  const yearProgress = (currentDay - 1) / 364;

  // moon illumination for the current day (0-100, for MoonIndicator)
  const illumination = moonIlluminationForDay(currentDay);
  const phasePos = moonPhasePosition(currentDay);

  // total height of all content in vh units
  // opening (100vh) + all layout sections + closing (80vh)
  const totalContentVh =
    OPENING_VH + layout.reduce((sum, s) => sum + s.heightVh, 0) + CLOSING_VH;

  //---- Opening and closing fade overlays ----
  //openingfade is how far throught the opening section (0 = top of edge, 1 = scrolled past opening). We divide scrollY by the opening section's pixel height
  const openingPx = (OPENING_VH / 100) * vh;
  const openingFrac =
    vh > 0 ? Math.min(1, Math.max(0, scrollY / openingPx)) : 0;

  //Closing fade: how far into the closing section (0 = havent reached it, 1 = at the bottom)
  const totalPx = (totalContentVh / 100) * vh;
  const closingPx = (CLOSING_VH / 100) * vh;
  const closingStartPx = totalPx - closingPx - vh;
  const closingFrac =
    vh > 0
      ? Math.min(1, Math.max(0, (scrollY - closingStartPx) / closingPx))
      : 0;

  //opening overlay starts fully black (opacity 1) and fades out as you scroll down. The * 2.5 makes it fade out faster (fully transparent by 40% scroll through opening)
  const openingOpacity = Math.max(0, Math.min(1, 1 - openingFrac * 2.5));

  //closing overlay fades in as you scroll into the closing section and starts fading at 10% into closing, reaches max 0.9 opacity (not fully black)
  const closingOpacity = Math.max(0, Math.min(0.9, (closingFrac - 0.1) * 1.3));

  return (
    // outer wrapper — relative positioning so z-index layers work
    <div className="relative">
      {/* The animated canvas — fixed behind everything */}
      <ScrollDrivenCanvas
        configs={yearConfigs}
        scrollProgress={scrollProgress}
      />

      {/*opening overlay - fades out as you scroll down INTO the sky experience */}
      {openingOpacity > 0.01 && (
        <div
          className="fixed inset-0 z-[1] bg-black pointer-events-none"
          style={{
            opacity: openingOpacity,
          }}
        />
      )}
      {/*closing overlay, fades in as you scroll into the closing section OUT of the sky experience*/}
      {closingOpacity > 0.01 && (
        <div
          className="fixed inset-0 z-[1] bg-black pointer-events-none"
          style={{
            opacity: closingOpacity,
          }}
        />
      )}
      {/* Moon indicator — fixed in top-right corner, interactive */}
      <div
        className="fixed z-20 flex flex-col items-center"
        style={{ top: 24, right: 24, width: 160 }}
      >
        <div className="pointer-events-auto">
          <MoonIndicator
            percentIlluminated={illumination}
            currentDay={currentDay}
            yearProgress={yearProgress}
            phasePosition={phasePos}
            size={140}
            onDayClick={scrollToDay}
          />
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--color-slate-200)",
            fontFamily: "system-ui, sans-serif",
            marginTop: 6,
            textAlign: "center",
          }}
        >
          {moonPhaseNameForDay(currentDay)}
        </p>
        <p
          style={{
            fontSize: 12,
            color: "var(--color-slate-200)",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          {Math.round(illumination)}%
        </p>
      </div>

      {/* Scrollable content layer — sits on top of the canvas (z-10) */}
      <div className="relative z-10">
        {/* Opening section — one full screen with centered intro text */}
        <section style={{ height: `${OPENING_VH}vh` }}>
          <div className="sticky top-0 h-screen flex items-center justify-center px-6">
            <p
              style={{
                fontSize: "clamp(18px, 3vw, 22px)",
                fontFamily: "Georgia, serif",
                color: "rgba(255,255,255,0.55)",
                lineHeight: 1.75,
                textAlign: "center",
                maxWidth: 400,
              }}
            >
              In 2026, twelve meteor showers will cross our sky.
            </p>
          </div>
        </section>

        {/* Layout sections — alternating spacers and showers */}
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
              style={{ height: `${section.heightVh}vh` }}
            >
              <div className="sticky top-0 h-screen flex items-center justify-center">
                <div
                  style={{
                    maxWidth: 480,
                    padding: "0 28px",
                    textAlign: "center",
                  }}
                >
                  {/* Shower name */}
                  <h2
                    style={{
                      fontSize: "clamp(28px, 5vw, 40px)",
                      fontFamily: "Georgia, serif",
                      color: "rgba(255,255,255,0.88)",
                      fontWeight: 400,
                    }}
                  >
                    {shower.name}
                  </h2>

                  {/* Active period range */}
                  <p
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.28)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {shower.activePeriod.start} – {shower.activePeriod.end}
                  </p>

                  {/* Shower description */}
                  <p
                    style={{
                      fontSize: "clamp(15px, 2.2vw, 17px)",
                      fontFamily: "Georgia, serif",
                      color: "rgba(255,255,255,0.42)",
                      lineHeight: 1.8,
                      marginTop: 28,
                    }}
                  >
                    {shower.description}
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
