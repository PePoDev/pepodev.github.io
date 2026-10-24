"use client";
// PLACEHOLDER: the Certifications app is not ported yet. Its track replaces this
// file with the React port of CertificationsWalletApp.astro, following the app contract in
// MIGRATION.md ("The React desktop"). Keep the path and the default export.
import type { AppProps } from "@components/desktop/app-api";
import { AppPlaceholder } from "@components/desktop/AppPlaceholder";

export default function CertificationsWalletApp(props: AppProps<"certs">) {
  return <AppPlaceholder appId={props.appId} source="CertificationsWalletApp.astro" />;
}
