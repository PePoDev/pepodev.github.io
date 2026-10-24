// generateStaticParams helpers for routes whose params can hold non-ASCII
// text (Thai post ids, garden note paths).
//
// `next build` writes each param set as given: out/blog/<Thai id>/index.html,
// like the Astro build. `next dev` (with output: "export") checks a request's
// percent-encoded path against those params and rejects raw non-ASCII ones,
// so in development the encoded form is listed as well. Pages must decode
// what they receive (decodeParam).

type Params = Record<string, string | string[]>;

const encode = (value: string | string[]) =>
  Array.isArray(value) ? value.map(encodeURIComponent) : encodeURIComponent(value);

/** The static params, plus their percent-encoded twins under `next dev`. */
export function staticParams<P extends Params>(params: P[]): P[] {
  if (process.env.NODE_ENV !== "development") return params;
  const encoded = params.map(
    (set) => Object.fromEntries(Object.entries(set).map(([key, value]) => [key, encode(value)])) as P,
  );
  const seen = new Set<string>();
  return [...params, ...encoded].filter((set) => {
    const key = JSON.stringify(set);
    return !seen.has(key) && seen.add(key);
  });
}

/** A route param as text, whether Next.js passed it encoded or not. */
export function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
