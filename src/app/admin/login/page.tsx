import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/login-form";
import { login } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage(props: PageProps<"/admin/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-16">
      <h1 className="font-display text-4xl">Admin sign in</h1>
      {/* `next` comes from the URL, which is request-time data, so it is read behind Suspense. */}
      <Suspense fallback={<LoginFormPlaceholder />}>
        <LoginFormWithNext searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginFormWithNext({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm action={login} next={typeof next === "string" ? next : ""} />;
}

function LoginFormPlaceholder() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <div className="h-[4.5rem] animate-pulse rounded-lg bg-surface motion-reduce:animate-none" />
      <div className="h-[4.5rem] animate-pulse rounded-lg bg-surface motion-reduce:animate-none" />
      <div className="h-11 w-28 animate-pulse rounded-full bg-surface motion-reduce:animate-none" />
    </div>
  );
}
