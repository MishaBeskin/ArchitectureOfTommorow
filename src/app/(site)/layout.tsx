import { JsonLd } from "@/components/seo/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SkipLink } from "@/components/site/skip-link";
import { organizationJsonLd, websiteJsonLd } from "@/lib/json-ld";
import { getSiteUrl } from "@/lib/site-url";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  const siteUrl = getSiteUrl();

  return (
    <>
      <JsonLd data={[organizationJsonLd(siteUrl), websiteJsonLd(siteUrl)]} />
      <SkipLink />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
