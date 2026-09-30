
-- Distinct financial, academic and oversight privileges.
alter table public.web_memberships drop constraint web_memberships_role_check;
alter table public.web_memberships add constraint web_memberships_role_check check(role in ('student','subadmin','finance','gestionnaire'));
create or replace function public.web_school_staff(sid uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select (select public.web_is_admin()) or exists(select 1 from public.web_memberships where user_id=(select auth.uid()) and school_id=sid and active and role in ('subadmin','finance','gestionnaire'))
$$;
create or replace function public.web_finance(sid uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select (select public.web_is_admin()) or exists(select 1 from public.web_memberships where user_id=(select auth.uid()) and school_id=sid and active and role='finance')
$$;
revoke all on function public.web_school_staff(uuid),public.web_finance(uuid) from public,anon;
grant execute on function public.web_school_staff(uuid),public.web_finance(uuid) to authenticated;
create or replace function public.web_provision_account(uid uuid,profile jsonb,school_ids uuid[],account_role text) returns void language plpgsql security invoker set search_path='' as $$
declare sid uuid; begin
 if account_role not in ('student','subadmin','finance','gestionnaire') or coalesce(cardinality(school_ids),0)<1 then raise exception 'Invalid account'; end if;
 if account_role='student' then
  if cardinality(school_ids)<>1 then raise exception 'One school required'; end if;
  insert into public.web_students(user_id,school_id,name,class_name,matricule,sex,birth_date,email) values(uid,school_ids[1],profile->>'name',profile->>'class_name',profile->>'matricule',nullif(profile->>'sex',''),nullif(profile->>'birth_date','')::date,profile->>'email');
 else insert into public.web_staff values(uid,profile->>'name',profile->>'email'); end if;
 foreach sid in array school_ids loop insert into public.web_memberships(user_id,school_id,role) values(uid,sid,account_role); end loop;
end $$;
create or replace function public.web_set_subadmin_active(target uuid,enabled boolean) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.web_is_admin() or exists(select 1 from public.web_admins where user_id=target) then raise exception 'Access denied'; end if;
 if not exists(select 1 from public.web_staff where user_id=target) then raise exception 'Unknown staff'; end if;
 update public.web_memberships set active=enabled where user_id=target and role in ('subadmin','finance','gestionnaire');
end $$;
drop policy payments_write on public.web_payments;
create policy payments_finance on public.web_payments for all to authenticated using(public.web_finance(school_id)) with check(public.web_finance(school_id));
drop policy staff_payments_manage on public.web_staff_payments;
create policy staff_payments_finance on public.web_staff_payments for all to authenticated using(public.web_finance(school_id)) with check(public.web_finance(school_id));
create policy students_staff_read on public.web_students for select to authenticated using(public.web_school_staff(school_id));
create policy assignments_staff_read on public.web_assignments for select to authenticated using(public.web_school_staff(school_id));
create policy marks_staff_read on public.web_marks for select to authenticated using(public.web_school_staff(school_id));
create policy payments_staff_read on public.web_payments for select to authenticated using(public.web_school_staff(school_id));
create policy classes_staff_read on public.web_classes for select to authenticated using(public.web_school_staff(school_id));
create policy timetable_staff_read on public.web_timetable for select to authenticated using(public.web_school_staff(school_id));
create policy messages_staff_read on public.web_messages for select to authenticated using(public.web_school_staff(school_id));
create policy workers_staff_read on public.web_workers for select to authenticated using(public.web_school_staff(school_id));
create policy teacher_subjects_staff_read on public.web_teacher_subjects for select to authenticated using(public.web_school_staff(school_id));
create policy staff_payments_staff_read on public.web_staff_payments for select to authenticated using(public.web_school_staff(school_id));

create table public.web_activity_log(
 id bigint generated always as identity primary key,
 school_id uuid not null references public.web_schools(id),
 actor_id uuid references auth.users(id) on delete set null,
 entity text not null, operation text not null, record_id uuid not null,
 before_value jsonb, after_value jsonb, created_at timestamptz not null default now()
);
alter table public.web_activity_log enable row level security;
revoke all on public.web_activity_log from anon,authenticated;
grant select on public.web_activity_log to authenticated;
grant all on public.web_activity_log to service_role;
create policy activity_staff_read on public.web_activity_log for select to authenticated using(public.web_school_staff(school_id));
create index activity_school_date on public.web_activity_log(school_id,created_at desc);
create index activity_actor on public.web_activity_log(actor_id);
-- This trigger alone may append audit records; clients cannot forge or alter them.
create function app_private.audit_school_change() returns trigger language plpgsql security definer set search_path='' as $$
declare prior jsonb; following jsonb; item jsonb; begin
 if TG_OP<>'INSERT' then prior=to_jsonb(OLD); end if;
 if TG_OP<>'DELETE' then following=to_jsonb(NEW); end if;
 item=coalesce(following,prior);
 insert into public.web_activity_log(school_id,actor_id,entity,operation,record_id,before_value,after_value)
 values((item->>'school_id')::uuid,auth.uid(),TG_TABLE_NAME,TG_OP,(item->>'id')::uuid,prior,following);
 return coalesce(NEW,OLD);
end $$;
revoke all on function app_private.audit_school_change() from public,anon,authenticated;

create table public.web_student_attendance(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.web_schools(id),
 person_id uuid not null,
 attended_on date not null,
 status text not null check(status in ('present','absent','late','excused')),
 note text not null default '' check(length(note)<=500),
 recorded_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 unique(person_id,attended_on),
 foreign key(person_id,school_id) references public.web_students(id,school_id)
);
alter table public.web_student_attendance enable row level security;
revoke all on public.web_student_attendance from anon,authenticated;
grant select,insert,update on public.web_student_attendance to authenticated;
grant all on public.web_student_attendance to service_role;
create policy student_attendance_read on public.web_student_attendance for select to authenticated using(public.web_school_staff(school_id) or public.web_own_student(person_id));
create policy student_attendance_insert on public.web_student_attendance for insert to authenticated with check(public.web_manage(school_id));
create policy student_attendance_update on public.web_student_attendance for update to authenticated using(public.web_manage(school_id)) with check(public.web_manage(school_id));
create index student_attendance_school_date on public.web_student_attendance(school_id,attended_on);
create index student_attendance_actor on public.web_student_attendance(recorded_by);

create table public.web_worker_attendance(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.web_schools(id),
 person_id uuid not null,
 attended_on date not null,
 status text not null check(status in ('present','absent','late','excused')),
 note text not null default '' check(length(note)<=500),
 recorded_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 unique(person_id,attended_on),
 foreign key(person_id,school_id) references public.web_workers(id,school_id)
);
alter table public.web_worker_attendance enable row level security;
revoke all on public.web_worker_attendance from anon,authenticated;
grant select,insert,update on public.web_worker_attendance to authenticated;
grant all on public.web_worker_attendance to service_role;
create policy worker_attendance_read on public.web_worker_attendance for select to authenticated using(public.web_school_staff(school_id) );
create policy worker_attendance_insert on public.web_worker_attendance for insert to authenticated with check(public.web_manage(school_id));
create policy worker_attendance_update on public.web_worker_attendance for update to authenticated using(public.web_manage(school_id)) with check(public.web_manage(school_id));
create index worker_attendance_school_date on public.web_worker_attendance(school_id,attended_on);
create index worker_attendance_actor on public.web_worker_attendance(recorded_by);

create function app_private.validate_attendance() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.web_manage(NEW.school_id) then raise exception 'Attendance access denied'; end if;
 if TG_OP='UPDATE' and (OLD.school_id<>NEW.school_id or OLD.person_id<>NEW.person_id or OLD.attended_on<>NEW.attended_on) then raise exception 'Attendance identity cannot change'; end if;
 if TG_TABLE_NAME='web_student_attendance' then
  if not exists(select 1 from public.web_students where id=NEW.person_id and school_id=NEW.school_id and not archived) then raise exception 'Inactive student'; end if;
 else
  if not exists(select 1 from public.web_workers where id=NEW.person_id and school_id=NEW.school_id and active) then raise exception 'Inactive worker'; end if;
 end if;
 NEW.recorded_by=auth.uid(); NEW.updated_at=now(); return NEW;
end $$;
revoke all on function app_private.validate_attendance() from public,anon,authenticated;
create trigger validate_attendance before insert or update on public.web_student_attendance for each row execute function app_private.validate_attendance();
create trigger validate_attendance before insert or update on public.web_worker_attendance for each row execute function app_private.validate_attendance();
create trigger audit_change after insert or update or delete on public.web_payments for each row execute function app_private.audit_school_change();
create trigger audit_change after insert or update or delete on public.web_staff_payments for each row execute function app_private.audit_school_change();
create trigger audit_change after insert or update or delete on public.web_student_attendance for each row execute function app_private.audit_school_change();
create trigger audit_change after insert or update or delete on public.web_worker_attendance for each row execute function app_private.audit_school_change();

create function public.web_save_attendance(sid uuid,kind text,day date,entries jsonb,class_filter text default null) returns integer language plpgsql security invoker set search_path='' as $$
declare item jsonb; person uuid; total integer=0; begin
 if not public.web_manage(sid) then raise exception 'Access denied'; end if;
 if kind not in ('student','worker') or kind is null or day is null or jsonb_typeof(entries) is distinct from 'array' then raise exception 'Invalid attendance'; end if;
 if jsonb_array_length(entries) not between 1 and 500 then raise exception 'Invalid batch size'; end if;
 if (select count(*) from jsonb_array_elements(entries))<>(select count(distinct value->>'person_id') from jsonb_array_elements(entries)) then raise exception 'Duplicate or missing person'; end if;
 for item in select value from jsonb_array_elements(entries) loop
  person=(item->>'person_id')::uuid;
  if kind='student' then
   if class_filter is null or not exists(select 1 from public.web_students where id=person and school_id=sid and class_name=class_filter and not archived) then raise exception 'Student outside selected class'; end if;
   insert into public.web_student_attendance(school_id,person_id,attended_on,status,note)
   values(sid,person,day,item->>'status',coalesce(item->>'note',''))
   on conflict(person_id,attended_on) do update set status=excluded.status,note=excluded.note;
  else
   insert into public.web_worker_attendance(school_id,person_id,attended_on,status,note)
   values(sid,person,day,item->>'status',coalesce(item->>'note',''))
   on conflict(person_id,attended_on) do update set status=excluded.status,note=excluded.note;
  end if;
  total=total+1;
 end loop; return total;
end $$;
revoke all on function public.web_save_attendance(uuid,text,date,jsonb,text) from public,anon;
grant execute on function public.web_save_attendance(uuid,text,date,jsonb,text) to authenticated;
