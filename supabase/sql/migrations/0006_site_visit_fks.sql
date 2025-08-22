-- Add FKs for site_visit embeds required by PostgREST
-- Ensure columns exist and constraints are created only if missing

do $$
begin
	-- project_id → projects(id)
	if not exists (
		select 1 from pg_constraint c
		join pg_class t on t.oid = c.conrelid and t.relname = 'site_visit'
		where c.contype = 'f' and c.conname = 'site_visit_project_id_fkey'
	) then
		alter table public.site_visit
			add constraint site_visit_project_id_fkey foreign key (project_id)
			references public.projects(id) on update cascade on delete set null;
	end if;

	-- job_site_id → job_sites(id)
	if not exists (
		select 1 from pg_constraint c
		join pg_class t on t.oid = c.conrelid and t.relname = 'site_visit'
		where c.contype = 'f' and c.conname = 'site_visit_job_site_id_fkey'
	) then
		alter table public.site_visit
			add constraint site_visit_job_site_id_fkey foreign key (job_site_id)
			references public.job_sites(id) on update cascade on delete set null;
	end if;

	-- employer_id → employers(id)
	if not exists (
		select 1 from pg_constraint c
		join pg_class t on t.oid = c.conrelid and t.relname = 'site_visit'
		where c.contype = 'f' and c.conname = 'site_visit_employer_id_fkey'
	) then
		alter table public.site_visit
			add constraint site_visit_employer_id_fkey foreign key (employer_id)
			references public.employers(id) on update cascade on delete set null;
	end if;

	-- organiser_id → profiles(id)
	if not exists (
		select 1 from pg_constraint c
		join pg_class t on t.oid = c.conrelid and t.relname = 'site_visit'
		where c.contype = 'f' and c.conname = 'site_visit_organiser_id_fkey'
	) then
		alter table public.site_visit
			add constraint site_visit_organiser_id_fkey foreign key (organiser_id)
			references public.profiles(id) on update cascade on delete set null;
	end if;
end $$;