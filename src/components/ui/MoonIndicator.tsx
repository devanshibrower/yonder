"use client";
import { useRef, useEffect } from "react";

//interface describes the shape of an object in typescript. It says "any props passed to this component must include percentIlluminated, and it must be a number."
interface MoonIndicatorProps {
  percentIlluminated: number; //0 to 100
  currentDay: number; //1-365, which day of the year
  yearProgress: number; // 0 to 1, how far through the year
  phasePosition: number;
}

//Javascript destructuring to pull out percentIlluminated prop from the props object. the : MoonIndicatorProps part is typescript saying "this object must match the shape defined in this interface."
export function MoonIndicator({
  percentIlluminated,
  currentDay,
  yearProgress,
  phasePosition,
}: MoonIndicatorProps) {
  //the useRef hook gives us direct reference to the canvas DOM element. Unlike document.querySelector, refs survive re-renders and are the React-approved way to access DOM elements.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ day: currentDay, progress: yearProgress });
  const propsRef = useRef({
    currentDay,
    yearProgress,
    percentIlluminated,
    phasePosition,
  });
  propsRef.current = {
    currentDay,
    yearProgress,
    percentIlluminated,
    phasePosition,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    //retrieves the device pixel ratio of the screen, which is the number of real pixels that map to one css pixel. This is useful for highDPI or retina displays, so that the canvas is not blurry.

    const dpr = window.devicePixelRatio || 1;

    // A dpr of 2 means 2 real pixels per css pixel in each direction. so 72css pixels becomes 144 real pixels, which is what we set here.

    const scale = dpr * 2; //render at 2x beyond dpr for smoother edges.
    canvas.width = 72 * scale;
    canvas.height = 72 * scale;

    // Set the css display size -> how big the canvas appears on the page.
    canvas.style.width = "72px";
    canvas.style.height = "72px";

    //2d drawing context. toolbox to use to draw shapes, lines, colors etc. canvas is the paper, ctx is the pens/brushes. Every drawing command goes through ctx.

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const state = stateRef.current;
      const target = propsRef.current;

      //lerp toward targets
      state.day += (target.currentDay - state.day) * 0.15;
      state.progress += (target.yearProgress - state.progress) * 0.1;

      ctx.save();
      //scale all future drawing commands by dpr, so we can think in css pixels(72X72) in this case.
      ctx.setTransform(scale, 0, 0, scale, 0, 0);

      //clear canvas before redrawing
      ctx.clearRect(0, 0, 72, 72);

      // moon drawing: arc(centerX, centerY, radius, startAngle, endAngle) — center is 36,36 (half of 72), radius 16. 0 to Math.PI * 2 means a full circle. fillStyle sets the color (light gray-blue), then fill() paints it.

      const cx = 36; //center x (half of 72)
      const cy = 36; //center y (half of 72)
      const moonRadius = 16; //moon radius

      //halo - soft glow behind the moon, brighter when more illuminated. it is a radial gradient: bright in the center, fading to transparent at the edges.
      const illumination = target.percentIlluminated / 100;
      const halo = ctx.createRadialGradient(
        cx,
        cy,
        moonRadius * 0.8, //inner radius of the gradient
        cx,
        cy,
        moonRadius * 1.4 //outer radius of the gradient
      );

      halo.addColorStop(0, `rgba(200,210,255,${0.2 * illumination})`); //mulitplies 0.06 by the illumination, so a full moon glows more than a crescent.
      halo.addColorStop(1, "rgba(200,210,255,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, moonRadius * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      //1. Draw the dark base (the whole moon, dimly lit)

      //beginPath() starts a new invisible outline. Canvas works in two steps:
      // 1. Build a path (beginPath + arc/lineTo/etc) — nothing visible yet
      // 2. Fill or stroke it — now it appears on screen
      // Forgetting beginPath() can connect new shapes to old ones accidentally.
      ctx.beginPath();
      ctx.arc(cx, cy, moonRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(80,90,110,0.12)"; //rgba(red, green, blue, alpha) — each color 0-255, alpha 0-1 (opacity). so 0.12 is very 12% opacity (faint).
      ctx.fill();

      //2. Figure out phase geometry and terminator

      // map 0-100 illumination to phase position for terminator ellipse. 0% = phasePos 0 (new moon), 100% = phasePos 0.5 (full moon)
      const phasePos = target.phasePosition; //0.5 is the midpoint of the phase position range (0-1)

      //is the moon waxing (getting brighter) or waning (getting dimmer)?
      //waxing (0 to 0.5): right side is lit, waning (0.5 to 1): left side is lit
      const isWaxing = phasePos < 0.5;

      //the terminator is the line that separates the lit and dark parts of the moon. its drawn as an ellipse whose width varies with the phase.
      const phaseAngle = phasePos * Math.PI * 2;
      const terminatorX = Math.cos(phaseAngle); //cosine of the phase angle gives us the x-scale of the terminator ellipse.

      //3. Clip the moon curcle, then draw the lit portion

      //save the canvas state so we can restore after clipping
      ctx.save();

      //clip everything to the moon circle - so nothing we draw leaks outside the moon shape.
      ctx.beginPath();
      ctx.arc(cx, cy, moonRadius, 0, Math.PI * 2);
      ctx.clip();

      ctx.beginPath();
      if (isWaxing) {
        //waxingL lit on right, draw right semiciclex.arc
        ctx.arc(cx, cy, moonRadius, -Math.PI / 2, Math.PI / 2);
        ctx.ellipse(
          cx,
          cy,
          moonRadius * Math.abs(terminatorX),
          moonRadius,
          0,
          Math.PI / 2,
          -Math.PI / 2,
          terminatorX > 0
        );
      } else {
        //waning: lit on left, draw left semicircle
        ctx.arc(cx, cy, moonRadius, -Math.PI / 2, Math.PI / 2, true);
        ctx.ellipse(
          cx,
          cy,
          moonRadius * Math.abs(terminatorX),
          moonRadius,
          0,
          Math.PI / 2,
          -Math.PI / 2,
          terminatorX < 0
        );
      }
      ctx.closePath();

      //fill lit region with a bright color
      ctx.fillStyle = "rgba(220,225,235,0.85)";
      ctx.fill();

      //4. Maria (dark patches on moon surface) and soft halo behind it

      //maria - dark spots on the moon surface. small low-opacity curcles at fixed positions relative to center

      const mariaSpots = [
        { x: -3, y: -4, r: 4.5 },
        { x: 4, y: -1, r: 3 },
        { x: -1, y: 5, r: 3.5 },
      ];

      for (const m of mariaSpots) {
        ctx.beginPath();
        ctx.arc(cx + m.x, cy + m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100,105,120,0.10)";
        ctx.fill();
      }

      //Restore canvas state (removes the clipping)
      ctx.restore();

      // year progress ring

      const ringRadius = 30; //bigger than than the moon

      //faint full circle outline (the track)
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      //progress arc from 12 o'clock

      //-Math.PI / 2 — angles in canvas start at the 3 o'clock position and go clockwise. Subtracting π/2 (90°) shifts the start to 12 o'clock, which feels natural for a progress indicator.
      const startAngle = -Math.PI / 2;

      //Math.PI * 2 * yearProgress — yearProgress is 0 to 1, so we multiply by 2PI to get the full circle.
      const endAngle = startAngle + Math.PI * 2 * state.progress;

      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, startAngle, endAngle);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Small dot at current position on the ring.
      // cos and sin convert an angle into x,y coordinates on a circle: x = centerX + cos(angle) * radius, y = centerY + sin(angle) * radius
      // Think of it like a clock hand — give it the angle, and cos/sin
      // tell you the x,y of the tip. This same pattern appears everywhere you nede to place something on a circular path.

      const dotX = cx + Math.cos(endAngle) * ringRadius;
      const dotY = cy + Math.sin(endAngle) * ringRadius;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fill();

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    let raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef}></canvas>;
}
