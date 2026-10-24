"use client";
// PLACEHOLDER: the White Noise app is not ported yet. Its track replaces this
// file with the React port of WhiteNoiseApp.astro, following the app contract in
// MIGRATION.md ("The React desktop"). Keep the path and the default export.
import type { AppProps } from "@components/desktop/app-api";
import { AppPlaceholder } from "@components/desktop/AppPlaceholder";

export default function WhiteNoiseApp(props: AppProps<"whitenoise">) {
  return <AppPlaceholder appId={props.appId} source="WhiteNoiseApp.astro" />;
}
