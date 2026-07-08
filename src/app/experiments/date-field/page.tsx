"use client";

import { useState } from "react";
import { DateField } from "@/components/ui/DateField";

export default function DateFieldPage() {
  // The parent owns the date. useState gives this page memory to hold it.
  const [date, setDate] = useState<Date | null>(null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-gray-200">
      <DateField value={date} onChange={setDate} />

      {/* live readout, so we can SEE what DateField reports up */}
      <p className="text-sm text-gray-400">
        {date ? date.toDateString() : "no date"}
      </p>
    </div>
  );
}
