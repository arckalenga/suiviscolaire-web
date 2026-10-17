alter table public.web_schools add column full_name text check(full_name is null or length(trim(full_name)) between 2 and 200);
alter table public.web_schools add column logo_key text check(logo_key is null or logo_key in ('itc-kolwezi'));
