REVOKE ALL ON TABLE public.audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.audit_events TO authenticated, service_role;
GRANT ALL ON TABLE public.audit_events TO postgres, service_role;
