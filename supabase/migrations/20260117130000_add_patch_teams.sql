-- Add patch team grouping tables and admin-only access policies

CREATE TABLE IF NOT EXISTS public.patch_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS patch_teams_name_unique ON public.patch_teams (name);

CREATE TABLE IF NOT EXISTS public.patch_team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.patch_teams(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS patch_team_memberships_active_unique
  ON public.patch_team_memberships (patch_id)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS public.patch_team_coordinators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.patch_teams(id) ON DELETE CASCADE,
  coordinator_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  coordinator_pending_user_id uuid REFERENCES public.pending_users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patch_team_coordinators_one_ref CHECK (
    (coordinator_profile_id IS NULL) <> (coordinator_pending_user_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS patch_team_coordinators_active_unique
  ON public.patch_team_coordinators (team_id)
  WHERE is_active;

-- updated_at triggers
DROP TRIGGER IF EXISTS update_patch_teams_updated_at ON public.patch_teams;
CREATE TRIGGER update_patch_teams_updated_at
BEFORE UPDATE ON public.patch_teams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_patch_team_memberships_updated_at ON public.patch_team_memberships;
CREATE TRIGGER update_patch_team_memberships_updated_at
BEFORE UPDATE ON public.patch_team_memberships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_patch_team_coordinators_updated_at ON public.patch_team_coordinators;
CREATE TRIGGER update_patch_team_coordinators_updated_at
BEFORE UPDATE ON public.patch_team_coordinators
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.patch_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patch_team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patch_team_coordinators ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
DROP POLICY IF EXISTS "p_patch_teams_admin_all" ON public.patch_teams;
CREATE POLICY "p_patch_teams_admin_all" ON public.patch_teams
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "p_patch_team_memberships_admin_all" ON public.patch_team_memberships;
CREATE POLICY "p_patch_team_memberships_admin_all" ON public.patch_team_memberships
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "p_patch_team_coordinators_admin_all" ON public.patch_team_coordinators;
CREATE POLICY "p_patch_team_coordinators_admin_all" ON public.patch_team_coordinators
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Seed default teams if missing
INSERT INTO public.patch_teams (name, sort_order)
VALUES
  ('Sydney Central', 1),
  ('Sydney North', 2),
  ('Sydney West', 3),
  ('Northern NSW', 4),
  ('Southern NSW', 5),
  ('Counter Organiser', 6)
ON CONFLICT (name) DO NOTHING;
