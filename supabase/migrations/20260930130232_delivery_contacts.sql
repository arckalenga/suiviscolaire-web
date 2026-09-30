
create table public.web_delivery_contacts(
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.web_schools(id),
 student_id uuid, worker_id uuid,
 recipient_name text not null check(length(trim(recipient_name)) between 2 and 150),
 email text not null default '' check(email='' or (length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 phone text not null default '' check(phone='' or phone ~ '^\+[1-9][0-9]{7,14}$'),
 email_consent boolean not null default false, whatsapp_consent boolean not null default false,
 check((student_id is not null)::int+(worker_id is not null)::int=1),
 check(not email_consent or email<>''), check(not whatsapp_consent or phone<>''),
 unique(student_id),unique(worker_id),
 foreign key(student_id,school_id) references public.web_students(id,school_id),
 foreign key(worker_id,school_id) references public.web_workers(id,school_id)
);
alter table public.web_delivery_contacts enable row level security;
revoke all on public.web_delivery_contacts from anon,authenticated;
grant select,insert,update,delete on public.web_delivery_contacts to authenticated;
grant all on public.web_delivery_contacts to service_role;
create policy contacts_staff_read on public.web_delivery_contacts for select to authenticated using(public.web_school_staff(school_id));
create policy contacts_manage on public.web_delivery_contacts for all to authenticated using(public.web_manage(school_id) or public.web_finance(school_id)) with check(public.web_manage(school_id) or public.web_finance(school_id));
create index contacts_school on public.web_delivery_contacts(school_id);
create table public.web_delivery_log(
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.web_schools(id),
 contact_id uuid not null references public.web_delivery_contacts(id),
 channel text not null check(channel in ('email','whatsapp')),
 event_kind text not null check(event_kind in ('payment','staff_payment','mark','message')),
 event_id uuid not null, event_version text not null default '',
 status text not null check(status in ('sending','accepted','failed','uncertain')),
 actor_id uuid references auth.users(id) on delete set null,
 provider_id text, created_at timestamptz not null default now(),
 unique(contact_id,channel,event_kind,event_id,event_version)
);
alter table public.web_delivery_log enable row level security;
revoke all on public.web_delivery_log from anon,authenticated;
grant select on public.web_delivery_log to authenticated;
grant all on public.web_delivery_log to service_role;
create policy deliveries_staff_read on public.web_delivery_log for select to authenticated using(public.web_school_staff(school_id));
create index delivery_school_date on public.web_delivery_log(school_id,created_at desc);
create index delivery_actor on public.web_delivery_log(actor_id);
