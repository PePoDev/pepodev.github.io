import type { Experience, WorkMetric } from "../types/data";

/** A calendar month; `month` is 0-based like `Date#getMonth()`. */
export interface YearMonth {
  year: number;
  month: number;
}

export interface Role extends Experience {
  /** Company without its legal suffix, e.g. "Opsta (Thailand)". */
  companyName: string;
  /** Company without legal suffix or qualifier, e.g. "Opsta". */
  companyShortName: string;
  start: YearMonth;
  end: YearMonth;
  current: boolean;
  /** Calendar months in the role, counting the first and last month. */
  months: number;
  /** "2 yr 9 mo" */
  tenure: string;
}

export interface TimelineSegment {
  kind: "role" | "gap";
  start: YearMonth;
  end: YearMonth;
  months: number;
  /** Months since the first month of the timeline. */
  offset: number;
  role?: Role;
}

export interface CareerSummary {
  /** Roles in data order (newest first). */
  roles: Role[];
  current?: Role;
  firstStart?: YearMonth;
  /** The month the site was built in. */
  today: YearMonth;
  companies: number;
  /** Completed years since the earliest role started. */
  years: number;
  /** "7+" */
  yearsLabel: string;
  /** Months from the earliest start to `today`, both included. */
  totalMonths: number;
  /** Oldest first, with honest gaps between roles. */
  timeline: TimelineSegment[];
}

const MONTH_NAMES = [
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

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

export function toYearMonth(date: Date): YearMonth {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function monthIndex({ year, month }: YearMonth): number {
  return year * 12 + month;
}

export function fromMonthIndex(index: number): YearMonth {
  return { year: Math.floor(index / 12), month: index % 12 };
}

/** Months from `start` to `end`, counting both. */
export function monthsBetween(start: YearMonth, end: YearMonth): number {
  return monthIndex(end) - monthIndex(start) + 1;
}

/** "February 2024", "Feb 2024" or "Sept 2024" -> { year: 2024, month: 1 }. */
export function parseMonth(text: string): YearMonth | undefined {
  const match = text.trim().match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  if (!match) return undefined;
  const name = match[1].toLowerCase();
  const month =
    name.length < 3
      ? -1
      : MONTH_NAMES.findIndex((candidate) =>
          candidate.toLowerCase().startsWith(name),
        );
  return month === -1 ? undefined : { year: Number(match[2]), month };
}

/** "May 2020 - June 2022" or "February 2024 - Present". */
export function parsePeriod(
  period: string,
  today: YearMonth,
): { start: YearMonth; end: YearMonth; current: boolean } {
  const [startText = "", endText = ""] = period.split(/\s*[-–—]\s*/);
  const start = parseMonth(startText);
  if (!start) throw new Error(`Cannot parse the start of "${period}"`);
  const current = /^(present|now|current)$/i.test(endText.trim());
  const end = current ? today : parseMonth(endText);
  if (!end) throw new Error(`Cannot parse the end of "${period}"`);
  return { start, end, current };
}

export function formatMonth(
  { year, month }: YearMonth,
  style: "short" | "long" = "short",
): string {
  const name = MONTH_NAMES[month];
  return `${style === "short" ? name.slice(0, 3) : name} ${year}`;
}

/** { year: 2024, month: 1 } -> "2024-02", for `<time datetime>`. */
export function formatIsoMonth({ year, month }: YearMonth): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** 33 -> "2 yr 9 mo", 7 -> "7 mo", 24 -> "2 yr". */
export function formatTenure(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years > 0 && `${years} yr`, rest > 0 && `${rest} mo`]
    .filter(Boolean)
    .join(" ");
}

/** 7 -> "seven"; numbers above twelve stay as digits. */
export function numberToWords(value: number): string {
  return NUMBER_WORDS[value] ?? String(value);
}

/** "Extend Interactive Co., Ltd." -> "Extend Interactive". */
export function companyName(company: string): string {
  return company
    .replace(/,?\s*(Co\.,?\s*Ltd\.?|Ltd\.?|Inc\.?|LLC)$/i, "")
    .trim();
}

/** "Opsta (Thailand) Co.,Ltd." -> "Opsta". */
export function companyShortName(company: string): string {
  return companyName(company).replace(/\s*\([^)]*\)/g, "").trim();
}

export function getRoles(
  experiences: Experience[],
  today: YearMonth,
): Role[] {
  return experiences.map((experience) => {
    const { start, end, current } = parsePeriod(experience.period, today);
    // A role that has not started yet (or ends before it starts) would draw
    // nothing and report no tenure, so stop the build with a clear message.
    if (monthIndex(start) > monthIndex(today)) {
      throw new Error(
        `"${experience.company}" starts after ${formatMonth(today)}; add it to experiences.json once it has started.`,
      );
    }
    if (monthIndex(end) < monthIndex(start)) {
      throw new Error(`"${experience.period}" ends before it starts`);
    }
    const months = monthsBetween(start, end);
    return {
      ...experience,
      companyName: companyName(experience.company),
      companyShortName: companyShortName(experience.company),
      start,
      end,
      current,
      months,
      tenure: formatTenure(months),
    };
  });
}

export function getCareerSummary(
  experiences: Experience[],
  now = new Date(),
): CareerSummary {
  const today = toYearMonth(now);
  const roles = getRoles(experiences, today);
  const oldestFirst = [...roles].sort(
    (a, b) => monthIndex(a.start) - monthIndex(b.start),
  );
  const firstStart = oldestFirst[0]?.start;
  const elapsed = firstStart ? monthIndex(today) - monthIndex(firstStart) : 0;
  const years = Math.max(0, Math.floor(elapsed / 12));

  const timeline: TimelineSegment[] = [];
  let cursor = firstStart ? monthIndex(firstStart) : 0;
  for (const role of oldestFirst) {
    const startIndex = monthIndex(role.start);
    const endIndex = monthIndex(role.end);
    if (startIndex > cursor) {
      timeline.push({
        kind: "gap",
        start: fromMonthIndex(cursor),
        end: fromMonthIndex(startIndex - 1),
        months: startIndex - cursor,
        offset: cursor - monthIndex(firstStart!),
      });
    }
    // Overlapping roles only extend the timeline past what is drawn.
    const drawFrom = Math.max(startIndex, cursor);
    if (endIndex >= drawFrom) {
      timeline.push({
        kind: "role",
        start: fromMonthIndex(drawFrom),
        end: role.end,
        months: endIndex - drawFrom + 1,
        offset: drawFrom - monthIndex(firstStart!),
        role,
      });
      cursor = endIndex + 1;
    }
  }
  // Between jobs (no "Present" role), the months since the last role are an
  // honest gap up to the build month.
  if (firstStart && cursor <= monthIndex(today)) {
    timeline.push({
      kind: "gap",
      start: fromMonthIndex(cursor),
      end: today,
      months: monthIndex(today) - cursor + 1,
      offset: cursor - monthIndex(firstStart),
    });
  }

  return {
    roles,
    current: roles.find((role) => role.current),
    firstStart,
    today,
    companies: new Set(roles.map((role) => role.companyName)).size,
    years,
    yearsLabel: `${years}+`,
    totalMonths: firstStart ? elapsed + 1 : 0,
    timeline,
  };
}

/** The Work app's headline numbers, computed from experiences.json. */
export function getWorkMetrics(summary: CareerSummary): WorkMetric[] {
  return [
    { value: summary.yearsLabel, label: "Years Experience" },
    { value: String(summary.companies), label: "Companies" },
  ];
}
