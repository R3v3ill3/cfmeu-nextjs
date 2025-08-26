-- Enable RLS and create baseline policies for new activity tables

alter table if exists union_activity_scopes enable row level security;
alter table if exists activity_workers enable row level security;
alter table if exists activity_rating_definitions enable row level security;
alter table if exists activity_objectives enable row level security;
alter table if exists activity_objective_targets enable row level security;

-- Admin full access
-- Note: profiles.role is used elsewhere; mirror that approach

-- union_activity_scopes
drop policy if exists union_activity_scopes_admin_all on union_activity_scopes;
create policy union_activity_scopes_admin_all on union_activity_scopes for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- activity_workers
drop policy if exists activity_workers_admin_all on activity_workers;
create policy activity_workers_admin_all on activity_workers for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- activity_rating_definitions
drop policy if exists activity_rating_definitions_admin_all on activity_rating_definitions;
create policy activity_rating_definitions_admin_all on activity_rating_definitions for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- activity_objectives
drop policy if exists activity_objectives_admin_all on activity_objectives;
create policy activity_objectives_admin_all on activity_objectives for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- activity_objective_targets
drop policy if exists activity_objective_targets_admin_all on activity_objective_targets;
create policy activity_objective_targets_admin_all on activity_objective_targets for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Baseline authenticated read/write (can be tightened later per campaign ownership)
-- Select for authenticated

drop policy if exists union_activity_scopes_auth_select on union_activity_scopes;
create policy union_activity_scopes_auth_select on union_activity_scopes for select to authenticated using (true);

drop policy if exists activity_workers_auth_select on activity_workers;
create policy activity_workers_auth_select on activity_workers for select to authenticated using (true);

drop policy if exists activity_rating_definitions_auth_select on activity_rating_definitions;
create policy activity_rating_definitions_auth_select on activity_rating_definitions for select to authenticated using (true);

drop policy if exists activity_objectives_auth_select on activity_objectives;
create policy activity_objectives_auth_select on activity_objectives for select to authenticated using (true);

drop policy if exists activity_objective_targets_auth_select on activity_objective_targets;
create policy activity_objective_targets_auth_select on activity_objective_targets for select to authenticated using (true);

-- Insert/update/delete for authenticated

drop policy if exists union_activity_scopes_auth_write on union_activity_scopes;
create policy union_activity_scopes_auth_write on union_activity_scopes for insert to authenticated with check (true);
create policy union_activity_scopes_auth_update on union_activity_scopes for update to authenticated using (true) with check (true);
create policy union_activity_scopes_auth_delete on union_activity_scopes for delete to authenticated using (true);

drop policy if exists activity_workers_auth_write on activity_workers;
create policy activity_workers_auth_write on activity_workers for insert to authenticated with check (true);
create policy activity_workers_auth_update on activity_workers for update to authenticated using (true) with check (true);
create policy activity_workers_auth_delete on activity_workers for delete to authenticated using (true);

drop policy if exists activity_rating_definitions_auth_write on activity_rating_definitions;
create policy activity_rating_definitions_auth_write on activity_rating_definitions for insert to authenticated with check (true);
create policy activity_rating_definitions_auth_update on activity_rating_definitions for update to authenticated using (true) with check (true);
create policy activity_rating_definitions_auth_delete on activity_rating_definitions for delete to authenticated using (true);

drop policy if exists activity_objectives_auth_write on activity_objectives;
create policy activity_objectives_auth_write on activity_objectives for insert to authenticated with check (true);
create policy activity_objectives_auth_update on activity_objectives for update to authenticated using (true) with check (true);
create policy activity_objectives_auth_delete on activity_objectives for delete to authenticated using (true);

drop policy if exists activity_objective_targets_auth_write on activity_objective_targets;
create policy activity_objective_targets_auth_write on activity_objective_targets for insert to authenticated with check (true);
create policy activity_objective_targets_auth_update on activity_objective_targets for update to authenticated using (true) with check (true);
create policy activity_objective_targets_auth_delete on activity_objective_targets for delete to authenticated using (true);