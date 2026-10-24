// Shared by the garden page and its root layout: the static params, the page
// a route param names (the home or a note), and the PageHead both build their
// metadata and JSON-LD from.
//
// One optional catch-all route serves the garden home (/garden/, no slug)
// and every note (/garden/<id>/). With output: "export", Next.js fails the
// build when a dynamic route's generateStaticParams returns nothing, and the
// garden is empty in every checkout and CI run without synced notes (it is
// gitignored). The home entry ({ slug: [] }) is always listed, so an empty
// garden still builds.
import { notFound } from "next/navigation";
import type { PageHead } from "@lib/head";
import { decodeParam, staticParams } from "@lib/static-params";
import { gardenHref, getGardenHome, getGardenNotes, type GardenNote } from "@utils/garden";

export type GardenParams = Promise<{ slug?: string[] }>;

export interface GardenPage {
  notes: GardenNote[];
  home?: GardenNote;
  /** The note shown; undefined on the garden home. */
  note?: GardenNote;
}

export async function getGardenParams() {
  const notes = await getGardenNotes();
  const home = getGardenHome(notes);
  return staticParams<{ slug: string[] }>([
    { slug: [] },
    ...notes.filter((note) => note !== home).map((note) => ({ slug: note.id.split("/") })),
  ]);
}

/** The garden home or the note a route param names (Thai ids may arrive encoded). */
export async function getGardenPage(params: GardenParams): Promise<GardenPage> {
  const notes = await getGardenNotes();
  const home = getGardenHome(notes);
  const { slug } = await params;
  if (!slug?.length) return { notes, home };
  const id = slug.map(decodeParam).join("/");
  const note = notes.find((entry) => entry.id === id && entry !== home);
  if (!note) notFound();
  return { notes, home, note };
}

/** The home's title: the vault home note's, or a default. */
export const gardenHomeTitle = (home?: GardenNote) => home?.data.title ?? "Digital Garden";

export function getGardenHead({ home, note }: GardenPage): PageHead {
  if (!note) {
    return {
      title: `${gardenHomeTitle(home)} | PePoDev Garden`,
      description: "PePoDev's digital garden: evolving notes on cloud, reliability, software, and business.",
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
