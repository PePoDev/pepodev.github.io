import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: ({ image }) =>
    z.object({
      // Required on every post; Obsidian edits them as properties alongside
      // the legacy fields below.
      title: z.string(),
      description: z.string().optional(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: z.optional(image()),
      tags: z.array(z.string()).optional(),
      // Legacy Obsidian fields
      "url-slug": z.string().optional(),
      "sub-title": z.string().optional(),
      "cover-picture": z.optional(image()),
      publish: z.boolean().optional(),
      "dg-publish": z.boolean().optional(),
    }),
});

export const collections = { blog };
