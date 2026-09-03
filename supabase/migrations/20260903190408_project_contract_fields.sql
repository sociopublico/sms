-- Datos de contrato en projects (todos opcionales).

CREATE TYPE public.project_billing_point AS ENUM ('spuy', 'spar');

ALTER TABLE public.projects
  ADD COLUMN partner text,
  ADD COLUMN contract_signed_on date,
  ADD COLUMN proposal_url text,
  ADD COLUMN drive_folder_url text,
  ADD COLUMN planned_duration text,
  ADD COLUMN kickoff_on date,
  ADD COLUMN end_on date,
  ADD COLUMN payment_schedule text,
  ADD COLUMN billing_point public.project_billing_point;
