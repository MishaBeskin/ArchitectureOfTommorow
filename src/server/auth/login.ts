import { safeAdminRedirect } from "@/lib/safe-redirect";
import type { AnyDb } from "../db/types";
import { hashIp } from "../hash-ip";
import { consumeRateLimit } from "../rate-limit";
import { isAdminUser, type AuthUserLike } from "./admin";

export const LOGIN_WINDOW_SECONDS = 15 * 60;

/** One message for every failure, so the form never reveals whether an account exists. */
export const GENERIC_LOGIN_ERROR = "The email or password is incorrect.";

export type LoginState =
  | { status: "idle" }
  | { status: "error"; message: string; /** Echoed back so the visitor does not retype it. */ email?: string };

export type LoginResult = LoginState | { status: "success"; redirectTo: string };

export interface LoginDeps {
  db: AnyDb;
  adminEmail: string;
  /** Sign-in attempts allowed per visitor per 15 minutes. */
  rateLimitMax: number;
  /** Key for hashing visitor IPs so raw addresses are never stored. */
  ipHashKey: string;
  supabase: {
    auth: {
      signInWithPassword: (credentials: {
        email: string;
        password: string;
      }) => Promise<{ data: { user: AuthUserLike | null }; error: unknown }>;
      signOut: (options?: { scope?: "local" | "global" | "others" }) => Promise<unknown>;
    };
  };
  log: { warn: (message: string, meta?: unknown) => void };
}

export interface LoginInput {
  email: string;
  password: string;
  /** The `next` URL parameter: untrusted. */
  next: string | null;
  ip: string;
}

const fail = (message: string, email?: string): LoginResult => ({ status: "error", message, email });

/**
 * Order: cheap checks and rate limits first, so password guessing is throttled before it reaches
 * Supabase; then the password; then whether this account may enter the admin at all. A correct
 * password for any other account is treated exactly like a wrong one and its session is dropped.
 */
export async function handleLogin(deps: LoginDeps, input: LoginInput): Promise<LoginResult> {
  const email = input.email.trim().slice(0, 254);
  const password = input.password;

  if (!email || !password || password.length > 1_000) return fail(GENERIC_LOGIN_ERROR, email);

  const ipHash = hashIp(input.ip, deps.ipHashKey);
  // Per visitor, plus a looser global cap so spreading guesses over many addresses does not help.
  const perVisitor = await consumeRateLimit(deps.db, `admin-login:ip:${ipHash}`, {
    limit: deps.rateLimitMax,
    windowSeconds: LOGIN_WINDOW_SECONDS,
  });
  const global = await consumeRateLimit(deps.db, "admin-login:all", {
    limit: deps.rateLimitMax * 5,
    windowSeconds: LOGIN_WINDOW_SECONDS,
  });
  if (!perVisitor.allowed || !global.allowed) {
    const seconds = Math.max(
      perVisitor.allowed ? 0 : perVisitor.retryAfterSeconds,
      global.allowed ? 0 : global.retryAfterSeconds,
    );
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    deps.log.warn("Admin sign-in rate limited", { scope: perVisitor.allowed ? "global" : "visitor" });
    return fail(
      `Too many sign-in attempts. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      email,
    );
  }

  const { data, error } = await deps.supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return fail(GENERIC_LOGIN_ERROR, email);

  if (!isAdminUser(data.user, deps.adminEmail)) {
    // A real account, but not the admin. Drop the session Supabase just created for it.
    await deps.supabase.auth.signOut({ scope: "local" });
    deps.log.warn("Sign-in refused: account is not the admin");
    return fail(GENERIC_LOGIN_ERROR, email);
  }

  return { status: "success", redirectTo: safeAdminRedirect(input.next) };
}
