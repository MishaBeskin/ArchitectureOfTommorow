import type { Metadata } from "next";
import { ContactForm } from "@/components/site/contact-form";
import { pageMetadata } from "@/lib/seo";
import { submitContact } from "./actions";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: "Get in touch about a project, a collaboration or a question.",
  path: "/contact",
});

export default function ContactPage() {
  // Set in the environment so the address is never hard-coded; hidden until it is configured.
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || undefined;

  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-5xl leading-[0.95] sm:text-7xl">Contact</h1>
        <p className="mt-5 text-xl font-semibold text-blue">
          Questions about a project, or want to work together? Write to me directly or send a
          message below, and I will reply.
        </p>
        {email && (
          <p className="mt-4 text-lg">
            Email:{" "}
            <a href={`mailto:${email}`} className="font-semibold underline underline-offset-4">
              {email}
            </a>
          </p>
        )}
      </header>
      <ContactForm action={submitContact} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined} />
    </div>
  );
}
