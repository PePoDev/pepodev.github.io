// PLACEHOLDER until the resume is ported from
// src/astro-legacy/pages/resume.astro (see MIGRATION.md).
import { buildMetadata } from "@lib/head";

export const generateMetadata = () =>
  buildMetadata({
    title: "Resume - Thiwanon Chomcharoen (PePo)",
    description:
      "Resume of Thiwanon Chomcharoen (PePo), a Site Reliability Engineer in Bangkok: experience, technical skills, education, and certifications, with a PDF download.",
    path: "/resume/",
  });

export default function ResumePage() {
  return (
    <main className="porting-placeholder">
      <h1>The resume is being ported to Next.js</h1>
      <p>
        Meanwhile, read the <a href="/blog/">blog</a>.
      </p>
    </main>
  );
}
