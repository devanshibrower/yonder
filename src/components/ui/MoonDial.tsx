"use client";

import { useState, useRef, useEffect } from "react";
import * as SunCalc from "suncalc";

const CanvasSize = 320;

//helper function for moon phases

export default function MoonDial() {
  const [date, setDate] = useState(() => new Date());

  // A box that will hold the canvas once it renders. We will use this ref to get the canvas node and draw on it.
  const canvasRef = useRef<HTMLCanvasElement>(null);

  //suncalc returns an object with the moon illumination data for the given date. we will get:
  // Illumination -> how much of moon face is lit 0 (new moon) to 1 (full moon)
  //Phase -> where we are in the moon cycle 0 (new moon), 0.5(full moon), 1 (new moon again)

  //desctiption for my understanding: Both are 0 to 1, not 0 to 100. They're fractions, not percents. We multiply by 100 only when we show a percent to a human.
  // Here's why illumination alone is not enough, and why we need phase: illumination is ambiguous about direction.
  // A half-lit moon reads illumination = 0.5 whether it's first quarter (waxing, lit on the right) or last quarter (waning, lit on the left).
  // illumination can't tell those apart. phase can, because 0.25 and 0.75 are different points on its one-way loop.
  // So phase is what will tell us which side to paint and whether the moon is growing or shrinking. illumination just tells us how much.

  //I like the term illumination better than fraction (which we get from SunCalc), so we will rename it to illumination.
  const { fraction: illumination, phase } =
    SunCalc.getMoonIllumination(date);

  //draw after react has put canvas on page
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const center = CanvasSize / 2;
    const radius = CanvasSize / 4; // leave some padding

    const moonDark = "#2e323b"; // dark side of the moon
    const moonLight = "#e8e9ec"; // lit side of the moon

    // Clear the canvas
    ctx.clearRect(0, 0, CanvasSize, CanvasSize); //wipe the sheet

    // Draw the plain dark moon circle first
    ctx.beginPath(); //begin drawing a new shape
    ctx.arc(center, center, radius, 0, 2 * Math.PI); //draw a circle
    ctx.fillStyle = moonDark; //set the color to dark
    ctx.fill(); //fill the circle with the color

    //Clip any future shapes to the moon circle
    ctx.save(); //save the current state of the canvas
    ctx.beginPath(); //begin drawing a new shape
    ctx.arc(center, center, radius, 0, 2 * Math.PI); //draw a circle
    ctx.clip(); //clip to the circle

    //work out whether the moon is waxing or waning
    const waxing = phase < 0.5; //true if waxing, false if waning

    //this controls how wide the curved day/night line is. At quarter moon it becomes 0, which gives a straight half-moon line.
    //Near new / full it becomes wide, which gives crescents or gibbous shapes. The formula is based on the geometry of the moon's illumination.
    const ellipseRadius = radius * Math.cos(2 * Math.PI * phase); //width of the curve, based on the phase

    ctx.beginPath(); //begin drawing a new shape
    // no moveTo needed: after beginPath the first arc() starts the path at its own start point

    if (waxing) {
      //lit side is on the right
      ctx.arc(center, center, radius, -Math.PI / 2, Math.PI / 2); //draw the right half of the moon
      ctx.ellipse(
        center,
        center,
        Math.abs(ellipseRadius), //width of the ellipse based on the phase
        radius,
        0,
        Math.PI / 2,
        -Math.PI / 2,
        ellipseRadius > 0, //sign of ellipseRadius picks the bulge side: toward lit = crescent, away = gibbous
      ); //draw the curved day/night line
    } else {
      //lit side is on the left
      ctx.arc(center, center, radius, Math.PI / 2, -Math.PI / 2); //draw the left half of the moon
      ctx.ellipse(
        center,
        center,
        Math.abs(ellipseRadius), //width of the ellipse based on the phase
        radius,
        0,
        -Math.PI / 2,
        Math.PI / 2,
        ellipseRadius > 0, //sign of ellipseRadius picks the bulge side: toward lit = crescent, away = gibbous
      ); //draw the curved day/night line
    }

    ctx.closePath(); //close the path
    ctx.fillStyle = moonLight; //set the color to light
    ctx.fill(); //fill the shape with the color

    ctx.restore(); //restore the canvas state to before we clipped it
  }, [phase]); //redraw when phase changes

  return (
    <div>
      <input
        type="date"
        value={date.toISOString().split("T")[0]}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) {
            return; // do nothing if the value is empty
          }
          const nextDate = new Date(value);
          if (Number.isNaN(nextDate.getTime())) {
            return; // do nothing if the date is invalid
          }
          setDate(nextDate);
        }}
      />
      <canvas
        ref={canvasRef}
        width={CanvasSize}
        height={CanvasSize}
      />
      <p>Illumination: {(illumination * 100).toFixed(2)}%</p>
      <p>Phase: {phase.toFixed(2)}</p>
    </div>
  );
}
