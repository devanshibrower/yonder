"use client";

import { useState } from "react";
import { formatDate, parseDate } from "@/lib/parseDate";
import * as Popover from "@radix-ui/react-popover";
import { Calendar } from "@/components/ui/calendar";

// A date field with two ways to pick: type natural language ("tomorrow",
// "jun 12") in the input, OR click a day in the calendar popover. Either way,
// it reports a single committed Date up to the parent.
//
// Props: the committed date lives with the PARENT (controlled). This component
// only shows `value` and calls `onChange` to report edits back up.
type DateFieldProps = {
  value: Date | null;
  onChange: (date: Date | null) => void;
};

//------------COMPONENT-------------
export function DateField({ value, onChange }: DateFieldProps) {
  // `text` is the draft the user is typing, separate from the committed `value`.
  // Kept separate so typing is free-form until they commit (Enter / blur / pick).
  const [text, setText] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  });

  // Which month the calendar is showing. Only its year+month matter.
  const [month, setMonth] = useState(() => new Date());

  // We control the popover's open/close ourselves so we can shut it after a pick.
  const [open, setOpen] = useState(false);

  // Parsed live on every render. Derived from `text`, so we compute it, not store it.
  const preview = parseDate(text);

  // Commit the current draft to the parent if it parsed, otherwise do nothing.
  // Sends the Date up via onChange, tidies the input, and jumps the calendar
  // to the committed month so the two stay in sync.
  const commit = () => {
    if (!preview) return;
    onChange(preview);
    setText(formatDate(preview));
    setMonth(preview);
  };

  // Opening the popover: show the already-committed date's month (or today).
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && value) setMonth(value);
  };

  return (
    <>
      {/* Popover.Root: owns the whole popover. We drive its open state via
          `open` + `onOpenChange` so it's controlled (Radix asks, our state decides). */}
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        {/* Popover.Anchor is the element the panel positions itself against.
            `asChild` = don't render an extra wrapper, use our <div> as the anchor. */}
        <Popover.Anchor asChild>
          {/* div to group the text input and the calendar button, side by side. */}
          <div className="inline-flex items-center gap-2">
            <input
              type="text"
              value={text}
              // Every keystroke updates the draft text (and re-parses on next render).
              onChange={(e) => setText(e.target.value)}
              // Enter commits the typed date.
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
              }}
              // Clicking away also commits.
              onBlur={commit}
            />

            {/* Popover.Trigger: the button that opens/closes the panel.
                Its content (the emoji) is just a placeholder icon for now. */}
            <Popover.Trigger>📆</Popover.Trigger>
          </div>
        </Popover.Anchor>

        {/* Popover.Portal: renders the panel at the end of the <body>, so it floats
            above everything and isn't clipped by any parent's overflow. */}
        <Popover.Portal>
          {/* Popover.Content: the floating panel itself.
              side/align/sideOffset = where it sits relative to the anchor.
              data-slot lets the shadcn Calendar go transparent so our bg shows through. */}
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={4}
            data-slot="popover-content"
            className="bg-popover text-popover-foreground rounded-md"
          >
            {/* shadcn Calendar (built on react-day-picker). It's a grandchild:
                the parent's date flows down to here as `selected`. */}
            <Calendar
              mode="single" // single date, not a range
              captionLayout="label" // static month + year text with prev/next chevrons
              selected={value ?? undefined} // highlight the committed date (null -> undefined)
              // Picking a day: commit it up, tidy the input, and close the popover.
              onSelect={(day) => {
                if (!day) return;
                onChange(day);
                setText(formatDate(day));
                setOpen(false);
              }}
              month={month} // which month is shown
              onMonthChange={setMonth} // update when the user pages months
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
