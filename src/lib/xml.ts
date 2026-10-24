/** Escapes text and attribute values for XML (the five predefined entities). */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A static XML response for a route handler. */
export function xmlResponse(body: string, contentType = "application/xml"): Response {
  return new Response(body, { headers: { "Content-Type": `${contentType}; charset=utf-8` } });
}
