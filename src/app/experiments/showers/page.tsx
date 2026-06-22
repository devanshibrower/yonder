"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import ScrollDrivenCanvas from "@/components/ui/ScrollDrivenCanvas";
import MoonCanvasSidebar from "@/components/ui/MoonCanvasSidebar";

import {
  All_Showers,
  buildYearConfigs,
  buildLayout,
} from "@/lib/utils";

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

  // Sidebar fades in with the experience and out at the end
  const sidebarOpacity = Math.min(1 - openingOpacity, 1 - closingOpacity);

  // Moon viewing verdict based on illumination
  const moonVerdict = (pct: number) => {
    if (pct <= 25) return "Dark skies";
    if (pct <= 50) return "Mostly dark";
    if (pct <= 75) return "Moonlit";
    return "Bright moon";
  };

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
      {/* Fixed left sidebar — MoonCanvas synced with scroll, fades in/out with experience */}
      <aside
        className="fixed left-0 top-0 h-screen z-20 w-[280px] flex flex-col items-center justify-center pointer-events-auto max-lg:hidden transition-opacity duration-300"
        style={{ opacity: sidebarOpacity }}
      >
        <MoonCanvasSidebar
          selectedDay={currentDay}
          onDaySelect={scrollToDay}
        />
      </aside>

      {/* Scrollable content layer — shifted right on large screens */}
      <div className="relative z-10 lg:ml-[280px]">
        {/* Opening section */}
        <section style={{ height: `${OPENING_VH}vh` }} />

        {/* Layout sections — alternating spacers and showers */}
        {layout.map((section, i) => {
          if (section.type === "spacer") {
            const nextShower = layout.slice(i + 1).find(s => s.type === "shower");
            const daysUntil = nextShower && nextShower.type === "shower"
              ? nextShower.peakDay - section.endDay
              : null;

            return (
              <div
                key={`spacer-${i}`}
                style={{
                  height: `${section.heightVh}vh`,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    paddingLeft: "clamp(32px, 5vw, 64px)",
                    paddingRight: 28,
                  }}
                >
                  <span
                    style={{
                      fontSize: "clamp(13px, 2vw, 15px)",
                      fontFamily: "Georgia, serif",
                      color: "rgba(255,255,255,0.10)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {section.label}
                  </span>
                  {daysUntil !== null && nextShower && nextShower.type === "shower" && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        fontFamily: "system-ui, sans-serif",
                        color: "rgba(255,255,255,0.18)",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {daysUntil} days until {nextShower.shower.name}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Shower section — always visible, no scroll-driven animation
          const shower = section.shower;
          const moonPct = shower.moonPhase2026.percentIlluminated;

          return (
            <section
              key={shower.id}
              style={{ height: `${section.heightVh}vh` }}
            >
              <div className="sticky top-0 h-screen flex items-center">
                <div
                  style={{
                    maxWidth: 500,
                    paddingLeft: "clamp(32px, 5vw, 64px)",
                    paddingRight: 28,
                  }}
                >
                  {/* Shower name */}
                  <h2
                    style={{
                      fontSize: "clamp(32px, 5vw, 48px)",
                      fontFamily: "Georgia, serif",
                      color: "rgba(255,255,255,0.88)",
                      fontWeight: 400,
                      margin: 0,
                    }}
                  >
                    {shower.name}
                  </h2>

                  {/* Active period */}
                  <p
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.30)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginTop: 6,
                      marginBottom: 0,
                    }}
                  >
                    {shower.activePeriod.start} – {shower.activePeriod.end}
                  </p>

                  {/* Stats row — ZHR, velocity, radiant */}
                  <div
                    style={{
                      marginTop: 28,
                      display: "flex",
                      gap: 32,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 24, fontFamily: "Georgia, serif", color: "rgba(255,255,255,0.70)" }}>
                        {shower.zhr}
                      </div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
                        meteors / hr
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 24, fontFamily: "Georgia, serif", color: "rgba(255,255,255,0.70)" }}>
                        {shower.velocity.kmPerSec}
                      </div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
                        km / s
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 24, fontFamily: "Georgia, serif", color: "rgba(255,255,255,0.70)" }}>
                        {shower.radiant.constellation}
                      </div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
                        radiant
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p
                    style={{
                      fontSize: "clamp(15px, 2.2vw, 17px)",
                      fontFamily: "Georgia, serif",
                      color: "rgba(255,255,255,0.38)",
                      lineHeight: 1.8,
                      marginTop: 24,
                    }}
                  >
                    {shower.description}
                  </p>

                  {/* Footer — parent body · viewing · phase */}
                  <div
                    style={{
                      marginTop: 20,
                      fontSize: 10,
                      color: "rgba(255,255,255,0.18)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {shower.parentObject.name} · {moonVerdict(moonPct)} · {shower.moonPhase2026.phaseName}
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {/* Closing section */}
        <section
          style={{
            height: `${CLOSING_VH}vh`,
          }}
        />
      </div>
    </div>
  );
}
