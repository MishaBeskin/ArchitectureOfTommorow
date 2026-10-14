import type { Metadata } from "next";
import { Barlow_Semi_Condensed, Inter } from "next/font/google";
import { SITE_NAME } from "@/lib/site";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Headings: a compact, bold, architectural sans, always set uppercase (see .font-display in
// globals.css). One static weight keeps the file small, and fewer bytes before first paint is what
// the page budget is about.
const display = Barlow_Semi_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "700",
  display: "swap",
});

const DESCRIPTION = "A showcase of new architecture projects.";

export const metadata: Metadata = {
  // Makes every relative canonical / Open Graph URL absolute.
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
