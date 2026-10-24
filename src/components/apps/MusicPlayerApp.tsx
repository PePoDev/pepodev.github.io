"use client";
// PLACEHOLDER: the Music Player app is not ported yet. Its track replaces this
// file with the React port of MusicPlayerApp.astro, following the app contract in
// MIGRATION.md ("The React desktop"). Keep the path and the default export.
import type { AppProps } from "@components/desktop/app-api";
import { AppPlaceholder } from "@components/desktop/AppPlaceholder";

export default function MusicPlayerApp(props: AppProps<"music">) {
  return <AppPlaceholder appId={props.appId} source="MusicPlayerApp.astro" />;
}
