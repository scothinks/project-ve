import type { RewardStoreSnapshot } from "../../../lib/rewards";
import type { RewardRepository } from "./contracts";

export type DemoRewardSnapshotLoader = (
  userId: string,
  xpBalance: number,
) => RewardStoreSnapshot | Promise<RewardStoreSnapshot>;
export type SupabaseRewardSnapshotLoader<TSupabase> = (
  supabase: TSupabase,
  userId: string,
  xpBalance: number,
) => Promise<RewardStoreSnapshot | null>;

export class DemoRewardRepository implements RewardRepository {
  private readonly loadSnapshot: DemoRewardSnapshotLoader;

  constructor(loadSnapshot: DemoRewardSnapshotLoader) {
    this.loadSnapshot = loadSnapshot;
  }

  async getStoreSnapshot(userId: string, xpBalance: number) {
    return this.loadSnapshot(userId, xpBalance);
  }
}

export class SupabaseRewardRepository<TSupabase> implements RewardRepository {
  private readonly supabase: TSupabase;
  private readonly loadSnapshot: SupabaseRewardSnapshotLoader<TSupabase>;

  constructor(
    supabase: TSupabase,
    loadSnapshot: SupabaseRewardSnapshotLoader<TSupabase>,
  ) {
    this.supabase = supabase;
    this.loadSnapshot = loadSnapshot;
  }

  getStoreSnapshot(userId: string, xpBalance: number) {
    return this.loadSnapshot(this.supabase, userId, xpBalance);
  }
}
