-- Nombre legible del proyecto (distinto del code / ID de contrato).

ALTER TABLE public.projects
  ADD COLUMN name text;

COMMENT ON COLUMN public.projects.name IS
  'Nombre del proyecto (display). El code sigue siendo el ID de contrato.';
