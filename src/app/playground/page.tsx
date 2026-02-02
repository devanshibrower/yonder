"use client";

import { useState, useCallback } from "react";
import MeteorCanvas from "@/components/ui/MeteorCanvas";
import { MeteorConfig } from "@/lib/meteor-animation";

const PRESETS: { label: string; config: MeteorConfig }[] = [
  {
    label: "Quadrantids",
    config: {
      velocityKmPerSec: 40.4,
      zhr: 120,
      radiantX: 0.3,
      radiantY: 0.2,
      colorHue: 220,
    },
  },
  {
    label: "Lyrids",
    config: {
      velocityKmPerSec: 46.4,
      zhr: 18,
      radiantX: 0.6,
      radiantY: 0.15,
      colorHue: 45,
    },
  },
  {
    label: "Eta Aquarids",
    config: {
      velocityKmPerSec: 52.8,
      zhr: 50,
      radiantX: 0.7,
      radiantY: 0.65,
      colorHue: 180,
    },
  },
];

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-200 font-mono">
          {value}
          {unit && <span className="text-gray-500 ml-1">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-gray-400"
      />
    </div>
  );
}

export default function PlaygroundPage() {
  const [config, setConfig] = useState<MeteorConfig>(PRESETS[0].config);

  const update = useCallback(
    (key: keyof MeteorConfig, value: number) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return (
    <div className="flex flex-col min-h-screen p-6 gap-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">Meteor Shower Playground</h1>

      {/* Canvas */}
      <div className="w-full rounded-lg overflow-hidden" style={{ height: 500 }}>
        <MeteorCanvas config={config} />
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sliders */}
        <div className="flex-1 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Parameters
          </h2>
          <Slider
            label="Velocity"
            value={config.velocityKmPerSec}
            min={20}
            max={70}
            step={0.1}
            unit="km/s"
            onChange={(v) => update("velocityKmPerSec", v)}
          />
          <Slider
            label="ZHR"
            value={config.zhr}
            min={1}
            max={200}
            step={1}
            unit="meteors/hr"
            onChange={(v) => update("zhr", v)}
          />
          <Slider
            label="Radiant X"
            value={config.radiantX}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update("radiantX", v)}
          />
          <Slider
            label="Radiant Y"
            value={config.radiantY}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update("radiantY", v)}
          />
          <Slider
            label="Color Hue"
            value={config.colorHue}
            min={0}
            max={360}
            step={1}
            unit="°"
            onChange={(v) => update("colorHue", v)}
          />
        </div>

        {/* Presets */}
        <div className="flex flex-col gap-3 md:w-56">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Presets
          </h2>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setConfig(preset.config)}
              className="px-4 py-2 rounded border border-gray-700 text-gray-300 text-sm hover:bg-gray-800 hover:border-gray-600 transition-colors text-left"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
