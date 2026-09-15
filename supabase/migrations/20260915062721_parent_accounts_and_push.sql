create table public.web_parents(user_id uuid primary key references auth.users(id) on delete cascade,name text not null,email text not null unique);
create table public.web_guardians(parent_id uuid not null references public.web_parents(user_id) on delete cascade,student_id uuid not null,school_id uuid not null,active boolean not null default true,primary key(parent_id,student_id),foreign key(student_id,school_id) references public.web_students(id,school_id) on delete cascade);
alter table public.web_parents enable row level security;
alter table public.web_guardians enable row level security;
create policy guardians_read on public.web_guardians for select to authenticated using(parent_id=(select auth.uid()) or public.web_manage(school_id));
create policy parents_read on public.web_parents for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.web_guardians g where g.parent_id=user_id and public.web_manage(g.school_id)));
grant select on public.web_parents,public.web_guardians to authenticated;
grant all on public.web_parents,public.web_guardians to service_role;
revoke all on public.web_parents,public.web_guardians from anon;
create index guardians_student on public.web_guardians(student_id,school_id);
create index guardians_school on public.web_guardians(school_id);
create function public.web_parent_of(sid uuid) returns boolean language sql stable security invoker set search_path='' as $$select exists(select 1 from public.web_guardians where parent_id=(select auth.uid()) and student_id=sid and active)$$;
revoke all on function public.web_parent_of(uuid) from public,anon;
grant execute on function public.web_parent_of(uuid) to authenticated;
create or replace function public.web_access(sid uuid) returns boolean language sql stable security invoker set search_path='' as $$select public.web_is_admin() or exists(select 1 from public.web_memberships where user_id=(select auth.uid()) and school_id=sid and active) or exists(select 1 from public.web_guardians where parent_id=(select auth.uid()) and school_id=sid and active)$$;
drop policy students_read on public.web_students;
create policy students_read on public.web_students for select to authenticated using(public.web_manage(school_id) or (not archived and (user_id=(select auth.uid()) or public.web_parent_of(id)) and public.web_access(school_id)));
create or replace function public.web_own_student(sid uuid) returns boolean language sql stable security invoker set search_path='' as $$select exists(select 1 from public.web_students where id=sid and not archived and (user_id=(select auth.uid()) or public.web_parent_of(id)) and public.web_access(school_id))$$;
create or replace function public.web_class(sid uuid,cname text) returns boolean language sql stable security invoker set search_path='' as $$select public.web_manage(sid) or exists(select 1 from public.web_students where school_id=sid and class_name=cname and not archived and (user_id=(select auth.uid()) or public.web_parent_of(id)) and public.web_access(sid))$$;
create or replace view public.web_notifications with(security_invoker=true) as
select 'mark:'||m.id::text||':'||a.published_at::text as id,m.school_id,s.name||' · Note publiée : '||a.title as title,'Une nouvelle note est disponible dans « Voir les points ».'::text as body,a.published_at as created_at,'marks'::text as destination
from public.web_marks m join public.web_assignments a on a.id=m.assignment_id join public.web_students s on s.id=m.student_id where a.published and public.web_own_student(m.student_id)
union all select 'message:'||id::text,school_id,title,body,created_at,'messages' from public.web_messages;

create function public.web_provision_parent(uid uuid,full_name text,mail text,children uuid[]) returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.web_parents(user_id,name,email) values(uid,full_name,mail) on conflict(user_id) do nothing;
 insert into public.web_guardians(parent_id,student_id,school_id) select uid,id,school_id from public.web_students where id=any(children) and not archived on conflict(parent_id,student_id) do update set active=true;
end $$;
revoke all on function public.web_provision_parent(uuid,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.web_provision_parent(uuid,text,text,uuid[]) to service_role;
create table public.web_push_config(id int primary key check(id=1),public_key text not null,private_key text not null,worker_token text not null);
create table public.web_push_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,endpoint text not null unique,keys jsonb not null,created_at timestamptz not null default now());
create table public.web_push_jobs(id bigint generated always as identity primary key,subscription_id uuid not null references public.web_push_subscriptions(id) on delete cascade,student_id uuid not null references public.web_students(id) on delete cascade,assignment_id uuid not null references public.web_assignments(id) on delete cascade,published_at timestamptz not null,attempts int not null default 0,available_at timestamptz not null default now(),done boolean not null default false,unique(subscription_id,student_id,assignment_id,published_at));
alter table public.web_push_config enable row level security;
alter table public.web_push_subscriptions enable row level security;
alter table public.web_push_jobs enable row level security;
revoke all on public.web_push_config,public.web_push_subscriptions,public.web_push_jobs from public,anon,authenticated;
grant all on public.web_push_config,public.web_push_subscriptions,public.web_push_jobs to service_role;
grant usage,select on sequence public.web_push_jobs_id_seq to service_role;
create index push_subscriptions_user on public.web_push_subscriptions(user_id);
create index push_jobs_pending on public.web_push_jobs(available_at) where not done;
create index push_jobs_student on public.web_push_jobs(student_id);
create index push_jobs_assignment on public.web_push_jobs(assignment_id);
create schema if not exists app_private;
revoke all on schema app_private from public,anon,authenticated;
create function app_private.enqueue_mark_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return new;end if;
 if not public.web_manage(new.school_id) then raise exception 'Publication access denied';end if;
 if new.published and (TG_OP='INSERT' or not old.published) then
 insert into public.web_push_jobs(subscription_id,student_id,assignment_id,published_at)
 select distinct sub.id,s.id,new.id,new.published_at from public.web_students s
 join public.web_marks m on m.student_id=s.id and m.assignment_id=new.id
 join public.web_push_subscriptions sub on
 (sub.user_id=s.user_id and exists(select 1 from public.web_memberships mm where mm.user_id=s.user_id and mm.school_id=s.school_id and mm.active and mm.role='student'))
 or exists(select 1 from public.web_guardians g where g.parent_id=sub.user_id and g.student_id=s.id and g.active)
 where not s.archived and s.school_id=new.school_id and s.class_name=new.class_name
 on conflict do nothing;
 end if;return new;
