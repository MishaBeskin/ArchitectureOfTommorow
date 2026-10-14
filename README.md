# Architecture of Tomorrow

A website that showcases new architecture projects, with a private admin where the owner adds and edits them. Visitors browse featured and filtered projects, read about each one and send a message. The owner signs in to manage projects, architects, images and incoming messages.

Built with Next.js 16 (App Router, cache components), React 19, TypeScript and Tailwind CSS 4. Data and images live in Supabase (Postgres, Storage, Auth); the code talks to the database through Drizzle.

## Quick start

```bash
pnpm install
cp .env.example .env.local     # then fill it in; see the comments inside
pnpm db:migrate                # create the tables
pnpm db:seed                   # optional: fictional sample projects
pnpm dev                       # http://localhost:3000
```

The admin is at `/admin`. You sign in with the Supabase user whose email is `ADMIN_EMAIL`.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Run, build and serve the site |
| `pnpm test` | Unit and component tests (Vitest; the database tests use an in-memory Postgres) |
| `pnpm e2e` | Browser tests (Playwright) against a production build; needs the Supabase variables |
| `pnpm lint` / `pnpm typecheck` | Code style and types |
| `pnpm lhci` | Lighthouse budgets for speed, accessibility and SEO |
| `pnpm launch:check` | Read-only check that the setup is ready to go live |
| `pnpm db:generate` / `pnpm db:migrate` | Create and apply database migrations |
| `pnpm db:seed` / `pnpm db:unseed` | Add or remove the fictional sample content |

## Where things are

- `src/app/(site)` is the public site; `src/app/admin` is the admin; `src/app/api/admin/upload` hands out one-time image upload addresses.
- `src/server` holds everything that must stay on the server: database, queries, mutations, auth, storage, image processing.
- `src/lib` holds code shared with the browser: validation rules, formatting, security headers and policies.
- `src/components` holds the interface, split into `site`, `projects`, `admin` and `ui`.
- `e2e` holds the browser tests; unit tests sit next to the code they test.

## How it is kept safe

- Every admin page, action and route checks the signed-in user itself; the proxy only redirects early. A test proves each admin action refuses a signed-out caller before touching data.
- Uploaded images are checked by their real contents, resized and re-encoded; the original is never stored or shown.
- Content security policy and the standard security headers are set in `next.config.ts` (see `src/lib/csp.ts`).
- Secrets never reach the browser; a test scans what the browser downloads for them.

## Going live

Follow [docs/LAUNCH.md](docs/LAUNCH.md): it covers the keys to create, the Vercel setup, the domain, backups and rollback, in plain steps.
