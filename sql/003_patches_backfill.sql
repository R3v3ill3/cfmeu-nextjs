-- Backfill from legacy job_sites.patch string
do $$
declare r record; p_id uuid; s record;
begin
  for r in (
    select distinct trim(patch) as patch
    from job_sites
    where coalesce(trim(patch),'') <> ''
  ) loop
    insert into patches (name, type)
    values (r.patch, 'geo')
    on conflict (lower(name)) do nothing;
    select id into p_id from patches where lower(name) = lower(r.patch) limit 1;
    for s in (
      select id from job_sites where trim(patch) = r.patch
    ) loop
      insert into patch_job_sites(patch_id, job_site_id)
      values (p_id, s.id)
      on conflict (patch_id, job_site_id) where effective_to is null do nothing;
    end loop;
  end loop;
end $$;

