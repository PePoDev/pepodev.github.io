import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: ({ image }) =>
    z.object({
      // Support both new format and legacy Obsidian format
      title: z.string().optional(),
      description: z.string().optional(),
      pubDate: z.coerce.date().optional(),
      updatedDate: z.coerce.date().optional(),
      heroImage: z.optional(image()),
      // Legacy Obsidian fields
      "url-slug": z.string().optional(),
      "sub-title": z.string().optional(),
      "cover-picture": z.string().optional(),
      publish: z.boolean().optional(),
      "dg-publish": z.boolean().optional(),
    }),
});

export const collections = { blog };
