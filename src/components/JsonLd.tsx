import { scriptValue } from "./InlineScript";

/** A JSON-LD block; scriptValue escapes `<`, so the data cannot close the script. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptValue(data) }} />
  );
}
