import type { Education } from "../types/data";

/** "Bachelor of Science, Computer Science" */
export function formatDegree({ degree, field }: Education): string {
  return `${degree}, ${field}`;
}

/** "B.Sc. Computer Science" */
export function formatDegreeShort({ degreeShort, field }: Education): string {
  return `${degreeShort} ${field}`;
}

/** "2016 - 2020" by default; pass "–" for typeset ranges. */
export function formatEducationYears(
  { startYear, endYear }: Education,
  separator = " - ",
): string {
  return `${startYear}${separator}${endYear}`;
}
