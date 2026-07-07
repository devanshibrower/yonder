// Constants

// Month names, indexed 0–11 to match JavaScript's Date month numbering.
const Months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Helpers (private to this file)

// Strip the time off a date, returning local midnight of that day.
// Building from local year/month/day avoids the UTC shift that slides the date.
function startOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
}

// Public API

// Parse natural-language text into a Date, or null if it can't be read.
// `reference` is what "today"/"tomorrow" are measured from (defaults to now).
export function parseDate(
  input: string,
  reference: Date = new Date(),
): Date | null {
  // Clean once so every matcher below works on trimmed, lowercase text.
  const text = input.trim().toLowerCase();

  // Empty field = "no date": a valid cleared state, not a failed parse.
  if (text === "") return null;

  // Relative keywords, measured from `reference`.
  if (["today", "tday"].includes(text)) return startOfDay(reference);
  if (["tomorrow", "tmrw", "tom"].includes(text)) {
    const tomorrow = new Date(reference);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return startOfDay(tomorrow);
  }

  // Month name + day, any order, optional year: "june 12", "12 june", "jun 12 2026".
  const monthIndex = Months.findIndex((m) =>
    // slice(0, 3) so "jun" matches both "jun" and "june".
    text.includes(m.slice(0, 3).toLowerCase()),
  );
  if (monthIndex !== -1) {
    const numbers = text.match(/\d+/g)?.map(Number) ?? [];
    const day = numbers.find((n) => n >= 1 && n <= 31);
    const year =
      numbers.find((n) => n > 31) ?? reference.getFullYear();
    if (day) return new Date(year, monthIndex, day);
  }

  // Numeric month/day, optional year, slash or dash: "12/06", "12/06/2026".
  if (/[/-]/.test(text)) {
    const [month, day, year] = text.split(/[/-]/).map(Number);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(
        year || reference.getFullYear(),
        month - 1,
        day,
      );
    }
  }

  // ISO "2026-07-04": build it local, since native Date reads ISO as UTC and slides the day.
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, year, month, day] = iso.map(Number);
    return new Date(year, month - 1, day);
  }

  // Last resort: let native Date attempt anything the matchers above missed.
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Format a Date for display in the input field, e.g. "Tue Jul 14".
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
