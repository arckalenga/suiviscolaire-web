# SuiviScolaire — Acadexis

React + TypeScript + Supabase school management, published on GitHub Pages. No PHP.

**Website:** https://suiviscolaire.info/

## Custom domain

Prepared for `suiviscolaire.info` and `www.suiviscolaire.info`. Relative asset paths support both the GitHub project URL and the domain root. Account-management requests allow both HTTPS origins.

Before switching DNS, set the Pages custom domain to `suiviscolaire.info` in repository Settings > Pages. At Porkbun, edit the root ALIAS to `arckalenga.github.io` and replace the parking wildcard CNAME with an explicit `www` CNAME pointing to `arckalenga.github.io` (TTL 600). Preserve unrelated records. Enable HTTPS once GitHub issues the certificate, then verify both addresses and login. Domain and DNS configured on 2026-09-15; GitHub certificate issuance and HTTPS enforcement are pending.

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

## Student logins and PDF downloads

New student accounts receive exactly six random characters (uppercase letters and digits without ambiguous I/O/0/1). Existing passwords and login addresses remain valid; no bulk reset is performed. This short-password policy is a demonstration choice requested by the owner; longer passwords are recommended for real student data.

School Settings includes a login domain (for example csfleuve.com). New-student forms suggest name@schooldomain, and Excel imports generate it when Email is blank. Duplicate names require a distinct local part, such as a matricule suffix. The domain applies only to new accounts; these identifiers do not provision mailboxes or establish domain ownership. Real email delivery requires a school-controlled domain and mail configuration.

Every role can use Bulletins > Télécharger le PDF. Administrators first select an authorized school and student; students export their own bulletin. The direct PDF includes published marks, missing-evaluation indicators and selectable text. Print remains available separately. Standard three-term reports use portrait A4; wider configurations use landscape A4 with repeated table headings across pages.

Verification: npm run test:imports, node --test tests/student-access.test.mjs, node scripts/test-bulletin-download.mjs. The last test uses private demo credentials in .local/accounts.json and saves local PDF and screenshot samples under .local/pdf-checks/.

Apply database/student-access.sql after schema.sql and acadexis-management.sql when setting up a fresh dedicated project. The deployed web-manage-accounts function must include student-access.ts beside index.ts.

## RDC bulletin layout

The report uses separate maximum and points columns for periods, exams, terms and the year. Language groups and domains have subtotal rows. Maxima follow each subject's configured period/exam scale: published assignment points are weighted by their maxima onto that scale. Missing evaluations leave points blank, while a recorded zero remains zero. The final rows show maxima, totals and percentages. Rank, class size, application, conduct and signatures remain blank for completion by the school; no unrecorded assessment or promotion decision is inferred. Promotion/repetition checkboxes, place, date, pupil signature, seal and headteacher signature appear below. The demonstration notices were removed from the report at the owner's request.
