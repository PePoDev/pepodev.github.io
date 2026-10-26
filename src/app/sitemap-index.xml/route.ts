// /sitemap-index.xml (robots.txt points here).
import { SITE_URL } from "@/consts";
import { escapeXml as x, xmlResponse } from "@lib/xml";

export const dynamic = "force-static";

export function GET() {
  return xmlResponse(
    '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      `<sitemap><loc>${x(new URL("sitemap-0.xml", SITE_URL).href)}</loc></sitemap></sitemapindex>`,
  );
}
