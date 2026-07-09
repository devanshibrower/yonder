import { Body, Illumination, Libration, MoonPhase } from "astronomy-engine";

// Mean Earth-Moon distance, in km (the semi-major axis of the Moon's orbit).
// Used only as a reference point for how big the Moon should look on screen
// when it's closer or farther than average.
const MEAN_DISTANCE_KM = 384_400;

export type MoonGeometry = {
  // Where on the Moon's surface the Sun is directly overhead, in degrees.
  // Together with `subearth`, this is what a 3D lighting renderer needs to
  // shade the sphere: it's the sun's position in the Moon's own coordinates.
  subsolar: { lon: number; lat: number };
  // Where on the Moon's surface Earth is directly overhead, in degrees. This
  // is the "libration" point: it doesn't sit still at (0, 0), it wobbles by a
  // few degrees over the month, which is why real photos of the Moon show
  // slightly more or less of the far edge at different times.
  subearth: { lon: number; lat: number };
  // Rotates the rendered disk, in degrees. Fixed at 0 — see the note in
  // getMoonGeometry on why this isn't computed from real geometry.
  posangle: number;
  // Earth-Moon center-to-center distance, in km. The Moon's orbit isn't a
  // perfect circle, so this varies through the month and changes how big the
  // Moon should appear.
  distance: number;
  // 0..1, where 0 and 1 are new moon, 0.25 is first quarter, 0.5 is full,
  // 0.75 is last quarter. Same convention SunCalc and the rest of this app
  // already use for phase.
  phase: number;
  // 0..1, how much of the visible disk is lit.
  illumination: number;
};

/**
 * The Moon's lighting geometry for a given date, computed for any date (not
 * looked up from a fixed table), so a date picker isn't limited to one year
 * of pre-baked data. Sourced entirely from `astronomy-engine`: `Libration`
 * gives the real sub-Earth point (the wobble), `MoonPhase` / `Illumination`
 * give the Sun-Moon-Earth angle and lit fraction.
 *
 * `posangle` (how tilted the crescent looks) is deliberately fixed at 0, not
 * computed. The true tilt of a real photographed Moon depends on where on
 * Earth you're standing and what's overhead at that moment (it's why the
 * Moon can look like a smile near the horizon but a clean vertical crescent
 * higher up) — that needs an observer latitude/longitude this app doesn't
 * have. A geocentric stand-in (the bright limb's angle from celestial north)
 * is a different, unrelated quantity, not a substitute — using it just
 * rotates the disk by an arbitrary-looking amount with no correct reference
 * frame behind it. Zero matches the convention MoonDial and Apple Weather
 * both use: a vertical terminator, lit right when waxing, left when waning.
 * Not a simplification of the truth, since there wasn't an accurate version
 * of this available without observer location — the honest choice given
 * what's known.
 */
export function getMoonGeometry(date: Date): MoonGeometry {
  const libration = Libration(date);
  const illumination = Illumination(Body.Moon, date);
  const phaseAngleDeg = MoonPhase(date); // 0 = new, 90 = first quarter, 180 = full, 270 = last quarter
  const posangle = 0;

  const subearth = { lon: libration.elon, lat: libration.elat };

  // How far the sunlit hemisphere sits from the sub-Earth point: at new moon
  // the Sun lights the FAR side (180° away from center), at full moon it
  // lights the NEAR side (0° from center). This is the same relationship
  // MoonDial's drawMoonFace uses (cos(2π·phase)), just expressed as an angle
  // instead of a width.
  const subsolarLonOffset = 180 - phaseAngleDeg;

  const subsolar = {
    lon: subearth.lon + subsolarLonOffset,
    // No separate model for the Sun's latitude on the Moon; reusing the
    // libration tilt keeps the terminator roughly consistent with the disk's
    // observed tilt. An approximation, not a precise value.
    lat: subearth.lat,
  };

  return {
    subsolar,
    subearth,
    posangle,
    distance: libration.dist_km,
    phase: phaseAngleDeg / 360,
    illumination: illumination.phase_fraction,
  };
}

/** How much bigger or smaller the Moon should render, given its distance
 * right now vs. its average distance. Clamped to a subtle range (the Moon's
 * real apparent-size swing through its orbit is modest) so it reads as a
 * detail, not a jump. */
export function apparentScaleFromDistance(distanceKm: number) {
  const raw = MEAN_DISTANCE_KM / distanceKm;
  return Math.min(1.08, Math.max(0.92, raw));
}
