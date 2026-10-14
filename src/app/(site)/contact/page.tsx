import type { Metadata } from "next";
import { ContactForm } from "@/components/site/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch about a project, a collaboration or a question.",
};

export default function ContactPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h1 className="font-serif text-4xl font-medium sm:text-5xl">Contact</h1>
        <p className="mt-4 text-lg text-muted">
          Questions about a project, or want to work together? Send a message and we will reply.
        </p>
      </header>
      <ContactForm />
    </div>
  );
}
