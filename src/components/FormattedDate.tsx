/** A date as "Jan 14, 2024" in UTC, whatever the build machine's time zone. */
export function FormattedDate({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()}>
      {date.toLocaleDateString("en-us", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })}
    </time>
  );
}
