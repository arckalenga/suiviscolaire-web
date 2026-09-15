alter table public.web_students add column bulletin_blocked boolean not null default false;
grant update(bulletin_blocked) on public.web_students to authenticated;

create function public.web_set_subadmin_active(target uuid, enabled boolean) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.web_is_admin() or exists(select 1 from public.web_admins where user_id=target) then raise exception 'Access denied'; end if;
 if not exists(select 1 from public.web_staff where user_id=target) then raise exception 'Unknown sub-admin'; end if;
 update public.web_memberships set active=enabled where user_id=target and role='subadmin';
end $$;
revoke all on function public.web_set_subadmin_active(uuid,boolean) from public,anon;
grant execute on function public.web_set_subadmin_active(uuid,boolean) to authenticated;

create table public.web_workers(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.web_schools(id),
 name text not null check(length(trim(name)) between 2 and 150),
 kind text not null check(kind in ('teacher','worker')),
 active boolean not null default true,
 unique(id,school_id));
create table public.web_teacher_subjects(
 school_id uuid not null,
 worker_id uuid not null,
 subject_id uuid not null,
 primary key(worker_id,subject_id),
 foreign key(worker_id,school_id) references public.web_workers(id,school_id) on delete cascade,
 foreign key(subject_id,school_id) references public.web_subjects(id,school_id));
create table public.web_staff_payments(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null,
 worker_id uuid not null,
 label text not null check(length(trim(label)) between 1 and 200),
 amount numeric(14,2) not null check(amount>0),
 currency text not null check(currency in ('CDF','USD')),
 paid_on date not null,
 reference text not null check(length(trim(reference)) between 1 and 150),
 foreign key(worker_id,school_id) references public.web_workers(id,school_id));
alter table public.web_workers enable row level security;
alter table public.web_teacher_subjects enable row level security;
alter table public.web_staff_payments enable row level security;
create policy workers_manage on public.web_workers for all to authenticated using(public.web_manage(school_id)) with check(public.web_manage(school_id));
create policy teacher_subjects_manage on public.web_teacher_subjects for all to authenticated using(public.web_manage(school_id)) with check(public.web_manage(school_id) and exists(select 1 from public.web_workers w where w.id=worker_id and w.school_id=web_teacher_subjects.school_id and w.kind='teacher'));
create policy staff_payments_manage on public.web_staff_payments for all to authenticated using(public.web_manage(school_id)) with check(public.web_manage(school_id));
revoke all on public.web_workers,public.web_teacher_subjects,public.web_staff_payments from anon;
grant select,insert,update,delete on public.web_workers,public.web_teacher_subjects,public.web_staff_payments to authenticated;
grant all on public.web_workers,public.web_teacher_subjects,public.web_staff_payments to service_role;
create index workers_school on public.web_workers(school_id);
create index teacher_subjects_school on public.web_teacher_subjects(school_id);
create index teacher_subjects_subject on public.web_teacher_subjects(subject_id,school_id);
create index staff_payments_worker on public.web_staff_payments(worker_id,school_id);
create index staff_payments_school on public.web_staff_payments(school_id);
