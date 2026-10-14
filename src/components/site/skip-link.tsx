/** First focusable element on every page; lets keyboard users bypass the header. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-5 focus:py-3 focus:font-medium focus:text-accent-foreground"
    >
      Skip to main content
    </a>
  );
}
