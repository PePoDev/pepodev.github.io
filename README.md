# Personal Portfolio Website

A modern, responsive personal portfolio website built with [Astro](https://astro.build), featuring a bento grid home page, full blog system with markdown support, and optimized performance.

## ✨ Features

- **Bento Grid Home**: Modern asymmetric grid layout with 9 interactive cards
- **Blog System**: Full-featured blog with markdown support and Content Collections
- **Fully Responsive**: Optimized for all devices from mobile to desktop
- **SEO Optimized**: Complete meta tags, Open Graph, and Twitter Card support
- **Fast Performance**: Static site generation with Astro for optimal loading speeds
- **Dark Mode Support**: Automatically adapts to system color scheme preferences
- **Accessible**: Built with accessibility best practices (WCAG compliant)
- **Type-safe**: TypeScript and Zod schema validation

## 📄 Pages

- **Home**: Bento grid layout with introduction, stats, and quick links
- **About**: Personal background, skills showcase, experience timeline
- **Blog**: Full blog system with posts, tags, and filtering
- **Projects**: Portfolio of projects with descriptions and links
- **Contact**: Contact form and contact information

---

## 🚀 Quick Start (5 Minutes)

### Installation

```bash
# 1. Install pnpm globally (if not installed)
npm install -g pnpm

# 2. Install dependencies
pnpm install

# 3. Start development server
pnpm dev
```

Visit `http://localhost:4321` in your browser.

### Essential Customizations

#### 1. Update Personal Info (5 minutes)

**Home Page** - [`src/pages/index.astro`](src/pages/index.astro:16)

- Line 16: Change "Your Name" to your actual name
- Line 17: Update your title/role
- Lines 44-49: Update tech stack tags
- Lines 57-62: Update experience stats
- Line 79: Update location

**About Page** - [`src/pages/about.astro`](src/pages/about.astro:10)

- Lines 10-17: Update skills array
- Lines 27-45: Replace bio with your story
- Lines 60-110: Update experience timeline

**Contact** - [`src/pages/contact.astro`](src/pages/contact.astro:130)

- Line 130: Update email address
- Line 140: Update phone number
- Line 150: Update location

#### 2. Update Colors (2 minutes)

Edit [`src/styles/global.css`](src/styles/global.css:3) lines 3-5:

```css
--color-primary: #2563eb; /* Your brand color */
--color-secondary: #7c3aed; /* Accent color */
```

#### 3. Add Your Projects (10 minutes)

Edit [`src/pages/projects.astro`](src/pages/projects.astro:7) starting at line 7:

- Replace sample projects with your actual projects
- Update titles, descriptions, tags, and links
- Add project images to `public/` folder

#### 4. Write Your First Blog Post (5 minutes)

Create `src/content/blog/my-first-post.md`:

```markdown
---
title: "My First Blog Post"
description: "Welcome to my blog!"
pubDate: 2024-03-15
tags: ["introduction"]
---

# Welcome to My Blog

This is my first post. I'll be sharing my thoughts on web development...
```

#### 5. Update Social Links (3 minutes)

Update in both:

- [`src/components/Footer.astro`](src/components/Footer.astro:30) - Lines 30-51
- [`src/pages/contact.astro`](src/pages/contact.astro:156) - Lines 156-178

### Build & Deploy

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview

# Deploy the dist/ folder to:
# - Netlify, Vercel, GitHub Pages, or any static host
```

---

## 📝 Blog System Guide

### How It Works

The blog system uses Astro's Content Collections API to:

- Store blog posts as Markdown files in `src/content/blog/`
- Automatically generate pages for each post
- Provide type-safe frontmatter validation
- Create tag-based filtering
- Sort posts by publication date

### Creating a New Blog Post

**Step 1: Create a Markdown File**

Create a new `.md` file in `src/content/blog/`:

```bash
src/content/blog/my-awesome-post.md
```

The filename becomes the URL slug: `/blog/my-awesome-post`

**Step 2: Add Frontmatter**

Every blog post requires frontmatter at the top:

```markdown
---
title: "My Awesome Post"
description: "A brief description for SEO and previews"
pubDate: 2024-03-15
author: "Your Name"
image:
  url: "https://example.com/image.jpg"
  alt: "Image description"
tags: ["javascript", "tutorial"]
draft: false
---

# Your Content Here

Write your blog post content in Markdown...
```

**Step 3: Write Your Content**

Use standard Markdown syntax:

```markdown
## Headings and Subheadings

Regular **bold** and _italic_ text.

- Bullet lists
- Are supported

1. Numbered lists
2. Work too

[Links](https://example.com)
![Images](path/to/image.jpg)

`Inline code` and code blocks:

\`\`\`javascript
const example = 'Hello, World!';
console.log(example);
\`\`\`

> Blockquotes are available
```

### Frontmatter Fields

| Field         | Type    | Required | Description                           |
| ------------- | ------- | -------- | ------------------------------------- |
| `title`       | string  | ✅ Yes   | Post title                            |
| `description` | string  | ✅ Yes   | SEO description                       |
| `pubDate`     | date    | ✅ Yes   | Publication date (YYYY-MM-DD)         |
| `author`      | string  | ❌ No    | Author name (defaults to 'Your Name') |
| `updatedDate` | date    | ❌ No    | Last update date                      |
| `image.url`   | string  | ❌ No    | Featured image URL                    |
| `image.alt`   | string  | ❌ No    | Image alt text                        |
| `tags`        | array   | ❌ No    | Array of tag strings                  |
| `draft`       | boolean | ❌ No    | Hide post if true (default: false)    |

### Blog URLs

The blog automatically generates these pages:

- **Blog listing**: `/blog`
- **Individual posts**: `/blog/{slug}` (e.g., `/blog/my-awesome-post`)
- **Tag pages**: `/blog/tag/{tagname}` (e.g., `/blog/tag/javascript`)

### Using Tags

Organize your content with tags:

```markdown
---
tags: ["javascript", "react", "tutorial"]
---
```

- Tag pages are automatically generated
- Clicking a tag shows all posts with that tag
- Tags appear on listing and individual post pages

### Draft Posts

Hide posts from production:

```markdown
---
title: "Work in Progress"
draft: true
---
```

Draft posts won't appear in production builds.

### Blog Tips & Best Practices

**1. Use Descriptive Titles**

- Good: "10 TypeScript Tips for Better Code Quality"
- Bad: "TypeScript Tips"

**2. Write Compelling Descriptions**

- Keep descriptions 120-160 characters for optimal SEO

**3. Choose Relevant Tags**

- Use 2-5 tags per post
- Keep tags consistent across posts
- Use lowercase for better URLs

**4. Optimize Images**

- Use 1200x630px for featured images
- Include descriptive alt text
- Consider CDN or image optimization

**5. Update Dates**

```markdown
---
pubDate: 2024-01-15
updatedDate: 2024-03-20
---
```

### Customizing the Blog

**Change Post Layout** - [`src/layouts/BlogPostLayout.astro`](src/layouts/BlogPostLayout.astro)

- Modify header design
- Change typography
- Add author bio
- Include related posts
- Add comments

**Modify Blog Listing** - [`src/pages/blog/index.astro`](src/pages/blog/index.astro)

- Change grid layout
- Add search functionality
- Include pagination
- Modify card design

**Update Styling** - CSS classes:

- `.prose` - Content styling
- `.post-card` - Blog card
- `.tag` - Tag badges
- `.post-header` - Post header

---

## 🎨 Full Customization Guide

### 1. Home Page Bento Grid

The home page features 9 cards in an asymmetric grid:

1. **Hero Card** (2x2) - Name and introduction
2. **About Card** - Quick bio link
3. **Tech Stack** - Technology tags
4. **Stats** - Experience metrics
5. **Projects** - Work preview
6. **Location** - Where you're based
7. **Social** - Connect buttons
8. **Quote** - Inspirational quote
9. **Status** - Availability indicator

Customize in [`src/pages/index.astro`](src/pages/index.astro).

### 2. About Page

Update:

- Personal bio and story
- Skills array with percentages
- Experience and education timeline
- Core values section

Edit [`src/pages/about.astro`](src/pages/about.astro).

### 3. Projects Page

Replace sample projects with your work:

- Project data starting at line 7
- Titles, descriptions, and tags
- Demo and GitHub links
- Project images

Edit [`src/pages/projects.astro`](src/pages/projects.astro).

### 4. Contact Page

Update contact information:

- Email, phone, location
- Social media links
- Form behavior (add backend if needed)

Edit [`src/pages/contact.astro`](src/pages/contact.astro).

### 5. Colors and Branding

All design tokens in [`src/styles/global.css`](src/styles/global.css):

```css
:root {
  /* Colors */
  --color-primary: #2563eb;
  --color-secondary: #7c3aed;
  --color-accent: #f59e0b;

  /* Spacing */
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;

  /* Other design tokens... */
}
```

### 6. Assets

- **Favicon**: Replace `public/favicon.svg`
- **OG Image**: Add `public/og-image.jpg` (1200x630px)
- **Touch Icon**: Add `public/apple-touch-icon.png` (180x180px)

### 7. SEO

Update in [`astro.config.mjs`](astro.config.mjs):

```javascript
export default defineConfig({
  site: "https://yourdomain.com",
  // ...
});
```

Default SEO in [`src/layouts/BaseLayout.astro`](src/layouts/BaseLayout.astro).

---

## 📁 Project Structure

```
├── public/              # Static assets
│   └── favicon.svg
├── src/
│   ├── components/      # Reusable components
│   │   ├── Header.astro
│   │   └── Footer.astro
│   ├── content/         # Content Collections
│   │   ├── config.ts    # Schemas
│   │   └── blog/        # 📝 Blog posts (Markdown)
│   ├── layouts/         # Page layouts
│   │   ├── BaseLayout.astro
│   │   └── BlogPostLayout.astro
│   ├── pages/           # Routes
│   │   ├── index.astro       # Home (bento grid)
│   │   ├── about.astro       # About
│   │   ├── projects.astro    # Projects
│   │   ├── contact.astro     # Contact
│   │   └── blog/
│   │       ├── index.astro        # Blog listing
│   │       ├── [slug].astro       # Blog posts
│   │       └── tag/[tag].astro    # Tag pages
│   └── styles/
│       └── global.css
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## 🎯 Key Technologies

- **[Astro](https://astro.build)** v4.15 - Static site generator
- **Content Collections** - Type-safe content management
- **TypeScript** - Type safety
- **Zod** - Schema validation
- **pnpm** - Fast package manager

## 🌐 Deployment

### Build Commands

```bash
# Production build
pnpm build

# Preview build locally
pnpm preview
```

### Deployment Platforms

**Netlify**

```bash
pnpm build
# Deploy dist/ folder
```

**Vercel**

```bash
pnpm build
# Deploy dist/ folder
```

**GitHub Pages**

1. Update `astro.config.mjs` with repository name
2. Add GitHub Actions workflow
3. Push to GitHub

**Others**
Deploy the `dist/` folder to any static hosting service.

## 🐛 Troubleshooting

### Development server not starting

- Ensure Node.js 18+ is installed
- Delete `node_modules/` and `pnpm-lock.yaml`
- Run `pnpm install` again
- Check if port 4321 is available

### Styles not loading

- Clear browser cache
- Restart dev server
- Check browser console for errors

### TypeScript errors

- Run `pnpm install`
- Run `pnpm build` to generate Content Collection types
- Check `tsconfig.json`

### Blog posts not showing

- Ensure posts are in `src/content/blog/`
- Check that `draft: false` or omit draft field
- Run `pnpm build` to regenerate types
- Verify frontmatter matches schema in `src/content/config.ts`

## 📝 Adding New Content

### New Page

1. Create `.astro` file in `src/pages/`
2. Use `BaseLayout`
3. Add to navigation in `src/components/Header.astro`
4. Add to footer in `src/components/Footer.astro`

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="New Page" description="Description">
  <section class="section">
    <div class="container">
      <h1>New Page</h1>
      <p>Your content here</p>
    </div>
  </section>
</BaseLayout>
```

### New Blog Post

1. Create `.md` file in `src/content/blog/`
2. Add required frontmatter
3. Write content in Markdown
4. Build or restart dev server

Example:

```markdown
---
title: "Building Better Web Apps"
description: "Tips for modern web development"
pubDate: 2024-03-20
tags: ["web development", "tips"]
image:
  url: "/images/blog/web-apps.jpg"
  alt: "Web development"
---

# Building Better Web Apps

Content goes here...

## Section 1

More content...
```

## 🛠️ Advanced Blog Features

### Adding Reading Time

Modify [`src/layouts/BlogPostLayout.astro`](src/layouts/BlogPostLayout.astro) to calculate and display reading time.

### Adding Related Posts

Filter posts by shared tags to show related content at the end of each post.

### Adding Comments

Integrate a comment system:

- **Giscus** - GitHub Discussions
- **Utterances** - GitHub Issues
- **Disqus** - Traditional comments

### Adding RSS Feed

Create `src/pages/rss.xml.js`:

```javascript
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const posts = await getCollection("blog");
  return rss({
    title: "Your Blog",
    description: "Your blog description",
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/blog/${post.slug}/`,
    })),
  });
}
```

## 📚 Learn More

### Documentation

- [Astro Documentation](https://docs.astro.build)
- [Content Collections Guide](https://docs.astro.build/en/guides/content-collections/)
- [Markdown Guide](https://www.markdownguide.org/)

### Community

- [Astro Discord](https://astro.build/chat)
- [Astro GitHub](https://github.com/withastro/astro)

### Resources

- [CSS Variables Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [Writing Great Blog Posts](https://www.grammarly.com/blog/how-to-write-a-blog-post/)

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Built with [Astro](https://astro.build)
- Icons from [Heroicons](https://heroicons.com)
- Inspired by modern portfolio designs

---

## 🎉 What's Included

### Build Output

Running `pnpm build` generates **16 static pages**:

- 4 main pages (Home, About, Projects, Contact)
- 1 blog listing page
- 3 blog post pages
- 8 auto-generated tag filter pages

### File Highlights

- ✅ Responsive navigation with mobile menu
- ✅ Bento grid home page (9 interactive cards)
- ✅ Type-safe blog with Content Collections
- ✅ SEO meta tags on all pages
- ✅ Dark mode support
- ✅ Accessibility features
- ✅ Clean, commented code

---

**Ready to launch?** Customize the content, update your information, and deploy to production! 🚀
