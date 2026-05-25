create or replace function public.sync_quiz_status_from_lesson()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.quizzes
  set status = new.status,
      updated_at = now()
  where lesson_id = new.id
    and status is distinct from new.status;

  return new;
end;
$$;

drop trigger if exists sync_quiz_status_from_lesson on public.lessons;

create trigger sync_quiz_status_from_lesson
after update of status on public.lessons
for each row
execute function public.sync_quiz_status_from_lesson();

update public.quizzes as q
set status = l.status,
    updated_at = now()
from public.lessons as l
where l.id = q.lesson_id
  and q.status is distinct from l.status;
