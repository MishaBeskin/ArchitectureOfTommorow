import Markdown, { type Components } from "react-markdown";

/**
 * Descriptions are written in the admin, so they are treated as untrusted:
 *  - raw HTML is discarded (skipHtml, and no rehype-raw), so <script> or <iframe> is never rendered
 *    and does not show up as visible text either
 *  - it also strips unsafe URL protocols such as javascript:
 *  - images are not allowed: gallery images are managed separately and are the only ones that
 *    pass through the optimized, allow-listed image pipeline
 *  - headings are demoted because the page already owns h1 and h2
 * Each renderer takes only `children` (and `href`), so no other attribute can reach the DOM.
 */
const components: Components = {
  h1: ({ children }) => <h3 className="mt-8 font-display text-2xl">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-8 font-display text-2xl">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-6 text-lg font-semibold">{children}</h4>,
  p: ({ children }) => <p className="text-lg leading-8">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-2 pl-6 text-lg leading-8">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-2 pl-6 text-lg leading-8">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-border-strong pl-4 text-lg italic">{children}</blockquote>
  ),
  a: ({ href, children }) => {
    const external = typeof href === "string" && /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        className="underline underline-offset-4"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
};

export function ProjectDescription({ markdown }: { markdown: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Markdown components={components} skipHtml disallowedElements={["img"]} unwrapDisallowed>
        {markdown}
      </Markdown>
    </div>
  );
}