end $$;
revoke all on function app_private.enqueue_mark_push() from public,anon,authenticated;
create trigger enqueue_mark_push after insert or update of published on public.web_assignments for each row execute function app_private.enqueue_mark_push();
create function public.web_claim_push_jobs() returns setof public.web_push_jobs language sql security invoker set search_path='' as $$
 update public.web_push_jobs set available_at=now()+interval '2 minutes',attempts=attempts+1
 where id in(select id from public.web_push_jobs where not done and attempts<5 and available_at<=now() order by id for update skip locked limit 20) returning *
$$;
revoke all on function public.web_claim_push_jobs() from public,anon,authenticated;
grant execute on function public.web_claim_push_jobs() to service_role;
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('suiviscolaire-mark-push','* * * * *',$job$
 select net.http_post(url:='https://qcthoclsgckohaaamlki.supabase.co/functions/v1/web-push',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('action','deliver','worker_token',c.worker_token),timeout_milliseconds:=55000)
 from public.web_push_config c where c.id=1 and exists(select 1 from public.web_push_jobs where not done and attempts<5 and available_at<=now());
$job$);
create or replace function public.web_own_student(sid uuid) returns boolean language sql stable security invoker set search_path='' as $$select exists(select 1 from public.web_students where id=sid and not archived and (user_id=(select auth.uid()) or public.web_parent_of(id)))$$;
create or replace function public.web_class(sid uuid,cname text) returns boolean language sql stable security invoker set search_path='' as $$select public.web_manage(sid) or exists(select 1 from public.web_students where school_id=sid and class_name=cname and not archived and (user_id=(select auth.uid()) or public.web_parent_of(id)))$$;
create or replace view public.web_notifications with(security_invoker=true) as
select 'mark:'||m.id::text||':'||a.published_at::text as id,m.school_id,s.name||' · Note publiée : '||a.title as title,'Une nouvelle note est disponible dans « Voir les points ».'::text as body,a.published_at as created_at,'marks'::text as destination
from public.web_marks m join public.web_assignments a on a.id=m.assignment_id join public.web_students s on s.id=m.student_id where a.published and (s.user_id=(select auth.uid()) or public.web_parent_of(s.id))
union all select 'message:'||id::text,school_id,title,body,created_at,'messages' from public.web_messages;
create function app_private.readable_children() returns uuid[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(s.id),'{}'::uuid[]) from public.web_students s where auth.uid() is not null and not s.archived and (
 (s.user_id=auth.uid() and exists(select 1 from public.web_memberships m where m.user_id=auth.uid() and m.school_id=s.school_id and m.active and m.role='student'))
 or exists(select 1 from public.web_guardians g where g.parent_id=auth.uid() and g.student_id=s.id and g.active))
$$;
revoke all on function app_private.readable_children() from public,anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.readable_children() to authenticated;
drop policy students_read on public.web_students;
create policy students_read on public.web_students for select to authenticated using(public.web_manage(school_id) or id=any((select app_private.readable_children())::uuid[]));
create or replace function public.web_own_student(sid uuid) returns boolean language sql stable security invoker set search_path='' as $$select sid=any((select app_private.readable_children())::uuid[])$$;

create function app_private.readable_assignments() returns uuid[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(a.id),'{}'::uuid[]) from public.web_assignments a where auth.uid() is not null and a.published and exists(select 1 from public.web_students s where s.id=any(app_private.readable_children()) and s.school_id=a.school_id and s.class_name=a.class_name)
$$;
revoke all on function app_private.readable_assignments() from public,anon;
grant execute on function app_private.readable_assignments() to authenticated;
drop policy assignments_read on public.web_assignments;
create policy assignments_read on public.web_assignments for select to authenticated using(public.web_manage(school_id) or id=any((select app_private.readable_assignments())::uuid[]));
drop policy marks_read on public.web_marks;
create policy marks_read on public.web_marks for select to authenticated using(public.web_manage(school_id) or (student_id=any((select app_private.readable_children())::uuid[]) and assignment_id=any((select app_private.readable_assignments())::uuid[])));

create policy push_config_service on public.web_push_config for all to service_role using(true) with check(true);
create policy push_jobs_service on public.web_push_jobs for all to service_role using(true) with check(true);
create policy push_subscriptions_service on public.web_push_subscriptions for all to service_role using(true) with check(true);
drop extension pg_net;
create extension pg_net with schema extensions;
create or replace view public.web_notifications with(security_invoker=true) as
select 'mark:'||m.id::text||':'||a.published_at::text as id,m.school_id,s.name||' · Note publiée : '||a.title as title,'Une nouvelle note est disponible dans « Voir les points ».'::text as body,a.published_at as created_at,'marks'::text as destination,s.id as student_id
from public.web_marks m join public.web_assignments a on a.id=m.assignment_id join public.web_students s on s.id=m.student_id where a.published and (s.user_id=(select auth.uid()) or public.web_parent_of(s.id))
union all select 'message:'||id::text,school_id,title,body,created_at,'messages',student_id from public.web_messages;