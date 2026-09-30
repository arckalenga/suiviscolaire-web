
begin;
create temp table qa_context as select
 (select user_id from public.web_admins limit 1) admin_id,
 (select user_id from public.web_memberships where school_id=s.id and role='finance' and active limit 1) finance_id,
 (select user_id from public.web_memberships where school_id=s.id and role='gestionnaire' and active limit 1) gestion_id,
 (select user_id from public.web_memberships where school_id=s.id and role='subadmin' and active limit 1) sub_id,
 (select user_id from public.web_memberships where school_id=s.id and role='student' and active limit 1) student_user,
 s.id school_id,
 (select id from public.web_schools where id<>s.id limit 1) other_school,
 (select id from public.web_students where school_id=s.id and not archived limit 1) student_id,
 (select class_name from public.web_students where school_id=s.id and not archived limit 1) class_name,
 gen_random_uuid() worker_id
 from public.web_schools s where s.name='Complexe scolaire du Fleuve';
insert into public.web_workers(id,school_id,name,kind) select worker_id,school_id,'QA worker rollback','worker' from qa_context;
grant select on qa_context to authenticated;
set local role authenticated;
do $test$
declare q record; n integer; pid uuid; failed boolean; cnt integer; begin
 select * into q from qa_context;
 if q.finance_id is null or q.gestion_id is null or q.sub_id is null then raise exception 'Missing fixture'; end if;
 perform set_config('request.jwt.claim.sub',q.finance_id::text,true);
 if not public.web_finance(q.school_id) or public.web_manage(q.school_id) or public.web_access(q.other_school) then raise exception 'Finance role incorrect'; end if;
 if not exists(select 1 from public.web_students where id=q.student_id) then raise exception 'Finance student read failed'; end if;
 if exists(select 1 from public.web_students where school_id=q.other_school) then raise exception 'Cross-school leak'; end if;
 insert into public.web_payments(school_id,student_id,label,amount,currency,paid_on,reference)
 values(q.school_id,q.student_id,'QA rollback',1,'USD',current_date,'QA rollback') returning id into pid;
 insert into public.web_staff_payments(school_id,worker_id,label,amount,currency,paid_on,reference)
 values(q.school_id,q.worker_id,'QA rollback',1,'CDF',current_date,'QA rollback');
 failed=false;
 begin perform public.web_save_attendance(q.school_id,'student',current_date,jsonb_build_array(jsonb_build_object('person_id',q.student_id,'status','present')),q.class_name); exception when others then failed=true; end;
 if not failed then raise exception 'Finance can write attendance'; end if;
 perform set_config('request.jwt.claim.sub',q.gestion_id::text,true);
 if not exists(select 1 from public.web_payments where id=pid) then raise exception 'Gestionnaire read failed'; end if;
 update public.web_payments set amount=77 where id=pid; get diagnostics n=row_count;
 if n<>0 then raise exception 'Gestionnaire changed payment'; end if;
 failed=false;
 begin insert into public.web_payments(school_id,student_id,label,amount,currency,paid_on,reference) values(q.school_id,q.student_id,'Blocked',1,'USD',current_date,'Blocked'); exception when insufficient_privilege then failed=true; end;
 if not failed then raise exception 'Gestionnaire inserted payment'; end if;
 failed=false;
 begin perform public.web_save_attendance(q.school_id,'worker',current_date,jsonb_build_array(jsonb_build_object('person_id',q.worker_id,'status','present'))); exception when others then failed=true; end;
 if not failed then raise exception 'Gestionnaire attendance write'; end if;
 perform set_config('request.jwt.claim.sub',q.sub_id::text,true);
 failed=false;
 begin insert into public.web_staff_payments(school_id,worker_id,label,amount,currency,paid_on,reference) values(q.school_id,q.worker_id,'Blocked',1,'USD',current_date,'Blocked'); exception when insufficient_privilege then failed=true; end;
 if not failed then raise exception 'Subadmin inserted salary'; end if;
 failed=false;
 begin insert into public.web_payments(school_id,student_id,label,amount,currency,paid_on,reference) values(q.school_id,q.student_id,'Blocked',1,'USD',current_date,'Blocked'); exception when insufficient_privilege then failed=true; end;
 if not failed then raise exception 'Subadmin inserted payment'; end if;
 update public.web_payments set amount=77 where id=pid; get diagnostics n=row_count;
 if n<>0 then raise exception 'Subadmin changed payment'; end if;
 perform public.web_save_attendance(q.school_id,'student',current_date,jsonb_build_array(jsonb_build_object('person_id',q.student_id,'status','present')),q.class_name);
 perform public.web_save_attendance(q.school_id,'worker',current_date,jsonb_build_array(jsonb_build_object('person_id',q.worker_id,'status','late')));
 if not exists(select 1 from public.web_student_attendance where person_id=q.student_id and attended_on=current_date and recorded_by=q.sub_id) then raise exception 'Attendance audit actor missing'; end if;
 failed=false;
 begin perform public.web_save_attendance(q.school_id,'student',current_date,jsonb_build_array(jsonb_build_object('person_id',q.student_id,'status','absent'),jsonb_build_object('person_id',gen_random_uuid(),'status','present')),q.class_name); exception when others then failed=true; end;
 if not failed or not exists(select 1 from public.web_student_attendance where person_id=q.student_id and attended_on=current_date and status='present') then raise exception 'Attendance batch not atomic'; end if;
 perform set_config('request.jwt.claim.sub',q.student_user::text,true);
 if exists(select 1 from public.web_staff_payments) or exists(select 1 from public.web_activity_log) or exists(select 1 from public.web_delivery_contacts) then raise exception 'Student staff data leak'; end if;
 perform set_config('request.jwt.claim.sub',q.admin_id::text,true);
 if not public.web_finance(q.school_id) or not public.web_manage(q.school_id) then raise exception 'Admin override failed'; end if;
 update public.web_payments set amount=2 where id=pid; get diagnostics n=row_count;
 if n<>1 then raise exception 'Admin cannot edit payment'; end if;
 if not exists(select 1 from public.web_activity_log where record_id=pid and operation='UPDATE' and actor_id=q.admin_id) then raise exception 'Payment audit missing'; end if;
 update public.web_memberships set active=false where user_id=q.finance_id and school_id=q.school_id;
 perform set_config('request.jwt.claim.sub',q.finance_id::text,true);
 if public.web_finance(q.school_id) or exists(select 1 from public.web_payments where id=pid) then raise exception 'Inactive finance retains access'; end if;
end $test$;
reset role;
rollback;
select 'PASS: finance, gestionnaire, subadmin, admin, student, cross-school, deactivation, atomic attendance and audit' result;
