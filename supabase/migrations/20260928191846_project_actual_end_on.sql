-- Fecha de cierre real del proyecto (distinta de end_on = fin de contrato).

ALTER TABLE public.projects
  ADD COLUMN actual_end_on date;

COMMENT ON COLUMN public.projects.end_on IS
  'Fecha de finalización de contrato (prevista).';

COMMENT ON COLUMN public.projects.actual_end_on IS
  'Fecha de finalización real del proyecto (puede diferir del contrato).';
