delete from public.mission_proofs
where lower(trim(value)) like 'demo proof:%'
   or lower(trim(value)) like 'demo-proof-%';
