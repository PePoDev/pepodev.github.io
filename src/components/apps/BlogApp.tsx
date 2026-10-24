"use client";
// Blog - Articles (port of BlogApp.astro): the article list and a reader
// that loads each article's body on demand from /blog/<id>/article.json
// (loadBlogArticle), so the home page carries list metadata only.
//
// README rules: every article opens at its title with focus on Back, from
// the list or a ?blog= link (an unknown slug leaves the list open with
// focus on its first item and the desktop shows "Article not found"); Back
// restores the list position and focuses the article's item; closing the
// window resets the list; links in articles open in a new tab.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  loadBlogArticle,
  showToast,
  useAppWindow,
  useDeepLinkHandler,
  type AppProps,
} from "@components/desktop/app-api";

type ArticleState = { status: "loading" } | { status: "ready"; html: string } | { status: "error" };

/** What the window shows: the list (slug null) or one article, and where focus goes. */
interface View {
  slug: string | null;
  /** The element to focus once the view is shown: the article's Back button, or a list item. */
  focus: { kind: "back" } | { kind: "item"; slug: string } | null;
  /** Bumped on every navigation, so the view's scroll and focus apply even when it did not change. */
  nav: number;
}

/**
 * The article's links open in a new tab, so the desktop never navigates
 * away: every http(s) link except one to a spot on this page.
 */
function prepareArticleHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    const url = new URL(link.getAttribute("href") ?? "", window.location.href);
    const samePage = url.origin === window.location.origin && url.pathname === window.location.pathname;
    if (!/^https?:$/.test(url.protocol) || samePage) return;
    link.setAttribute("target", "_blank");
    link.relList.add("noopener", "noreferrer");
  });
  return template.innerHTML;
}

function withoutArticle(articles: Record<string, ArticleState>, id: string) {
  const next = { ...articles };
  delete next[id];
  return next;
}

function shareArticle(slug: string) {
  const url = `${window.location.origin}${window.location.pathname}?blog=${encodeURIComponent(slug)}`;
  navigator.clipboard
    .writeText(url)
    .then(() => showToast("Link copied to clipboard!", { duration: 3000 }))
    .catch((error) => {
      console.error("Failed to copy link:", error);
      showToast("Failed to copy link", { duration: 3000 });
    });
}

