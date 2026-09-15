alter table public.web_schools add column student_email_domain text unique;
alter table public.web_schools add constraint web_school_email_domain_valid check (
student_email_domain is null or (length(student_email_domain) <= 190 and student_email_domain = lower(student_email_domain)
and student_email_domain ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$'));
