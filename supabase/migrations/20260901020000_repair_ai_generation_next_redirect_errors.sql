-- Older synchronous AI-generation Server Actions caught Next.js redirect
-- signals after their database work completed and stored the framework digest
-- as the job error. The redirect was moved outside those catch blocks before
-- the durable worker was introduced. Keep the historical job outcome intact,
-- but replace the internal implementation detail with an auditable label.

update public.ai_generation_jobs
set error = 'Historical redirect diagnostic removed; job outcome was not changed.'
where error is not null
  and strpos(upper(error), 'NEXT_REDIRECT') > 0;