export default function BlogApp({ data: posts }: AppProps<"blog">) {
  const { open } = useAppWindow();
  const [view, setView] = useState<View>({ slug: null, focus: null, nav: 0 });
  const [articles, setArticles] = useState<Record<string, ArticleState>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  // Where the list was scrolled when an article opened.
  const listScrollTop = useRef(0);
  // The view on screen (the last one committed).
  const shownView = useRef(view);
  const reading = view.slug !== null;

  // The list and the reader share the window's scroller.
  const scroller = useCallback(() => rootRef.current?.closest<HTMLElement>(".window-content") ?? null, []);
  // A list item, or an article's Back button, by its post id.
  const listItem = useCallback(
    (slug: string) =>
      rootRef.current?.querySelector<HTMLButtonElement>(`.blog-item[data-blog-slug="${CSS.escape(slug)}"]`) ?? null,
    [],
  );
  const backButton = useCallback(
    (slug: string) =>
      rootRef.current?.querySelector<HTMLButtonElement>(
        `.blog-post-panel[data-blog-slug="${CSS.escape(slug)}"] .blog-reader-back`,
      ) ?? null,
    [],
  );

  const openArticle = useCallback(
    (slug: string) => {
      const content = scroller();
      if (content && shownView.current.slug === null) listScrollTop.current = content.scrollTop;
      // An article whose load failed loads again (loadBlogArticle retries a failed fetch).
      setArticles((current) => (current[slug]?.status === "error" ? withoutArticle(current, slug) : current));
      setView((current) => ({ slug, focus: { kind: "back" }, nav: current.nav + 1 }));
    },
    [scroller],
  );

  // Back returns to where the list was (and to the article's item); closing
  // the window resets it.
  const showList = useCallback((restoreScroll: boolean, focusSlug: string | null = null) => {
    if (!restoreScroll) listScrollTop.current = 0;
    setView((current) => ({
      slug: null,
      focus: focusSlug ? { kind: "item", slug: focusSlug } : null,
      nav: current.nav + 1,
    }));
  }, []);

  // Each view sets its own scroll position (every article opens at its
  // title), then focus follows it, so the keyboard never drops to the page.
  // Neither focus scrolls.
  useLayoutEffect(() => {
    shownView.current = view;
    if (view.nav === 0) return;
    const content = scroller();
    if (content) content.scrollTop = view.slug ? 0 : listScrollTop.current;
    const target =
      view.focus?.kind === "back" && view.slug
        ? backButton(view.slug)
        : view.focus?.kind === "item"
          ? listItem(view.focus.slug)
          : null;
    target?.focus({ preventScroll: true });
  }, [view, scroller, backButton, listItem]);

  useEffect(() => {
    if (!open) showList(false);
  }, [open, showList]);

  // ?blog=<slug> links (the desktop calls this once the app has mounted).
  useDeepLinkHandler((slug) => {
    if (!posts.some((post) => post.id === slug)) {
      if (posts.length) listItem(posts[0].id)?.focus({ preventScroll: true });
      return false;
    }
    openArticle(slug);
    return true;
  });

  // The open article's body loads once per page. A failed load shows "Try
  // again", and opening the article again also retries it.
  const article = view.slug ? articles[view.slug] : undefined;
  useEffect(() => {
    const id = view.slug;
    if (!id || article) return;
    setArticles((current) => (current[id] ? current : { ...current, [id]: { status: "loading" } }));
    loadBlogArticle(id).then(
      ({ html }) => {
        const prepared = prepareArticleHtml(html);
        setArticles((current) => ({ ...current, [id]: { status: "ready", html: prepared } }));
      },
      (error) => {
        console.error(error);
        setArticles((current) => ({ ...current, [id]: { status: "error" } }));
      },
    );
  }, [view.slug, article]);

  // "Try again" goes away as it is pressed, so focus moves to Back first
  // (where an article's focus starts) rather than dropping to the page.
  const retry = (id: string) => {
    backButton(id)?.focus({ preventScroll: true });
    setArticles((current) => withoutArticle(current, id));
  };

  return (
    <div ref={rootRef} className="app-content" data-blog-app="">
      <div className="terminal-heading" data-blog-terminal="">
        <span className="prompt">~/blog $</span>{" "}
        <span data-blog-command="">{view.slug ? `cat articles/${view.slug}` : "ls articles/"}</span>
      </div>
      <div className="blog-list-view" data-blog-list-view="" style={reading ? { display: "none" } : undefined}>
        <h2>Latest Articles</h2>
        <p className="app-subtitle">Postmortems, write-ups, and lessons from the trenches</p>
        <div className="blog-list">
          {posts.map((post, index) => (
            <button
              key={post.id}
              className="blog-item"
              type="button"
              data-blog-index={index}
              data-blog-slug={post.id}
              onClick={() => openArticle(post.id)}
            >
              <div className="blog-item-title" lang={post.lang}>
                {post.title}
              </div>
              <div className="blog-item-meta">
                <time dateTime={post.date}>{post.dateText}</time>
              </div>
              <div className="blog-item-desc" lang={post.lang}>
                {post.description}
              </div>
              {post.tags.length > 0 && (
                <div className="blog-item-tags">
                  {post.tags.map((tag) => (
                    <span key={tag} className="blog-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className={reading ? "blog-reader active" : "blog-reader"} data-blog-reader="">
        {posts.map((post, index) => {
          const state = articles[post.id];
          return (
            <article
              key={post.id}
              className="blog-post-panel"
              data-blog-post={index}
              data-blog-slug={post.id}
              hidden={view.slug !== post.id}
            >
              <div className="blog-reader-header">
                <button
                  className="blog-reader-back"
                  type="button"
                  data-blog-back=""
                  onClick={() => showList(true, post.id)}
                >
                  Back to articles
                </button>
                <button
                  className="blog-reader-share"
                  type="button"
                  data-blog-share=""
                  data-blog-slug-share={post.id}
                  title="Share article"
                  onClick={() => shareArticle(post.id)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </button>
                <h2 className="blog-reader-title" lang={post.lang}>
                  {post.title}
                </h2>
                <div className="blog-reader-date">
                  <time dateTime={post.date}>{post.dateText}</time>
                </div>
                {post.tags.length > 0 && (
                  <div className="blog-reader-tags">
                    {post.tags.map((tag) => (
                      <span key={tag} className="blog-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div
                className="blog-reader-body"
                lang={post.lang}
                // Trusted HTML, rendered at build time from the post's Markdown.
                dangerouslySetInnerHTML={state?.status === "ready" ? { __html: state.html } : undefined}
              />
              {state?.status === "loading" && (
                <p className="app-loading" role="status">
                  Loading article…
                </p>
              )}
              {state?.status === "error" && (
                <div className="app-loading app-loading-error" role="alert">
                  <p>This article could not load. Check your connection and try again.</p>
                  <button type="button" className="app-loading-retry" onClick={() => retry(post.id)}>
                    Try again
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
