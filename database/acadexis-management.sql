
create table public.web_classes(id uuid primary key default gen_random_uuid(),school_id uuid not null references public.web_schools(id),name text not null check(length(trim(name))>0),unique(school_id,name));
insert into public.web_classes(school_id,name) select school_id,class_name from public.web_students union select school_id,class_name from public.web_assignments union select school_id,class_name from public.web_timetable;
alter table public.web_classes enable row level security;
create policy classes_read on public.web_classes for select to authenticated using(public.web_class(school_id,name));
create policy classes_write on public.web_classes for all to authenticated using(public.web_manage(school_id)) with check(public.web_manage(school_id));
grant select,insert,update,delete on public.web_classes to authenticated; grant all on public.web_classes to service_role;
revoke all on public.web_classes from anon;
alter table public.web_students add column matricule text,add column archived boolean not null default false;
update public.web_students set matricule='EL-'||upper(left(id::text,8));
alter table public.web_students alter column matricule set not null;
alter table public.web_students add constraint student_matricule unique(school_id,matricule),add constraint student_class_fk foreign key(school_id,class_name) references public.web_classes(school_id,name);
alter table public.web_assignments add column kind text not null default 'devoir' check(kind in ('devoir','interrogation','examen','travail')),add column published_at timestamptz;
update public.web_assignments set kind=case when period=0 then 'examen' else 'devoir' end,published_at=case when published then now() else null end;
alter table public.web_assignments add constraint assignment_class_fk foreign key(school_id,class_name) references public.web_classes(school_id,name);
create function public.web_publish_stamp() returns trigger language plpgsql security invoker set search_path='' as $$ begin
if new.published and (TG_OP='INSERT' or not old.published) then new.published_at=now(); elsif not new.published then new.published_at=null; else new.published_at=old.published_at; end if; return new; end $$;
create trigger publish_stamp before insert or update on public.web_assignments for each row execute function public.web_publish_stamp();
alter table public.web_messages add column audience text not null default 'school' check(audience in ('school','class','student')),add column class_name text,add column student_id uuid;
alter table public.web_messages add constraint message_target check((audience='school' and class_name is null and student_id is null) or (audience='class' and class_name is not null and student_id is null) or (audience='student' and student_id is not null and class_name is null)),add constraint message_student_fk foreign key(student_id,school_id) references public.web_students(id,school_id),add constraint message_class_fk foreign key(school_id,class_name) references public.web_classes(school_id,name);
drop policy messages_read on public.web_messages;
create policy messages_read on public.web_messages for select to authenticated using(public.web_manage(school_id) or (public.web_access(school_id) and (audience='school' or (audience='class' and public.web_class(school_id,class_name)) or (audience='student' and public.web_own_student(student_id)))));
create or replace function public.web_own_student(sid uuid) returns boolean language sql stable security invoker set search_path='' as $$ select exists(select 1 from public.web_students where id=sid and user_id=(select auth.uid()) and not archived and public.web_access(school_id)) $$;
create or replace function public.web_class(sid uuid,cname text) returns boolean language sql stable security invoker set search_path='' as $$ select public.web_manage(sid) or exists(select 1 from public.web_students where school_id=sid and class_name=cname and not archived and user_id=(select auth.uid()) and public.web_access(sid)) $$;
drop policy students_read on public.web_students;
create policy students_read on public.web_students for select to authenticated using(public.web_manage(school_id) or (user_id=(select auth.uid()) and not archived and public.web_access(school_id)));
revoke insert,update,delete on public.web_students from authenticated;
grant update(name,sex,birth_date,class_name,matricule) on public.web_students to authenticated;
create table public.web_staff(user_id uuid primary key references auth.users(id),name text not null,email text not null);
insert into public.web_staff select distinct m.user_id,case when u.email like 'reseau@%' then 'Responsable du réseau' else 'Responsable du Fleuve' end,u.email from public.web_memberships m join auth.users u on u.id=m.user_id where m.role='subadmin';
alter table public.web_staff enable row level security;
create policy staff_read on public.web_staff for select to authenticated using(public.web_is_admin());
grant select on public.web_staff to authenticated;grant all on public.web_staff to service_role;revoke all on public.web_staff from anon;
create table public.web_notification_reads(user_id uuid not null default auth.uid() references auth.users(id),notification_id text not null,read_at timestamptz not null default now(),primary key(user_id,notification_id));
alter table public.web_notification_reads enable row level security;
create policy reads_own on public.web_notification_reads for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update on public.web_notification_reads to authenticated;grant all on public.web_notification_reads to service_role;revoke all on public.web_notification_reads from anon;
create view public.web_notifications with(security_invoker=true) as
select 'mark:'||m.id::text||':'||a.published_at::text as id,m.school_id,'Note publiée : '||a.title as title,'Votre note est disponible dans « Voir les points ».'::text as body,a.published_at as created_at,'marks'::text as destination
from public.web_marks m join public.web_assignments a on a.id=m.assignment_id where a.published and public.web_own_student(m.student_id)
union all select 'message:'||id::text,school_id,title,body,created_at,'messages' from public.web_messages;
grant select on public.web_notifications to authenticated;revoke all on public.web_notifications from anon;
-- Service-only transaction used after the Edge Function validates the caller.
create function public.web_provision_account(uid uuid,profile jsonb,school_ids uuid[],account_role text) returns void language plpgsql security invoker set search_path='' as $$ declare sid uuid; begin
if account_role not in ('student','subadmin') or cardinality(school_ids)<1 then raise exception 'Invalid account';end if;
if account_role='student' then
if cardinality(school_ids)<>1 then raise exception 'One school required';end if;
insert into public.web_students(user_id,school_id,name,class_name,matricule,sex,birth_date) values(uid,school_ids[1],profile->>'name',profile->>'class_name',profile->>'matricule',nullif(profile->>'sex',''),nullif(profile->>'birth_date','')::date);
else insert into public.web_staff values(uid,profile->>'name',profile->>'email');end if;
foreach sid in array school_ids loop insert into public.web_memberships(user_id,school_id,role) values(uid,sid,account_role);end loop;
end $$;
revoke all on function public.web_provision_account(uuid,jsonb,uuid[],text) from public,anon,authenticated;grant execute on function public.web_provision_account(uuid,jsonb,uuid[],text) to service_role;
create function public.web_archive_student(sid uuid,is_archived boolean) returns void language plpgsql security invoker set search_path='' as $$ declare uid uuid;sch uuid;begin
update public.web_students set archived=is_archived where id=sid returning user_id,school_id into uid,sch;
if not found then raise exception 'Student missing';end if;
update public.web_memberships set active=not is_archived where user_id=uid and school_id=sch and role='student';
end $$;
revoke all on function public.web_archive_student(uuid,boolean) from public,anon,authenticated;grant execute on function public.web_archive_student(uuid,boolean) to service_role;
create function public.web_import_marks(assignment uuid,entries jsonb) returns integer language plpgsql security invoker set search_path='' as $$ declare school uuid;item jsonb;counted int=0;pub boolean;begin
select school_id,published into school,pub from public.web_assignments where id=assignment for update;
if school is null or not public.web_manage(school) then raise exception 'Not authorized';end if;
if pub then raise exception 'Hide assignment before importing marks';end if;
if jsonb_typeof(entries)<>'array' or jsonb_array_length(entries)>500 or jsonb_array_length(entries)<1 then raise exception 'Invalid batch';end if;
if (select count(*) from jsonb_array_elements(entries))<>(select count(distinct value->>'student_id') from jsonb_array_elements(entries)) then raise exception 'Duplicate students';end if;
for item in select value from jsonb_array_elements(entries) loop
if exists(select 1 from public.web_students where id=(item->>'student_id')::uuid and archived) then raise exception 'Archived student';end if;
insert into public.web_marks(school_id,student_id,assignment_id,score) values(school,(item->>'student_id')::uuid,assignment,(item->>'score')::numeric) on conflict(student_id,assignment_id) do update set score=excluded.score;counted=counted+1;
end loop;return counted;end $$;
revoke all on function public.web_import_marks(uuid,jsonb) from public,anon;grant execute on function public.web_import_marks(uuid,jsonb) to authenticated;
create index web_messages_student on public.web_messages(student_id,school_id);
create index web_messages_class on public.web_messages(school_id,class_name);
create index web_students_class on public.web_students(school_id,class_name);
create index web_assignments_class on public.web_assignments(school_id,class_name);

alter table public.web_students add column email text;
update public.web_students s set email=u.email from auth.users u where u.id=s.user_id;
create or replace function public.web_provision_account(uid uuid,profile jsonb,school_ids uuid[],account_role text) returns void language plpgsql security invoker set search_path='' as $$ declare sid uuid; begin
if account_role not in ('student','subadmin') or cardinality(school_ids)<1 then raise exception 'Invalid account';end if;
if account_role='student' then
if cardinality(school_ids)<>1 then raise exception 'One school required';end if;
insert into public.web_students(user_id,school_id,name,class_name,matricule,sex,birth_date,email) values(uid,school_ids[1],profile->>'name',profile->>'class_name',profile->>'matricule',nullif(profile->>'sex',''),nullif(profile->>'birth_date','')::date,profile->>'email');
else insert into public.web_staff values(uid,profile->>'name',profile->>'email');end if;
foreach sid in array school_ids loop insert into public.web_memberships(user_id,school_id,role) values(uid,sid,account_role);end loop;
end $$;
alter table public.web_assignments add constraint assessment_kind_period check((kind='examen')=(period=0));
