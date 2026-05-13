// Site constants - can be overridden by environment variables
export const SITE_TITLE =
  import.meta.env.PUBLIC_SITE_TITLE ?? "PePoDev | Portfolio";
export const SITE_DESCRIPTION =
  import.meta.env.PUBLIC_SITE_DESCRIPTION ??
  "Site Reliability Engineer specializing in Kubernetes, Terraform, and cloud infrastructure. Building reliable platforms with open-source technologies.";
export const SITE_URL = import.meta.env.PUBLIC_SITE_URL ?? "https://pepo.dev";
