"use client";
// PLACEHOLDER: the Calculator app is not ported yet. Its track replaces this
// file with the React port of CalculatorApp.astro, following the app contract in
// MIGRATION.md ("The React desktop"). Keep the path and the default export.
import type { AppProps } from "@components/desktop/app-api";
import { AppPlaceholder } from "@components/desktop/AppPlaceholder";

export default function CalculatorApp(props: AppProps<"calculator">) {
  return <AppPlaceholder appId={props.appId} source="CalculatorApp.astro" />;
}
