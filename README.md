# AuronexAI website

Responsive marketing website with a Vercel enquiry API, PostgreSQL persistence via Prisma, and Resend email notifications. All source code is in this folder.

## Run locally

Use Node.js 24 LTS, then:

```powershell
npm install
npm start
```

Open http://localhost:3000. Without database settings, the local server saves enquiries in `data/enquiries.jsonl` and sends no email. With PostgreSQL settings in `.env`, it uses the hosted-style Prisma/Resend handler instead. Copy `.env.example` to `.env` and use development credentials for integration testing. The Windows launcher is `start.cmd`.

## How enquiries work

1. The browser sends a validated enquiry with a stable request ID to `/api/enquiries`.
2. The API checks the request origin, field sizes, consent, and a database-backed rate limit.
3. Prisma saves the enquiry in PostgreSQL before any notification is sent.
4. Resend sends the details to `ENQUIRY_TO`, with the customer's email as Reply-To.
5. Notification failures leave the enquiry saved. The daily authenticated retry job processes pending notifications, up to five attempts per enquiry. Visitors receive success once their enquiry is safely stored.

Resend acceptance is recorded as SENT; it does not prove inbox delivery. Delivery, bounce, or spam status should be checked in the Resend dashboard. Request IDs prevent duplicate lead records. A database lease and Resend idempotency key limit duplicate notifications. Resend keys expire after 24 hours; in the rare case where an email was accepted but its database status was not saved, a later retry may produce a duplicate email. The lead remains safe in the database.

## Vercel environment variables

The existing Marketplace integrations supply `RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN`, `DATABASE_URL`, and `DATABASE_URL_POOLED`. Do not replace them with placeholders.

Add these server-only settings:

- `ENQUIRY_TO`: your notification inbox, one email address.
- `SITE_URL`: your canonical website origin, e.g. `https://auronex-ai-website.vercel.app`, without a trailing slash.
- `CRON_SECRET`: a random secret of at least 32 characters, used by Vercel to authenticate the daily retry job.
- `RATE_LIMIT_SECRET`: a separate random secret for hashing request IP addresses.
- Optional `RESEND_FROM`: `AuronexAI <enquiries@your-verified-domain.com>`. If omitted, the app uses `enquiries@RESEND_EMAIL_DOMAIN`.
- Optional `DIRECT_URL`: direct PostgreSQL connection for migrations. Otherwise the integration's direct `DATABASE_URL` is used. Runtime prefers `DATABASE_URL_POOLED`.

The sender domain must be verified in Resend. Do not use the customer's address as the sender; Reply-To is used instead. Set variables for Production and use separate development/preview resources when appropriate. No keys are exposed to the browser or committed to Git.

Generate a secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and enter it directly in Vercel. Do not paste secrets into chat.

## Deployment

Import the repository into Vercel. Framework: **Other**. Build Command: `npm run build`. Output Directory: `dist`. Node.js: **24.x**. Root Directory: repository root. `vercel.json` contains the configuration.

The install/build generates Prisma Client. Production builds run `prisma migrate deploy` to apply the committed additive migration before publishing static assets. Preview/local builds do not modify a database automatically. To initialize a separate development/preview database with its environment configured, run `npm run db:migrate`. No reset or destructive schema push is used. Existing databases that already have these tables need migration baselining rather than a reset.

The retry endpoint runs daily at 04:00 UTC. It requires the Authorization bearer value matching `CRON_SECRET`; it is not a public admin endpoint. A manual retry against a locally configured environment is available with `npm run notifications:retry`.

## View enquiries

Use the Prisma database dashboard or `npm run db:studio` with the intended database environment loaded. The Enquiry table includes notification status, attempt count, and provider email ID. Do not publish Prisma Studio or database credentials. Remove records according to your business retention policy; finalize the privacy contact and retention period before launch.

## Verification

```powershell
npm run check
npm test
npm run build
```

Tests cover static asset isolation, validation, origin restrictions, database failure, duplicate and parallel submissions, rate limiting, notification failure, and retry behavior using mock services. Real database/email verification requires a configured deployment. `node verify.mjs` remains a local-file-mode smoke test; do not run it against the configured production API.

## Source map

- `index.html`, `styles.css`, `assets/site.js`: website and browser interactions.
- `logo.svg`: vector recreation of the supplied logo reference.
- `api/enquiries.js`: Vercel enquiry endpoint.
- `api/notifications-retry.js`: authenticated daily notification retry endpoint.
- `lib/enquiries.mjs`: validation, persistence flow, notification logic.
- `lib/services.mjs`: Prisma PostgreSQL adapter and Resend SDK clients.
- `prisma/`: schema and committed migrations.
- `scripts/`: static build, migration, and manual retry commands.
- `server.mjs`: local server, with a file-based fallback when database settings are absent.
- `privacy.html`: privacy notice.
- `index.original.html`: preserved original website.

Generated output, local enquiries, environment files, dependencies, and ZIP packages are excluded from Git. Only allowlisted public assets are copied to `dist`.
