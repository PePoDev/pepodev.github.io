// Site constants - can be overridden by environment variables
export const SITE_TITLE =
  import.meta.env.PUBLIC_SITE_TITLE ??
  "PePoDev - Interactive SRE Desktop Portfolio and Blog";
export const SITE_DESCRIPTION =
  import.meta.env.PUBLIC_SITE_DESCRIPTION ??
  "Site Reliability Engineer specializing in Kubernetes, Terraform, and cloud infrastructure. Building reliable platforms with open-source technologies.";
export const SITE_URL = import.meta.env.PUBLIC_SITE_URL ?? "https://pepo.dev";
export const SITE_OG_IMAGE =
  import.meta.env.PUBLIC_SITE_OG_IMAGE ?? "/og-image.png";
export const SITE_OG_IMAGE_ALT =
  import.meta.env.PUBLIC_SITE_OG_IMAGE_ALT ??
  "PePoDev wordmark on a dark SRE-inspired background";
