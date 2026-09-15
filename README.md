# SuiviScolaire — Acadexis

React + TypeScript + Supabase school management, published on GitHub Pages. No PHP.

**Website:** https://arckalenga.github.io/suiviscolaire-web/

## Custom domain

Prepared for `suiviscolaire.info` and `www.suiviscolaire.info`. Relative asset paths support both the GitHub project URL and the domain root. Account-management requests allow both HTTPS origins.

Before switching DNS, set the Pages custom domain to `suiviscolaire.info` in repository Settings > Pages. At Porkbun, edit the root ALIAS to `arckalenga.github.io` and replace the parking wildcard CNAME with an explicit `www` CNAME pointing to `arckalenga.github.io` (TTL 600). Preserve unrelated records. Enable HTTPS once GitHub issues the certificate, then verify both addresses and login. DNS/account sign-in is still pending as of 2026-09-15.

## Public welcome page

Acadexis vision, mission and product presentation, login, Instagram, telephone and WhatsApp contact links. Sign out to view the welcome page; direct login is available at #connexion.

## Roles and features

### Main administrator

- School directory and school creation.
- Sub-admin account creation with one or several authorized schools.
- Every school management feature available to sub-admins.

### Sub-administrator

- Directory limited to assigned schools.
- Create classes and courses; retain configurable report-card maxima.
- Create individual students and their login accounts.
- Edit student details; archive/restore a student and revoke/restore access while preserving marks and payments.
- Import new students from Excel with a validation preview and per-row results.
- Create assignments, homework, interrogations and exams as drafts.
- Enter one mark or import marks from Excel; explicitly publish to students with notifications.
- Communicate with one student, one class or an entire school.
- Keep payment records, timetable management and printable RDC-inspired bulletins.

### Student

Seven dashboard boxes: marks, payments, bulletin, school communications, notifications, online payment and timetable. Online payment is clearly marked as coming later, as requested; no real payment processing is enabled.

Notifications are personal, respect message targeting and track read status. Draft grades are never visible to students.

## Demonstration

Three schools, twelve students per school, two sub-admins with different school access, and one main administrator. Existing demonstration accounts remain valid.

The RDC primary example has 19 branches, 280 points per period, 560 per examination, 1,120 per trimester and 3,360 per year. This is a demonstration template, not an officially approved document.

## Excel workflow

Download the relevant model from the application. Accepted files: .xlsx, .xls and .csv, up to 2 MB and 500 data rows. Formulas must be replaced by values.

Students: Matricule, Nom, Classe, Email, Sexe, Naissance (YYYY-MM-DD). Classes must already exist. Existing matricules/emails are rejected; edit existing profiles individually. Account creation generates a random password, available only in the current administrator session for copying or downloading.

Marks: Matricule, Note. Use the template for the selected evaluation's class. Empty marks are ignored; zero is a valid grade. Preview and confirm the import, then publish. A bad mark causes the entire mark batch to roll back. Hide a published evaluation before changing its marks.

## Local development

Node.js 22.22 or later.

1. Run npm ci.
2. Copy .env.example to .env.local; use only the Supabase URL and publishable key.
3. Run npm run dev.
4. Open http://127.0.0.1:5173/suiviscolaire-web/.

npm run build checks TypeScript and builds for production.
npm run test:imports checks real Excel parsing and validation.
npm run test:browser checks existing demo workflows.
node scripts/test-management-ui.mjs exercises new management workflows with temporary records.
scripts/verify-management.py checks the new database and account endpoint permissions.

Tests that create records require cleanup of their specifically recorded temporary data. Private test metadata is saved under .local/.

## Database and account service

database/schema.sql records the first schema. database/acadexis-management.sql records the subsequent management changes and should follow the initial schema on a new database.

supabase/functions/web-manage-accounts/index.ts validates the caller's Supabase JWT with getUser, then checks live database permissions before creating accounts or archiving a student. Platform JWT verification is disabled for this function because authentication is implemented in its body. The service-role key is read only from the Edge Function environment and never sent to browsers.

Only the service role may call account-provisioning and archive RPCs. Mark import uses an invoker-rights transaction and the caller's school permissions. Exposed tables use RLS; notification views are security invoker views. Authorization never trusts editable user metadata.

The old one-time demo setup function is closed. scripts/seed-demo.py records the original one-off setup; it is not an active provisioning endpoint.

## Credentials and publication

Private demonstration credentials live in .local/DEMO_CREDENTIALS.md and .local/accounts.json. Neither is tracked in Git. Do not put passwords or service-role keys into frontend variables.

The workflow publishes codex/main to GitHub Pages. VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are public repository build variables.

See NEXT_STEPS.md for the remaining production work.
