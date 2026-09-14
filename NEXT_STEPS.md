# Next steps

## Explicitly deferred

- Connect online payments when a provider is selected. The student dashboard includes a clearly labeled coming-soon screen. Existing received-payment records remain available in CDF and USD.

## Before using real student data

- Configure password reset email delivery, first-login password changes and production Auth URL allowlists.
- Add an audit trail for profile, grade, publication and payment changes.
- Review school data retention, consent, backups and recovery.
- Replace fictional demo data with institution-approved records.
- Enable leaked-password protection where supported. See [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The security advisor reports this existing warning; no exposed-table or function security finding was reported.

## Further school management

- Add multi-year enrollments and a guided class transition for students already graded.
- Add teacher roles, per-course assignments, attendance, absences, rankings and promotion decisions.
- Add fee schedules, invoices, outstanding balances and downloadable receipts.
- Add editing/removing timetable slots and overlap validation.
- Add replies and external notification delivery. Current communications and notifications are in-app.
- Add editing an existing sub-admin's school assignments and administrator-driven account recovery.
- Student Excel imports currently create new students; existing students are edited individually.
- Improve large-network notification pagination and archival.

## RDC report cards

- Preserve the implemented primary demonstration with configurable school periods and reference maxima.
- Refine official institution codes, permanent student numbers, educational province, domain subtotals, conduct/application, rankings and signatures.
- Add grade-level/class-specific templates and immutable publication snapshots.
- Current bulletins calculate from published assignments and current marks. Missing evaluations are shown as a dash, never silently treated as zero.
- Validate the final official print template with each school and the relevant education authority.

## Engineering

- Generate database TypeScript types and further split the first-release app module.
- Add automated database cleanup fixtures for management integration tests.
- Expand accessibility, concurrent-edit and session-expiry coverage.
- Add dependency/security scanning to CI.
