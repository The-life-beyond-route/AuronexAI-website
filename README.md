# AuronexAI website

A complete, responsive marketing website with a local enquiry backend. All source and assets are in this folder. The current website runs directly with Node.js. Dependencies for a future Prisma/Resend integration have been added; that integration is not active yet.

## Run the website

Install Node.js 24 or newer, then open a terminal in this folder:

```powershell
node server.mjs
```

You can also double-click start.cmd on Windows. Open http://localhost:3000 in your browser. Keep the terminal running while using the website. Stop with Ctrl+C. Use `$env:PORT=3001` before starting to choose another port.

Opening index.html directly previews the design, tabs, calculator, and mobile menu. Form submission needs the included Node server.

## Files

- index.html — complete website content and semantic markup
- styles.css — responsive design, keyboard focus, reduced motion
- assets/site.js — mobile menu, accessible tabs, estimator, and form
- logo.svg — transparent blue/purple vector A-and-arc mark recreated from your supplied brand reference
- privacy.html — privacy notice reflecting the local implementation
- server.mjs — static routes and validated enquiry endpoint
- package.json — start and syntax check commands
- index.original.html — preserved original website
- data/enquiries.jsonl — created automatically when the first enquiry is submitted

## Enquiries

Successful submissions are stored in `data/enquiries.jsonl`, one JSON record per line. This is a local inbox, not email delivery. Read it with:

```powershell
Get-Content .\data\enquiries.jsonl
```

The data directory is never served over HTTP and is excluded from Git. No public inbox or admin endpoint is exposed. Do not commit, publish, or share enquiry records. Back up and remove records according to your business retention policy. The server validates fields and consent, enforces a request size limit, uses a honeypot, checks browser origins, and limits repeated requests. Rate limits are in memory and reset on restart.

## Editing

Edit index.html for content, styles.css for colors and layout, and the examples object in assets/site.js for industry workflows. Replace logo.svg with your approved brand mark. There are no invented testimonials, client logos, prices, or outcome claims. Platform names are illustrative integration options, not partnerships. The time estimator uses hours per week × chosen share × 4; it is not a promised result.

## Checks

```powershell
node --check assets/site.js
node --check server.mjs
```

## Public launch

This delivery is local and has not been publicly deployed. The server binds to loopback by default. For deployment, use a Node-capable host with HTTPS, persistent protected storage, and a reverse proxy. Adapt the listen host intentionally for that environment. This filesystem backend requires a persistent disk; ephemeral/serverless deployments need a database or external form service instead.

Before launch: add verified business details and a direct contact, review the recreated logo against your original master artwork, finalize the privacy notice and retention period, configure your domain/social image, and connect email or CRM notifications if desired. Static hosting alone will display the site but will not run `/api/enquiries`. Never put webhook secrets in client-side JavaScript. No paid service or external account has been configured.

## Local integration verification

With the server running, run `node verify.mjs`. It tests routes, file protection, input validation, origin checks, and persistence, then removes its own temporary QA record. Run only in a local development environment.

Browser visual verification was unavailable in this session. Check desktop and mobile layouts before public launch.



## Integration status

Prisma schema/configuration, an environment-variable example, and Prisma/Resend dependencies are included as an unfinished scaffold. The active form still saves enquiries locally and does not send email. Vercel now has an explicit static build configuration. The hosted enquiry endpoint returns an unavailable response until the integration is completed. Finish and test the integration before deploying.

Use `npm install` to install the scaffold dependencies and generate Prisma Client. Only commit `.env.example`, never `.env` or real credentials.

## Deploy the website to Vercel

Import this GitHub repository. Use repository root as Root Directory, Framework Preset **Other**, Build Command `npm run build`, Output Directory `dist`, and Node.js **24.x**. The committed `vercel.json` declares these build settings. Remove any previous Express/Node framework override and any custom entrypoint pointing at the browser script, then redeploy the latest commit. No environment variables are required to display the website.

The browser script is `assets/site.js` and is delivered as a static file, never executed as the server entrypoint. Only allowlisted website assets are copied into `dist`. The existing local Node server continues to save local enquiries. The Vercel endpoint deliberately returns HTTP 503 until Resend/Prisma are connected; no hosted enquiry is saved or emailed yet.
