import type { Metadata } from "next";

// The admin must never appear in search results. robots.txt, the proxy's X-Robots-Tag header and
// this tag all say so, because each alone can be ignored or misconfigured.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <>{children}</>;
}
