# Next steps

This first release prioritizes a working demonstration on the new non-PHP architecture.

## Before using real student data

- Add administrator account invitation, password reset and first-login password change flows.
- Add account lifecycle management and an audit trail for edits to marks and payment records.
- Review school data retention, consent, backups and recovery.
- Configure production Auth URL allowlists, email delivery, rate limits and abuse monitoring.
- Replace demo accounts and data with institution-approved records.

## School administration

- Add school/class/student creation and enrollment screens, teacher roles and per-course assignments.
- Support separate academic-year records and class-level calendar settings. This release uses one demo year per school.
- Add attendance, absences, rankings, promotion decisions and teacher comments.
- Support editing/removing timetable slots and overlap validation.
- Add fee schedules, invoices, outstanding balances and downloadable receipts.
- Connect an authorized payment provider for real online payments; current payments are recorded receipts only.
- Add targeted messages, replies, notification delivery and read receipts.

## RDC report cards

- Refine the complete official primary template: institution codes, permanent student numbers, educational province, domain subtotals, conduct and application, rankings, decisions and signatures.
- Add grade-level templates and class-specific maxima.
- Add a reviewed publication workflow and immutable report-card snapshots.
- Current report cards are calculated from published assignments and current marks. Missing evaluations show a dash; they are not assumed to be zero.
- Reference maxima changes apply to settings only; existing evaluation maxima remain unchanged.
- Validate final print layout with each school and the relevant education authority.

## Engineering

- Generate Supabase TypeScript schema types and split the first-release UI into feature modules.
- Expand automated UI tests and accessibility coverage.
- Add pagination for large enrollment and payment datasets (demo datasets fit current queries).
- Add CI security scanning and dependency updates.

## Supabase security advisor

The security advisor found no exposed-table or function security findings. Leaked-password protection is disabled; review [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) before accepting real users. Demo passwords are independently generated random values.
