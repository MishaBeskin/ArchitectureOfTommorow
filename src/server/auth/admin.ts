export interface AdminIdentity {
  id: string;
  email: string;
}

/** The parts of a Supabase user this check looks at. */
export interface AuthUserLike {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
}

/** The part of a Supabase client this check needs, so tests can supply a fake. */
export interface AuthClientLike {
  auth: {
    getUser: () => Promise<{ data: { user: AuthUserLike | null }; error: unknown }>;
  };
}

/**
 * Being signed in is not enough: the account must be the configured admin and have a confirmed
 * email. Supabase accounts are not all admins, and sign-ups may one day be re-enabled by mistake.
 */
export function isAdminUser(user: AuthUserLike | null | undefined, adminEmail: string): boolean {
  const expected = adminEmail.trim().toLowerCase();
  if (!expected || !user?.email || !user.email_confirmed_at) return false;
  return user.email.trim().toLowerCase() === expected;
}

/**
 * Asks Supabase's Auth server to validate the session token and returns the admin, or null.
 * `getUser()` verifies the token remotely; it must be used instead of `getSession()`, which only
 * reads the cookie and would trust whatever the browser sent.
 */
export async function getAdminFromClient(client: AuthClientLike, adminEmail: string): Promise<AdminIdentity | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  if (!isAdminUser(data.user, adminEmail)) return null;
  return { id: data.user.id, email: data.user.email!.trim().toLowerCase() };
}
