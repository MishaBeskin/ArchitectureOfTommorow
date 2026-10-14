import Link from "next/link";
import { buttonStyles } from "@/components/ui/button-styles";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-6 px-4 py-24">
      <h1 className="font-serif text-5xl font-medium">Page not found</h1>
      <p className="text-lg text-muted">
        The page you are looking for does not exist or has moved.
      </p>
      <Link href="/" className={buttonStyles()}>
        Back to home
      </Link>
    </main>
  );
}
