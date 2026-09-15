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
- Add teacher login roles, attendance, absences, rankings and promotion decisions. Teacher records and subject assignments are implemented.
- Add fee schedules, invoices and outstanding balances. Downloadable/printable receipts and manual sharing are implemented.
- Add editing/removing timetable slots and overlap validation.
- Add replies and email/WhatsApp notification delivery. In-app notifications and optional web push for published marks are implemented.
- Add editing an existing sub-admin's school assignments and administrator-driven account recovery.
- Student Excel imports currently create new students; existing students are edited individually.
- Improve large-network notification pagination and archival.

## RDC report cards

- Preserve the implemented primary demonstration with configurable school periods and reference maxima.
- Refine official institution codes, permanent student numbers, educational province, persisted conduct/application, rankings and digital signatures.
- Add grade-level/class-specific templates and immutable publication snapshots.
- Current bulletins calculate from published assignments and current marks. Missing evaluations leave the report cell blank, never silently treated as zero.
- Validate the final official print template with each school and the relevant education authority.

## Engineering

- Generate database TypeScript types and further split the first-release app module.
- Add automated database cleanup fixtures for management integration tests.
- Expand accessibility, concurrent-edit and session-expiry coverage.
- Add dependency/security scanning to CI.

## Personnel and receipts

- Add payroll period filters, editing/correction workflows and pagination for very large staff histories. Current records track payments already made, not salary calculation or transfers.
- Receipt sharing uses the device share sheet when supported; otherwise download and attach the PDF manually through email/WhatsApp. Automated delivery and delivery tracking need a configured provider.
- Bulletin restrictions hide the in-app report and block its normal PDF/print controls; marks intentionally remain readable. They cannot revoke previously downloaded copies or prevent reconstruction from visible marks. Add server-issued signed report snapshots if document authenticity is required.

## Parent and push follow-up

- Verify actual push reception on Android and an installed iPhone/iPad web app; the automated Edge browser returned AbortError registering with its push service. Queue creation, server worker authentication, access revocation and service-worker behavior are checked.
- Add parent self-service password changes/recovery after email delivery is configured. Parent account creation currently gives the school a generated password to deliver privately.
- Add notification pagination/read management across the family dashboard and operational monitoring for deliveries exhausting five attempts. Push delivery is best effort; in-app notifications remain the source of truth.
