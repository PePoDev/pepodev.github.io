// Site constants - can be overridden by environment variables
const publicSiteLocale = import.meta.env.PUBLIC_SITE_LOCALE?.trim();

export const SITE_TITLE =
  import.meta.env.PUBLIC_SITE_TITLE ??
  "PePoDev - Interactive Desktop and Engineering Blog";
export const SITE_DESCRIPTION =
  import.meta.env.PUBLIC_SITE_DESCRIPTION ??
  "Site Reliability Engineer specializing in Kubernetes, Terraform, and cloud infrastructure. Building reliable platforms with open-source technologies.";
export const SITE_URL = import.meta.env.PUBLIC_SITE_URL ?? "https://pepo.dev";
export const SITE_LOCALE = publicSiteLocale || "en_US";
export const SITE_OG_IMAGE =
  import.meta.env.PUBLIC_SITE_OG_IMAGE ?? "/og-image.png";
export const SITE_OG_IMAGE_ALT =
  import.meta.env.PUBLIC_SITE_OG_IMAGE_ALT ??
  "PePoDev - Interactive Desktop and Engineering Blog";
