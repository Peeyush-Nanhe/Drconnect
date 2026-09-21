-- ============================================================================
-- MyDox — emergency catalog moves out of the app bundle and into the database.
--
-- Until now the emergency categories, their routing copy and every triage
-- question lived in src/features/mydox/emergency/catalog.ts. That meant a
-- clinical change (a new red-flag answer, a reworded question) needed a code
-- change and an app release. Both tables below are read by the patient wizard
-- and by the hospital / doctor / ambulance screens at runtime.
--
-- Additive and idempotent. Seed values reproduce the previous bundled catalog
-- exactly, so the screens render the same content after this migration.
-- ============================================================================

-- ------------------------------------------------------------ categories ----
CREATE TABLE IF NOT EXISTS public.emergency_category_catalog (
  category    public.emergency_category PRIMARY KEY,
  label       text    NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 80),
  emoji       text    NOT NULL CHECK (length(emoji) BETWEEN 1 AND 8),
  -- Shown under the chosen category so the patient knows where they are going.
  routing     text    NOT NULL CHECK (length(btrim(routing)) BETWEEN 1 AND 160),
  -- The team named on the responder screens.
  team        text    NOT NULL CHECK (length(btrim(team)) BETWEEN 1 AND 80),
  sort_order  integer NOT NULL DEFAULT 100,
  active      boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------- triage questions ----
-- One row per question. options[] is what the patient can tap; red_flags[] is
-- the subset of those answers that pushes the case up a responder queue, so
-- triage urgency is tuned in data rather than in a release.
CREATE TABLE IF NOT EXISTS public.emergency_triage_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    public.emergency_category NOT NULL
                REFERENCES public.emergency_category_catalog(category) ON DELETE CASCADE,
  prompt      text    NOT NULL CHECK (length(btrim(prompt)) BETWEEN 1 AND 200),
  options     text[]  NOT NULL CHECK (cardinality(options) BETWEEN 2 AND 6),
  red_flags   text[]  NOT NULL DEFAULT '{}',
  sort_order  integer NOT NULL DEFAULT 100,
  active      boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- A red flag that is not one of the offered answers can never fire.
  CONSTRAINT emergency_triage_red_flags_are_options CHECK (red_flags <@ options),
  UNIQUE (category, prompt)
);

-- The case row caps triage at four answers, so the catalog must not offer more.
CREATE UNIQUE INDEX IF NOT EXISTS emergency_triage_question_order
  ON public.emergency_triage_questions (category, sort_order) WHERE active;

-- ------------------------------------------------------------------ seed ----
INSERT INTO public.emergency_category_catalog (category, label, emoji, routing, team, sort_order) VALUES
  ('cardiac',   'Cardiac / Chest pain',     '❤️', 'Will route to a cath-lab–ready hospital',            'Cardiac team',       10),
  ('stroke',    'Brain / Stroke',           '🧠', 'Will route to a stroke-ready hospital',              'Neuro team',         20),
  ('trauma',    'Ortho / Trauma',           '🩸', 'Will route to a trauma centre with blood bank',      'Trauma team',        30),
  ('breathing', 'Chest / Breathing',        '🫁', 'Will route to a hospital with ICU beds',             'Pulmonary team',     40),
  ('pregnancy', 'Pregnancy / Obstetrics',   '🤰', 'Will route to an OB-ready hospital with neonatal cover', 'OB & neonatal team', 50),
  ('other',     'Something else',           '🚑', 'Will route to the nearest equipped emergency room',  'ER team',            60)
ON CONFLICT (category) DO NOTHING;

INSERT INTO public.emergency_triage_questions (category, prompt, options, red_flags, sort_order) VALUES
  ('cardiac',   'When did the pain start?',        ARRAY['<30 min','30–60 min','>1 hour'],            ARRAY['<30 min'], 10),
  ('cardiac',   'Sweating or breathless?',         ARRAY['Yes','No'],                                 ARRAY['Yes'],     20),
  ('stroke',    'Face drooping on one side?',      ARRAY['Yes','No'],                                 ARRAY['Yes'],     10),
  ('stroke',    'Arm weakness or numbness?',       ARRAY['Yes','No'],                                 ARRAY['Yes'],     20),
  ('stroke',    'Speech slurred?',                 ARRAY['Yes','No'],                                 ARRAY['Yes'],     30),
  ('stroke',    'When did it start?',              ARRAY['<1 hr','1–3 hr','>3 hr'],                   ARRAY['<1 hr'],   40),
  ('trauma',    'Heavy bleeding?',                 ARRAY['Yes','No'],                                 ARRAY['Yes'],     10),
  ('trauma',    'Is the person conscious?',        ARRAY['Yes','No'],                                 ARRAY['No'],      20),
  ('breathing', 'Can they speak full sentences?',  ARRAY['Yes','No'],                                 ARRAY['No'],      10),
  ('breathing', 'Lips or face turning bluish?',    ARRAY['Yes','No'],                                 ARRAY['Yes'],     20),
  ('pregnancy', 'How many weeks pregnant?',        ARRAY['<28 wk','28–36 wk','37+ wk'],               ARRAY['<28 wk'],  10),
  ('pregnancy', 'Main problem?',                   ARRAY['Bleeding','Contractions','Less movement'],  ARRAY['Bleeding'],20),
  ('other',     'Is the person conscious?',        ARRAY['Yes','No'],                                 ARRAY['No'],      10),
  ('other',     'Is there heavy bleeding?',        ARRAY['Yes','No'],                                 ARRAY['Yes'],     20)
ON CONFLICT (category, prompt) DO NOTHING;

-- ------------------------------------------------------------------ RLS ----
-- The catalog is not patient data: anyone opening the emergency screen, signed
-- in or not, must be able to read it. Only an admin can change it.
ALTER TABLE public.emergency_category_catalog  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_triage_questions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emergency catalog readable"   ON public.emergency_category_catalog;
DROP POLICY IF EXISTS "emergency catalog admin write" ON public.emergency_category_catalog;
CREATE POLICY "emergency catalog readable" ON public.emergency_category_catalog
  FOR SELECT USING (true);
CREATE POLICY "emergency catalog admin write" ON public.emergency_category_catalog
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "emergency triage readable"    ON public.emergency_triage_questions;
DROP POLICY IF EXISTS "emergency triage admin write" ON public.emergency_triage_questions;
CREATE POLICY "emergency triage readable" ON public.emergency_triage_questions
  FOR SELECT USING (true);
CREATE POLICY "emergency triage admin write" ON public.emergency_triage_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

GRANT SELECT ON public.emergency_category_catalog TO anon, authenticated;
GRANT SELECT ON public.emergency_triage_questions TO anon, authenticated;

-- ------------------------------------------------------- red-flag helper ----
-- The same rule the app applies, kept next to the data so a responder queue can
-- sort on it in SQL instead of trusting a client-sent flag.
CREATE OR REPLACE FUNCTION public.emergency_case_has_red_flag(
  _category public.emergency_category, _triage jsonb
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.emergency_triage_questions q
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(_triage,'[]'::jsonb)) AS a
     WHERE q.category = _category
       AND q.active
       AND a->>'q' = q.prompt
       AND (a->>'a') = ANY (q.red_flags)
  );
$$;

GRANT EXECUTE ON FUNCTION public.emergency_case_has_red_flag(public.emergency_category, jsonb)
  TO anon, authenticated;
