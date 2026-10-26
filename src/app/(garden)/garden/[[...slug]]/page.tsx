// The garden home (/garden/: the vault's home note and the recently tended
// notes) and every note (/garden/<id>/: breadcrumbs, the note, backlinks).
// Notes come only from `pnpm garden:sync` (src/utils/garden.ts); see
// garden-data.ts for why both live in one optional catch-all route.
import { FormattedDate } from "@components/FormattedDate";
import { GardenShell } from "@components/garden/GardenShell";
import { render } from "@lib/content";
import { buildMetadata } from "@lib/head";
import { buildGardenTree, gardenHref, getBacklinks, getBreadcrumbs, getRecentlyTended } from "@utils/garden";
import {
  type GardenPage,
  type GardenParams,
  gardenHomeTitle,
  getGardenHead,
  getGardenPage,
  getGardenParams,
} from "./garden-data";

// Only the notes that exist; anything else is the 404.
export const dynamicParams = false;

export const generateStaticParams = getGardenParams;

export async function generateMetadata({ params }: { params: GardenParams }) {
  return buildMetadata(getGardenHead(await getGardenPage(params)));
}

async function GardenHome({ notes, home }: GardenPage) {
  const recent = getRecentlyTended(notes, 8);
  const Content = home ? (await render(home)).Content : undefined;
  return (
    <GardenShell>
      <h1 className="garden-title">{gardenHomeTitle(home)}</h1>{" "}
      <div className="prose">{Content ? <Content /> : <p>No notes have been planted yet.</p>}</div>{" "}
      {recent.length > 0 && (
        <section className="garden-recent" aria-labelledby="garden-recent-title">
          <h2 id="garden-recent-title">Recently tended</h2>{" "}
          <ul>
            {recent.map((note) => (
              <li key={note.id}>
                <a href={gardenHref(note)}>{note.data.title}</a> <span>{note.data.folders.join(" / ")}</span>{" "}
                {note.data.updated && <FormattedDate date={note.data.updated} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </GardenShell>
  );
}

async function GardenNotePage({ notes, note }: GardenPage & { note: NonNullable<GardenPage["note"]> }) {
  const { Content, headings } = await render(note);
  const backlinks = getBacklinks(note, notes);
  const crumbs = getBreadcrumbs(note, buildGardenTree(notes));
  const { title, updated } = note.data;
  return (
    <GardenShell current={note.id} headings={headings}>
      <article>
        <nav className="garden-breadcrumbs" aria-label="Breadcrumb">
          <ol>
            <li>
              <a href="/garden/">Garden</a>
            </li>
            {/* Keyed by position: a folder name can repeat along the path. */}
            {crumbs.map(({ name, href }, index) => (
              <li key={index}>{href ? <a href={href}>{name}</a> : name}</li>
            ))}
          </ol>
        </nav>{" "}
        <h1 className="garden-title">{title}</h1>{" "}
        {updated && (
          <p className="garden-meta">
            Last tended <FormattedDate date={updated} />
          </p>
        )}{" "}
        <div className="prose">
          {note.body.trim() ? (
            <Content />
          ) : (
            <p className="garden-seed">This note is still a seed. Nothing has grown here yet.</p>
          )}
        </div>{" "}
        {backlinks.length > 0 && (
          <section className="garden-backlinks" aria-labelledby="garden-backlinks-title">
            <h2 id="garden-backlinks-title">Linked from</h2>{" "}
            <ul>
              {backlinks.map((link) => (
                <li key={link.id}>
                  <a href={gardenHref(link)}>{link.data.title}</a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </GardenShell>
  );
}

export default async function GardenRoute({ params }: { params: GardenParams }) {
  const page = await getGardenPage(params);
  return page.note ? <GardenNotePage {...page} note={page.note} /> : <GardenHome {...page} />;
}
