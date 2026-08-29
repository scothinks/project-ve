import type { UserMissionSummary } from "../../../lib/missions";
import type { MissionRepository } from "./contracts";

type MissionSummaryParams = {
  userId: string;
  referralCode: string | null;
  origin: string;
};

export type DemoMissionSummaryLoader = (params: MissionSummaryParams) => UserMissionSummary[] | Promise<UserMissionSummary[]>;
export type SupabaseMissionSummaryLoader<TSupabase> = (
  supabase: TSupabase,
  params: MissionSummaryParams,
) => Promise<UserMissionSummary[]>;

export class DemoMissionRepository implements MissionRepository {
  private readonly loadSummaries: DemoMissionSummaryLoader;

  constructor(loadSummaries: DemoMissionSummaryLoader) {
    this.loadSummaries = loadSummaries;
  }

  async getSummaries(params: MissionSummaryParams) {
    return this.loadSummaries(params);
  }
}

export class SupabaseMissionRepository<TSupabase> implements MissionRepository {
  private readonly supabase: TSupabase;
  private readonly loadSummaries: SupabaseMissionSummaryLoader<TSupabase>;

  constructor(
    supabase: TSupabase,
    loadSummaries: SupabaseMissionSummaryLoader<TSupabase>,
  ) {
    this.supabase = supabase;
    this.loadSummaries = loadSummaries;
  }

  getSummaries(params: MissionSummaryParams) {
    return this.loadSummaries(this.supabase, params);
  }
}
