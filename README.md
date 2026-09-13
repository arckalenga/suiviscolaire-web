# SuiviScolaire Web

A new, independent React + TypeScript application for Congolese schools. No PHP. Supabase provides Auth and PostgreSQL with row-level security. GitHub Pages serves the static application.

## Demonstration

- Three schools, twelve students per school.
- Main administrator: school directory and all schools.
- Network sub-admin: all three schools.
- School sub-admin: only Complexe scolaire du Fleuve.
- Students: only their own marks, printable report card, payment history, school communications and class timetable.
- Staff: create evaluations, publish grades, record received payments, publish communications, add timetable slots, configure school periods and subject reference maxima.
- RDC primary demonstration: 19 branches; 280 points per period, 560 per examination, 1,120 per trimester, 3,360 per year.
- CDF and USD payments preserve their original currency.

All demonstration people and transactions are fictional. The report card is a demonstration inspired by the supplied RDC reference, not an officially approved document.

## Development

Node.js 22.22 or later.

1. Run npm ci.
2. Copy .env.example to .env.local and enter only the Supabase URL and publishable key.
3. Run npm run dev.
4. Open http://127.0.0.1:5173/suiviscolaire-web/.

Run npm run build for TypeScript validation and production compilation. Run npm run test:browser for local browser verification after the demo is provisioned.

## Private credentials

Generated test credentials are stored only in .local/DEMO_CREDENTIALS.md and .local/accounts.json. These files are ignored by Git. Do not publish them or place service-role keys in VITE_ variables.

## Database and access

database/schema.sql records the initial schema applied to the dedicated Supabase project. Existing legacy data remains in its separate schema.

Authorization uses live database memberships, not editable user metadata. Every exposed table has RLS. Students cannot modify records. Sub-admin access is limited by school membership. A suspended membership loses access with its existing access token.

The one-time provisioning Edge Function was closed after seeding. scripts/seed-demo.py is a record of that setup process and cannot provision again unless a new secured setup function is deliberately deployed.

scripts/verify-access.py tests real Supabase accounts, cross-school access, forbidden writes, grade bounds and immediate membership suspension. It reads local ignored credentials and does not log passwords.

## Publication

The GitHub Actions workflow builds on codex/main and publishes dist to GitHub Pages. Repository variables VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are public client configuration. Database protection is enforced by RLS.

See NEXT_STEPS.md for deliberately unfinished production features.
