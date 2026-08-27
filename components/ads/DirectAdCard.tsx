import Link from "next/link";
import Image from "next/image";
import { AdEventTracker } from "@/components/ads/AdEventTracker";
import { HouseAdEventTracker } from "@/components/ads/HouseAdEventTracker";
import type { DirectAdCardModel } from "@/lib/ads";
import { cn } from "@/lib/utils";

type DirectAdCardProps = {
  ad: DirectAdCardModel | null;
  className?: string;
};

function AdShell({
  ad,
  className,
}: {
  ad: DirectAdCardModel;
  className?: string;
}) {
  const hasCta = Boolean(ad.ctaLabel && ad.clickUrl);
  const card = (
    <article
      aria-label={`${ad.disclosureLabel}: ${ad.sponsorLabel}`}
      className={cn(
        "overflow-hidden rounded-[22px] border border-[color:color-mix(in_srgb,var(--ve-green)_16%,var(--ve-line-soft))] bg-[var(--ve-card)] shadow-sm",
        !ad.imageUrl && "ad-shell--no-image",
        className,
      )}
    >
      {ad.imageUrl ? (
        <div className="relative h-32 w-full">
          <Image
            alt={ad.imageAlt || `${ad.sponsorLabel} sponsor creative`}
            className="object-cover"
            fill
            sizes="(max-width: 768px) 100vw, 420px"
            src={ad.imageUrl}
          />
        </div>
      ) : null}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
              {ad.disclosureLabel}
            </p>
            <p className="mt-1 text-xs font-bold text-[var(--ve-muted)]">
              {ad.sponsorLabel}
            </p>
          </div>
          {ad.logoUrl ? (
            <div className="relative size-10 overflow-hidden rounded-[12px]">
              <Image
                alt={`${ad.sponsorLabel} logo`}
                className="object-contain"
                fill
                sizes="40px"
                src={ad.logoUrl}
              />
            </div>
          ) : null}
        </div>

        {ad.eyebrow ? (
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
            {ad.eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-lg font-black leading-6 tracking-[-0.02em] text-[var(--foreground)]">
          {ad.headline}
        </h2>
        {ad.body ? (
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
            {ad.body}
          </p>
        ) : null}
        {ad.legalText ? (
          <p className="mt-3 text-[11px] font-semibold leading-5 text-[var(--ve-muted)]">
            {ad.legalText}
          </p>
        ) : null}
        {hasCta ? (
          <div className="mt-4">
            {ad.clickUrl?.startsWith("/") ? (
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--ve-green)] px-5 text-sm font-black !text-white"
                href={ad.clickUrl}
              >
                {ad.ctaLabel}
              </Link>
            ) : (
              <a
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--ve-green)] px-5 text-sm font-black !text-white"
                href={ad.clickUrl ?? "#"}
              >
                {ad.ctaLabel}
              </a>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );

  if (ad.isPaid) {
    return (
      <AdEventTracker decisionId={ad.decisionId} format={ad.format} placementKey={ad.placementKey}>
        {card}
      </AdEventTracker>
    );
  }

  if (ad.isHouseFallback) {
    return (
      <HouseAdEventTracker fallbackKey={ad.decisionId} placementKey={ad.placementKey}>
        {card}
      </HouseAdEventTracker>
    );
  }

  return card;
}

export function DirectAdCard({ ad, className }: DirectAdCardProps) {
  if (!ad) return null;

  return <AdShell ad={ad} className={className} />;
}
