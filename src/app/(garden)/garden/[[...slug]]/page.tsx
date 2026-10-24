// PLACEHOLDER until the garden is ported from
// src/astro-legacy/pages/garden/ and src/layouts/GardenLayout.astro (see
// MIGRATION.md). It already exports every garden URL the sitemap lists.
//
// One optional catch-all route serves the garden home (/garden/, no slug)
// and every note (/garden/<id>/). With output: "export", Next.js fails the
// build when a dynamic route's generateStaticParams returns nothing, and the
// garden is empty in every checkout and CI run without synced notes (it is
// gitignored). The home entry ({ slug: [] }) is always listed, so an empty
// garden still builds; keep it that way when porting.
import { notFound } from "next/navigation";
import { buildMetadata, type PageHead } from "@lib/head";
import { decodeParam, staticParams } from "@lib/static-params";
import { gardenHref, getGardenHome, getGardenNotes, type GardenNote } from "@utils/garden";

type GardenParams = Promise<{ slug?: string[] }>;

// Only the notes that exist; anything else is the 404.
export const dynamicParams = false;

export async function generateStaticParams() {
  const notes = await getGardenNotes();
  const home = getGardenHome(notes);
  return staticParams<{ slug: string[] }>([
    { slug: [] },
    ...notes.filter((note) => note !== home).map((note) => ({ slug: note.id.split("/") })),
  ]);
}

/** The garden home (note undefined) or the note a route param names. */
async function getPage(params: GardenParams) {
  const notes = await getGardenNotes();
  const home = getGardenHome(notes);
  const { slug } = await params;
  if (!slug?.length) return { home, note: undefined };
  const id = slug.map(decodeParam).join("/");
  const note = notes.find((entry) => entry.id === id && entry !== home);
  if (!note) notFound();
  return { home, note };
}

function getHead({ home, note }: { home?: GardenNote; note?: GardenNote }): PageHead {
  if (!note) {
    return {
      title: `${home?.data.title ?? "Digital Garden"} | PePoDev Garden`,
      description:
        "PePoDev's digital garden: evolving notes on cloud, reliability, software, and business.",
      path: "/garden/",
    };
  }
  return {
    title: `${note.data.title} | PePoDev Garden`,
    description: `${note.data.title}: notes from PePoDev's digital garden.`,
    path: gardenHref(note),
    type: "article",
  };
}

export async function generateMetadata({ params }: { params: GardenParams }) {
  return buildMetadata(getHead(await getPage(params)));
}

export default async function GardenPage({ params }: { params: GardenParams }) {
  const { note } = await getPage(params);
  return (
    <main className="porting-placeholder">
      <h1>{note ? note.data.title : "The garden is being ported to Next.js"}</h1>
      <p>
        {note ? "This garden note is being ported to Next.js. " : ""}
        Meanwhile, read the <a href="/blog/">blog</a>.
      </p>
    </main>
  );
}
