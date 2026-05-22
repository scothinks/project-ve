import { Card } from "@/components/ui/Card";
import { XPBadge } from "@/components/ui/XPBadge";

type RewardCardProps = {
  title: string;
  xp: number;
  expires: string;
};

export function RewardCard({ title, xp, expires }: RewardCardProps) {
  return (
    <Card className="min-h-[180px] p-4">
      <div className="grid h-16 place-items-center rounded-[18px] bg-[#f3f7f0] text-3xl">
        *
      </div>
      <h3 className="mt-4 min-h-9 text-sm font-bold leading-[18px]">{title}</h3>
      <div className="mt-3">
        <XPBadge xp={xp} />
      </div>
      <p className="mt-3 text-[11px] font-semibold leading-4 text-[var(--ve-muted)]">{expires}</p>
    </Card>
  );
}
