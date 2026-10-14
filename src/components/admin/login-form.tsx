"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import type { LoginState } from "@/server/auth/login";

export type LoginAction = (previous: LoginState, formData: FormData) => Promise<LoginState>;

const IDLE: LoginState = { status: "idle" };

export function LoginForm({ action, next }: { action: LoginAction; next: string }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const failed = state.status === "error";

  useEffect(() => {
    if (failed) alertRef.current?.focus();
  }, [state, failed]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {failed && (
        <p
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border-2 border-danger p-4 font-medium text-danger"
        >
          {state.message}
        </p>
      )}
      <input type="hidden" name="next" value={next} />
      <Field label="Email" required>
        {(c) => (
          <Input
            name="email"
            type="email"
            autoComplete="username"
            defaultValue={failed ? state.email : undefined}
            {...c}
          />
        )}
      </Field>
      <Field label="Password" required>
        {(c) => <Input name="password" type="password" autoComplete="current-password" {...c} />}
      </Field>
      <div>
        <Button type="submit" loading={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
