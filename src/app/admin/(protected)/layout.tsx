import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/server/auth/require-admin";
import { logout } from "./actions";

export default function ProtectedLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

/**
 * Checks the session on every request (reading cookies is request-time work, hence the Suspense
 * boundary above). The proxy already redirects early; this is the check that actually decides.
 * Pages and actions below still call requireAdmin() themselves, since a layout alone is not a
 * reliable gate: Next.js can render a page without re-rendering its layout.
 */
async function AdminGate({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <AdminShell email={admin.email} logout={logout}>
      {children}
    </AdminShell>
  );
}

function AdminLoading() {
  return (
    <p role="status" className="p-8 text-muted">
      Loading…
    </p>
  );
}
