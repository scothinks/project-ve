drop policy if exists "Users can update their page completions" on public.lesson_page_completions;
create policy "Users can update their page completions"
  on public.lesson_page_completions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
