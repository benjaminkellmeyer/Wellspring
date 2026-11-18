-- =====================================================================
-- 03_auth.sql — sign-in accounts, roles, and Row Level Security
-- Run AFTER 01_setup.sql and 02_seed.sql, and AFTER creating the two
-- test accounts in Supabase (Authentication → Users → Add user).
-- Safe to run more than once.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Link each client record to a Supabase Auth account (one per account)
-- ---------------------------------------------------------------------
ALTER TABLE public.client
    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS client_user_id_unique ON public.client (user_id);


-- ---------------------------------------------------------------------
-- 2. Roles. A user with the 'staff' role can see and update all events.
--    Everyone else is treated as a client.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
    id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id    uuid     NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role_id    smallint NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
    granted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

INSERT INTO public.roles (name) VALUES ('staff'), ('client')
ON CONFLICT (name) DO NOTHING;

-- Used by the RLS policies below. SECURITY DEFINER lets it read user_roles
-- without triggering the user_roles policies (which would loop).
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() AND r.name = 'staff'
    );
$$;


-- ---------------------------------------------------------------------
-- 3. Row Level Security
-- The Express server uses the secret key and checks permissions itself.
-- These policies are a second layer: they stop anyone who uses the public
-- (publishable) key directly against Supabase from reading private rows.
-- ---------------------------------------------------------------------
ALTER TABLE public.client      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordinator ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles  ENABLE ROW LEVEL SECURITY;

-- This old policy let ANY signed-in user read every client's email and phone. Removed.
DROP POLICY IF EXISTS "Authenticated users can read clients" ON public.client;

DROP POLICY IF EXISTS "roles: read" ON public.roles;
CREATE POLICY "roles: read" ON public.roles FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "roles: staff" ON public.roles;
CREATE POLICY "roles: staff" ON public.roles FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "user_roles: read own" ON public.user_roles;
CREATE POLICY "user_roles: read own" ON public.user_roles FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "user_roles: staff" ON public.user_roles;
CREATE POLICY "user_roles: staff" ON public.user_roles FOR ALL TO authenticated
    USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "client: own read" ON public.client;
CREATE POLICY "client: own read" ON public.client FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "client: own insert" ON public.client;
CREATE POLICY "client: own insert" ON public.client FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "client: own update" ON public.client;
CREATE POLICY "client: own update" ON public.client FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "client: staff" ON public.client;
CREATE POLICY "client: staff" ON public.client FOR ALL TO authenticated
    USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "coordinator: staff" ON public.coordinator;
CREATE POLICY "coordinator: staff" ON public.coordinator FOR ALL TO authenticated
    USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "room: read" ON public.room;
CREATE POLICY "room: read" ON public.room FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "room: staff" ON public.room;
CREATE POLICY "room: staff" ON public.room FOR ALL TO authenticated
    USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "inquiry: own read" ON public.inquiry;
CREATE POLICY "inquiry: own read" ON public.inquiry FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.client c WHERE c.c_id = inquiry.c_id AND c.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "inquiry: own insert" ON public.inquiry;
CREATE POLICY "inquiry: own insert" ON public.inquiry FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.client c WHERE c.c_id = inquiry.c_id AND c.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "inquiry: staff" ON public.inquiry;
CREATE POLICY "inquiry: staff" ON public.inquiry FOR ALL TO authenticated
    USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "event: own read" ON public.event;
CREATE POLICY "event: own read" ON public.event FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.client c WHERE c.c_id = event.c_id AND c.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "event: staff" ON public.event;
CREATE POLICY "event: staff" ON public.event FOR ALL TO authenticated
    USING (public.is_staff()) WITH CHECK (public.is_staff());


-- ---------------------------------------------------------------------
-- 4. Test accounts (fictional). Create these first in
--    Authentication → Users → Add user (tick "Auto Confirm User"):
--      staff@example.com
--      client@example.com
-- ---------------------------------------------------------------------

-- Give staff@example.com the staff role
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u, public.roles r
WHERE u.email = 'staff@example.com' AND r.name = 'staff'
ON CONFLICT DO NOTHING;

-- Give client@example.com the client role and link it to the sample client "Jamie Rivera",
-- so that account already has sample events to view.
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u, public.roles r
WHERE u.email = 'client@example.com' AND r.name = 'client'
ON CONFLICT DO NOTHING;

UPDATE public.client
SET user_id = (SELECT id FROM auth.users WHERE email = 'client@example.com')
WHERE c_name = 'Jamie Rivera'
  AND user_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.client
      WHERE user_id = (SELECT id FROM auth.users WHERE email = 'client@example.com')
  );

-- Check: should list both accounts with their role and linked client (staff has none)
SELECT u.email, r.name AS role, c.c_id, c.c_name
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.roles r ON r.id = ur.role_id
LEFT JOIN public.client c ON c.user_id = u.id
WHERE u.email IN ('staff@example.com', 'client@example.com');
