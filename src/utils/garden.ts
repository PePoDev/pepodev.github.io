import { type CollectionEntry, getCollection } from "astro:content";

export type GardenNote = CollectionEntry<"garden">;

export interface GardenFolder {
  name: string;
  folders: GardenFolder[];
  notes: GardenNote[];
  /** Ids of every note at or below this folder. */
  ids: Set<string>;
}

const HOME_ID = "index";
const byName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/** Every synced note; the home note is the one with id `index`. */
export async function getGardenNotes(): Promise<GardenNote[]> {
  return getCollection("garden");
}

export const getGardenHome = (notes: GardenNote[]) =>
  notes.find((note) => note.id === HOME_ID);

export const gardenHref = (note: GardenNote) =>
  note.id === HOME_ID ? "/garden/" : `/garden/${note.id}/`;

/** Notes that link here, by title. */
export const getBacklinks = (note: GardenNote, notes: GardenNote[]) =>
  notes
    .filter((other) => other.id !== note.id && other.data.links.includes(note.id))
    .sort((a, b) => byName(a.data.title, b.data.title));

/** Most recently edited notes first; notes without a date go last. */
export const getRecentlyTended = (notes: GardenNote[], count: number) =>
  notes
    .filter((note) => note.id !== HOME_ID)
    .sort(
      (a, b) =>
        (b.data.updated?.valueOf() ?? 0) - (a.data.updated?.valueOf() ?? 0),
    )
    .slice(0, count);

/** Vault folders as a tree, folders and notes sorted by name. */
export function buildGardenTree(notes: GardenNote[]): GardenFolder {
  const root: GardenFolder = { name: "", folders: [], notes: [], ids: new Set() };
  for (const note of notes) {
    if (note.id === HOME_ID) continue;
    let folder = root;
    folder.ids.add(note.id);
    for (const name of note.data.folders) {
      let child = folder.folders.find((f) => f.name === name);
      if (!child) {
        child = { name, folders: [], notes: [], ids: new Set() };
        folder.folders.push(child);
      }
      folder = child;
      folder.ids.add(note.id);
    }
    folder.notes.push(note);
  }
  const sort = (folder: GardenFolder) => {
    folder.folders.sort((a, b) => byName(a.name, b.name)).forEach(sort);
    folder.notes.sort((a, b) => byName(a.data.title, b.data.title));
  };
  sort(root);
  return root;
}

/** The note named after a folder (folder-notes plugin), when it is published. */
export const getFolderNote = (folder: GardenFolder) =>
  folder.notes.find((note) => note.data.title === folder.name);

/** A note's folders, each linking to its folder note when there is one. */
export function getBreadcrumbs(note: GardenNote, tree: GardenFolder) {
  let folder = tree;
  return note.data.folders.map((name) => {
    folder = folder.folders.find((child) => child.name === name) ?? folder;
    const folderNote = getFolderNote(folder);
    const href =
      folderNote && folderNote.id !== note.id ? gardenHref(folderNote) : undefined;
    return { name, href };
  });
}
