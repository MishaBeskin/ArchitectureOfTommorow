# Going live: step by step

This guide is for the person who owns the site. Follow the steps in order. Each step says exactly where to click and what to copy. Nothing here needs you to write code.

**Before anything else, run the checker.** It looks at your setup and tells you what is ready:

```
pnpm launch:check
```

It prints `[ok]`, `[warn]` or `[FAIL]` for each item and says what to do about it. Run it again after each step below, and run it a last time against the live settings (step 6) before you tell anyone the site is live. It only reads, it never changes anything.

---

## What is already done

- The site, the admin, the database and the image storage are built and tested.
- Sign-ups are switched off, and you are the only user.
- Every table is protected, and the image bucket accepts only images up to 30 MB.

## Step 1. Cloudflare Turnstile (protects the contact form)

Without this the contact form refuses every message on the live site. That is deliberate: it is better than accepting spam.

1. Go to https://dash.cloudflare.com and sign in (a free account is enough).
2. Open **Turnstile** in the left menu and click **Add widget**.
3. Name it `Architecture of Tomorrow`. Under **Hostname** add your real domain (for example `www.example.com`). Add the `.vercel.app` address Vercel gives you too, so you can test before the domain is connected.
4. Choose **Managed** and create it.
5. Copy the two keys it shows you. Keep them ready for step 3:
   - **Site Key** goes into `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - **Secret Key** goes into `TURNSTILE_SECRET_KEY`

## Step 2. Resend (emails you when someone writes)

This is optional. Without it, messages are still saved and you read them in the admin under **Messages**. With it, you also get an email.

1. Go to https://resend.com and create an account.
2. Open **Domains**, add your domain, and add the DNS records it shows you where you manage your domain. Wait until it says **Verified**.
3. Open **API Keys**, create a key, and copy it (`re_...`).
4. You will set these in step 3:
   - `RESEND_API_KEY` is the key
   - `CONTACT_TO_EMAIL` is where you want to receive messages
   - `CONTACT_FROM_EMAIL` is an address on your verified domain, for example `Architecture of Tomorrow <hello@example.com>`

## Step 3. Vercel (hosts the site)

1. Go to https://vercel.com and sign up with your GitHub account.
2. Click **Add New > Project**, choose the repository `MishaBeskin/ArchitectureOfTommorow`, and click **Import**. Leave the framework as **Next.js** and do not change the build settings.
3. Open **Environment Variables** and add every line in the table below. Copy the values from your `.env.local` file where it says so. Tick **Production** for all of them.

| Name | Value |
|---|---|
| `DATABASE_URL` | From `.env.local` |
| `NEXT_PUBLIC_SUPABASE_URL` | From `.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | From `.env.local` |
| `SUPABASE_SECRET_KEY` | From `.env.local` |
| `ADMIN_EMAIL` | From `.env.local` |
| `NEXT_PUBLIC_SITE_URL` | Your real address, starting with `https://` (for the first test, the `.vercel.app` address) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site Key from step 1 |
| `TURNSTILE_SECRET_KEY` | Secret Key from step 1 |
| `RESEND_API_KEY` | From step 2 (skip if you skipped step 2) |
| `CONTACT_TO_EMAIL` | From step 2 (skip if you skipped step 2) |
| `CONTACT_FROM_EMAIL` | From step 2 (skip if you skipped step 2) |

4. Under **Settings > Functions**, set the **Function Region** to the one closest to your Supabase project. It is the region in your `DATABASE_URL`, for example `aws-0-eu-west-1` means Ireland. A matching region makes every admin page faster.
5. Click **Deploy** and wait. The first build takes a few minutes.

Important: a variable that starts with `NEXT_PUBLIC_` is built into the site, so after you change one you must redeploy (Deployments > the three dots > Redeploy).

## Step 4. Test the live site

Open the address Vercel shows you and check each of these:

- [ ] The home page, **Projects**, a project page, **About** and **Contact** all load, with images.
- [ ] On **Contact**, send yourself a message. You should see the thank-you note.
- [ ] Go to `/admin`, sign in, and open **Messages**. Your test message is there. Delete it.
- [ ] If you did step 2, the email arrived.
- [ ] Sign out. Opening `/admin/projects` sends you to the sign-in page.

## Step 5. Connect your domain

1. In Vercel open **Settings > Domains**, add your domain, and follow the DNS instructions it shows (where you manage your domain, add the record it asks for). HTTPS is set up automatically.
2. Decide on one address, `www.example.com` or `example.com`, and make the other redirect to it. Vercel offers this in the same screen.
3. Make sure these all use the final address:
   - `NEXT_PUBLIC_SITE_URL` in Vercel, then **Redeploy**
   - the **Hostname** list of the Turnstile widget (step 1)
   - the verified domain in Resend (step 2)
4. Open `https://your-domain/sitemap.xml`. Every address in it should start with your real domain.

## Step 6. Check the live settings, then add your real content

1. In a terminal in the project folder, with the Vercel command line installed, run:
   ```
   vercel env pull .env.vercel
   pnpm launch:check --env-file .env.vercel
   ```
   (`.env.vercel` is never committed.) Fix anything marked `[FAIL]`.
2. Sign in to `/admin` and create your real architects and projects, upload their images, and publish them.
3. When your real projects are ready, remove the fictional samples:
   ```
   pnpm db:unseed
   ```
   This deletes the nine sample projects and their images. Do it only once your own work is published, otherwise the site will be empty.
4. Run `pnpm launch:check --env-file .env.vercel` again. It should show no `[FAIL]` and no sample-content warning.

## Step 7. Tell search engines

1. Go to https://search.google.com/search-console and add your domain.
2. Submit `https://your-domain/sitemap.xml`.

---

## Backups: read this one

- **Your data (projects, architects, messages)** lives in Supabase. On the **free plan there are no automatic backups**, and a project that nobody visits for a week is **paused**. For a real launch, move the Supabase project to the **Pro plan**: it keeps daily backups and never pauses. You can do this under Project Settings > Billing.
- **Your images are not part of the database backup.** The site keeps only the resized copy of each image, never your original. **Keep the original files on your own computer or drive.** If storage were ever lost, the originals are what you would re-upload.
- **A manual copy of the database**, if you want one before a big change: in Supabase open **Connect**, copy the **Session pooler** connection string, and run `pg_dump "<that string>" -f backup.sql` (needs PostgreSQL's command-line tools).

## If something goes wrong

- **A bad deployment:** in Vercel, open **Deployments**, find the last good one, and choose **Promote to Production** (or **Instant Rollback**). The site is back in seconds.
- **The contact form says it could not send:** check Turnstile first. In production it needs the real keys and your domain in its hostname list.
- **You cannot sign in:** the email must be exactly `ADMIN_EMAIL`, and that user must exist in Supabase under Authentication > Users. After too many wrong passwords the form pauses for 15 minutes.
- **Images do not show:** the `projects` bucket must be **public**. `pnpm launch:check` tells you.

## After launch

- **Use a long, unique password for your admin account.** It is the only thing between the internet and your content. Supabase can also add a second step (an authenticator app) under Authentication.
- **Keep dependencies updated** now and then (`pnpm update`, then `pnpm test`), and run `pnpm audit` to see known problems.
- **Run `pnpm lhci`** after big changes to confirm the site is still fast, accessible and well set up for search.
