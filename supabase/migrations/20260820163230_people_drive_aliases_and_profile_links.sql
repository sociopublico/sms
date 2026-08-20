-- Personas nuevas (Drive / staffing), aliases carpeta Drive → people, links profiles.

CREATE TABLE public.drive_person_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_name text NOT NULL,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drive_person_aliases_folder_name_unique UNIQUE (folder_name)
);

CREATE INDEX idx_drive_person_aliases_person_id ON public.drive_person_aliases(person_id);

ALTER TABLE public.drive_person_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_drive_person_aliases" ON public.drive_person_aliases
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "admins_insert_drive_person_aliases" ON public.drive_person_aliases
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "admins_update_drive_person_aliases" ON public.drive_person_aliases
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());
CREATE POLICY "admins_delete_drive_person_aliases" ON public.drive_person_aliases
  FOR DELETE TO authenticated
  USING (private.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_person_aliases TO authenticated, service_role;

-- Personas que faltaban en el catálogo (staffing sin login obligatorio).
INSERT INTO public.people (id, display_name) VALUES
  ('4dd9c4c0-a829-5194-b202-6b358ca306e7', 'Kike'),
  ('6554fb6b-4f2c-5cf2-b933-c67126ed3f68', 'Pala'),
  ('ef718e3f-e1b6-5657-a8c0-8f14f83007eb', 'Franco'),
  ('61d298a5-1d44-5c53-9777-67fd65d3e986', 'Flor'),
  ('21994680-48ca-554c-9cd3-2374e162ddfe', 'Belén'),
  ('7e3bb107-2e16-51e0-b183-71a4fbdb32b1', 'Victoria'),
  ('bc05bd6e-8a51-5c4e-8a5d-a4cf2b44a9f4', 'Luciana'),
  ('3df6d4a9-d660-5801-8810-b8d1c8f36afd', 'Miguel'),
  ('54a6754c-6dad-57ee-a25f-0563a37915e6', 'Erika'),
  ('ac217f57-ef6f-5d23-b5a3-c1b76c058d32', 'Ezequiel'),
  ('b120e607-561d-5ed1-b414-8f5decf63b74', 'Eugenia'),
  ('14e047fd-2625-5fee-8fea-1df6073915a7', 'Lara'),
  ('292920cf-c842-56c9-997f-939223a5f2b7', 'Dan')
ON CONFLICT (id) DO NOTHING;

-- Alias exactos de carpetas Drive → persona del catálogo.
INSERT INTO public.drive_person_aliases (folder_name, person_id) VALUES
  -- Confirmados manualmente
  ('Arrieta, Dolores', '2ec506a2-8fb0-56a1-84d0-a7cf1691e987'),       -- Loli
  ('Cecillon, Mariana', 'f34c394c-edc0-50a8-8ab0-3ac8ecfaa8a9'),      -- Maru
  ('Martínez, Emiliano', 'f733e7e1-cccd-54f0-b864-f512b1322071'),     -- Emi
  ('Martinez, Emiliano', 'f733e7e1-cccd-54f0-b864-f512b1322071'),     -- Emi (sin tilde)
  ('Geninatti, German', '4a442037-3e9b-5d40-8af6-83825a6e769a'),      -- Sher
  ('Paladino, Pablo', '6554fb6b-4f2c-5cf2-b933-c67126ed3f68'),        -- Pala
  -- Ya matcheaban por apodo; alias fijo para sync
  ('Constance, Paul', 'a7936332-af42-5ff8-9757-fecdced0228a'),        -- Paul
  ('Fiszlejder, Michelle', 'b182f98e-bacd-538b-89a9-37df648cdab6'),   -- Mich
  ('García, Julieta', 'a3a830fe-a794-5567-907e-ec26c4db46a9'),         -- Juli
  ('Lazarte Otano, Rocío', 'b59e225c-eb60-5a4b-825c-d12866adaa2d'),   -- Ro
  ('Moran, Marcelo', 'b038712c-00d0-5043-addc-7be9bfe0b946'),         -- Marce
  ('Nahas, Agustina', 'aa382bbb-fded-5f7a-af55-b9bea04916d9'),        -- Agus
  ('Romero Barberá, Josefina', '01c4505a-c29e-513e-b2df-2f28e011cf2d'), -- Jose
  ('Sava, Ayar', 'de80449e-ad93-5d4d-be1a-6955dc4325aa'),             -- Ayar
  ('Spinosa, Mercedes', '9bfdb291-f0b1-5fa1-b1c9-646d16511974'),      -- Mer
  ('Wirtz, Joscha', '48d00709-bcf9-528f-bda9-1b841e1f103d'),          -- Joscha
  ('Sojo, Gloriana', '8160e8cc-8c24-5f0b-90a8-1846033f43f7'),         -- Glori
  ('Zappe, Macarena', '54bb65b5-e96b-5313-b607-62d6b69f03d5'),        -- Maca
  -- Solo PDF por ahora: persona en catálogo, sin import de horas
  ('Arias, Franco', 'ef718e3f-e1b6-5657-a8c0-8f14f83007eb'),
  ('Di Bartolo, Florencia', '61d298a5-1d44-5c53-9777-67fd65d3e986'),
  ('Félix, Belén', '21994680-48ca-554c-9cd3-2374e162ddfe'),
  ('Frers, Victoria', '7e3bb107-2e16-51e0-b183-71a4fbdb32b1'),
  ('Godoy, Luciana', 'bc05bd6e-8a51-5c4e-8a5d-a4cf2b44a9f4'),
  ('Lengyel, Miguel', '3df6d4a9-d660-5801-8810-b8d1c8f36afd'),
  ('Perez León, Erika', '54a6754c-6dad-57ee-a25f-0563a37915e6'),
  ('Salatino, Ezequiel', 'ac217f57-ef6f-5d23-b5a3-c1b76c058d32'),
  ('Simhan, Eugenia', 'b120e607-561d-5ed1-b414-8f5decf63b74'),
  ('Yeyati, Lara', '14e047fd-2625-5fee-8fea-1df6073915a7'),
  ('Zajdband, Dan', '292920cf-c842-56c9-997f-939223a5f2b7')
ON CONFLICT (folder_name) DO UPDATE SET person_id = EXCLUDED.person_id;

-- Vínculo persona ↔ cuenta (cuando el perfil ya existe).
UPDATE public.profiles p
SET person_id = m.person_id
FROM (VALUES
  ('alejandra@sociopublico.com', '469161d5-0d88-502f-bce8-9afd2f3a710e'::uuid), -- Ale
  ('mercedes@sociopublico.com', '9bfdb291-f0b1-5fa1-b1c9-646d16511974'::uuid),  -- Mer
  ('josefina@sociopublico.com', '01c4505a-c29e-513e-b2df-2f28e011cf2d'::uuid),  -- Jose
  ('agustina@sociopublico.com', 'aa382bbb-fded-5f7a-af55-b9bea04916d9'::uuid),  -- Agus
  ('ignacio@sociopublico.com', '0614e7d3-5515-5229-bd41-afc54b848f47'::uuid),   -- Nacho
  ('sonia@sociopublico.com', 'f8dfc2ed-65dc-5b93-af40-5912fb561e5a'::uuid),     -- Sonia
  ('julieta@sociopublico.com', 'a3a830fe-a794-5567-907e-ec26c4db46a9'::uuid),   -- Juli
  ('enrique@sociopublico.com', '4dd9c4c0-a829-5194-b202-6b358ca306e7'::uuid)    -- Kike
) AS m(email, person_id)
WHERE lower(p.email) = m.email
  AND (p.person_id IS DISTINCT FROM m.person_id);

-- Invites (sin crear auth user): pueden loguear cuando acepten / entren.
INSERT INTO public.app_emails (email, app_role) VALUES
  ('josefina@sociopublico.com', 'member'),
  ('ignacio@sociopublico.com', 'member'),
  ('enrique@sociopublico.com', 'member'),
  ('mercedes@sociopublico.com', 'member'),
  ('sonia@sociopublico.com', 'member'),
  ('julieta@sociopublico.com', 'member')
ON CONFLICT (email) DO NOTHING;
