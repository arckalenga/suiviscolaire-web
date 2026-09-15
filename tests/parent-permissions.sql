-- Run after creating the temporary four-child Parent Test Famille QA account.
begin;
select set_config('qa.parent',(select user_id::text from public.web_parents where name='Parent Test Famille' limit 1),true);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.parent'),'role','authenticated')::text,true);
do $$ begin
 if (select count(*) from public.web_students)<>4 then raise exception 'Parent scope failed';end if;
 if exists(select 1 from public.web_staff_payments) then raise exception 'Payroll exposed';end if;
 if exists(select 1 from public.web_assignments where not published) then raise exception 'Drafts exposed';end if;
 update public.web_students set bulletin_blocked=true;if found then raise exception 'Parent write allowed';end if;
end $$;
reset role;
update public.web_guardians set active=false where parent_id=current_setting('qa.parent')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.parent'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.web_students) or exists(select 1 from public.web_marks) or exists(select 1 from public.web_notifications) then raise exception 'Revocation failed';end if;
end $$;
rollback;
