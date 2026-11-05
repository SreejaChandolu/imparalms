REVOKE EXECUTE ON FUNCTION public.set_recording_visibility(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_recording_visibility(uuid, boolean) TO authenticated;
