// PLACEHOLDER until the desktop and website mode are ported from
// src/astro-legacy/pages/index.astro (see MIGRATION.md).
import { SITE_DESCRIPTION, SITE_TITLE } from "@/consts";
import { buildMetadata } from "@lib/head";

export const generateMetadata = () =>
  buildMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: "/" });

export default function HomePage() {
  return (
    <main className="porting-placeholder">
      <h1>The desktop is being ported to Next.js</h1>
      <p>
        This page will hold the interactive desktop and website mode. Meanwhile, read the{" "}
        <a href="/blog/">blog</a>.
      </p>
    </main>
  );
}
