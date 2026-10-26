// The garden's note tree in the sidebar: vault folders as <details>, notes as
// links. data-note holds the folder path and title in lower case for the
// sidebar filter (GardenScripts.tsx), and data-open marks the folders open by
// default, which the filter restores when it is cleared.
import { type GardenFolder, gardenHref, type GardenNote } from "@utils/garden";

function NoteItem({ note, current, path }: { note: GardenNote; current?: string; path: string[] }) {
  return (
    <li data-note={[...path, note.data.title].join(" ").toLowerCase()}>
      <a href={gardenHref(note)} aria-current={note.id === current ? "page" : undefined}>
        {note.data.title}
      </a>
    </li>
  );
}

export function GardenTree({
  folder,
  current,
  path = [],
}: {
  folder: GardenFolder;
  /** Id of the note being shown; undefined on the garden home. */
  current?: string;
  path?: string[];
}) {
  // The folder's own note (AWS/AWS) leads, ahead of subfolders.
  const lead = folder.notes.filter((note) => note.data.title === folder.name);
  const rest = folder.notes.filter((note) => !lead.includes(note));
  return (
    <ul className="garden-tree">
      {lead.map((note) => (
        <NoteItem key={note.id} note={note} current={current} path={path} />
      ))}
      {folder.folders.map((child) => {
        // Open the current note's folders; on the garden home, the top level.
        const open = current === undefined ? path.length === 0 : child.ids.has(current);
        return (
          <li key={child.name}>
            <details open={open} data-open={open ? "" : undefined}>
              <summary>{child.name}</summary>
              <GardenTree folder={child} current={current} path={[...path, child.name]} />
            </details>
          </li>
        );
      })}
      {rest.map((note) => (
        <NoteItem key={note.id} note={note} current={current} path={path} />
      ))}
    </ul>
  );
}
