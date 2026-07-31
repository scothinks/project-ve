import type { LessonProgressRecord } from "../../../lib/progress";
import type { ProgressRepository } from "./contracts";

export type DemoProgressLoader = (userId: string) => LessonProgressRecord[] | Promise<LessonProgressRecord[]>;
export type SupabaseProgressLoader<TSupabase> = (
  supabase: TSupabase,
  userId: string,
) => Promise<LessonProgressRecord[]>;

export class DemoProgressRepository implements ProgressRepository {
  private readonly loadProgress: DemoProgressLoader;

  constructor(loadProgress: DemoProgressLoader) {
    this.loadProgress = loadProgress;
  }

  async getLessonProgress(userId: string) {
    return this.loadProgress(userId);
  }
}

export class SupabaseProgressRepository<TSupabase> implements ProgressRepository {
  private readonly supabase: TSupabase;
  private readonly loadProgress: SupabaseProgressLoader<TSupabase>;

  constructor(
    supabase: TSupabase,
    loadProgress: SupabaseProgressLoader<TSupabase>,
  ) {
    this.supabase = supabase;
    this.loadProgress = loadProgress;
  }

  getLessonProgress(userId: string) {
    return this.loadProgress(this.supabase, userId);
  }
}
