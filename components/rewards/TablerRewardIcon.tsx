"use client";

import { useEffect, useState } from "react";
import { createElement } from "react";
import type { CSSProperties, ComponentType } from "react";
import {
  IconBook2,
  IconBolt,
  IconCamera,
  IconCertificate,
  IconCoffee,
  IconCoins,
  IconDeviceMobile,
  IconFlag,
  IconFlame,
  IconGift,
  IconHeadphones,
  IconMapPin,
  IconMedal,
  IconPencil,
  IconSchool,
  IconShoppingBag,
  IconShirt,
  IconSparkles,
  IconStars,
  IconTargetArrow,
  IconTicket,
  IconTrophy,
  IconToolsKitchen2,
  IconWifi,
} from "@tabler/icons-react";
import type { SVGProps } from "react";

type RewardIconComponent = ComponentType<{
  className?: string;
  size?: number | string;
  stroke?: number;
  style?: CSSProperties;
}>;

type SvgNode = [string, Record<string, string | number | boolean>];
type IconNodeMap = Record<string, SvgNode[]>;

const staticRewardIcons: Record<string, RewardIconComponent> = {
  gift: IconGift,
  ticket: IconTicket,
  coins: IconCoins,
  bolt: IconBolt,
  sparkles: IconSparkles,
  "shopping-bag": IconShoppingBag,
  trophy: IconTrophy,
  book: IconBook2,
  target: IconTargetArrow,
  "device-mobile": IconDeviceMobile,
  utensils: IconToolsKitchen2,
  stars: IconStars,
  medal: IconMedal,
  flame: IconFlame,
  school: IconSchool,
  pencil: IconPencil,
  certificate: IconCertificate,
  flag: IconFlag,
  camera: IconCamera,
  "map-pin": IconMapPin,
  coffee: IconCoffee,
  shirt: IconShirt,
  headphones: IconHeadphones,
  wifi: IconWifi,
};

const iconCache = new Map<string, RewardIconComponent | null>();
let outlineNodePromise: Promise<IconNodeMap> | null = null;

function loadOutlineNodes() {
  if (!outlineNodePromise) {
    outlineNodePromise = import("@/data/tabler-nodes-outline.json").then(
      (mod) => mod.default as unknown as IconNodeMap,
    );
  }

  return outlineNodePromise;
}

function createNodeBackedIcon(nodes: SvgNode[]): RewardIconComponent {
  return function NodeBackedIcon(props) {
    const { className, stroke = 1.9, ...rest } = props ?? {};

    return (
      <svg
        className={className}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={stroke}
        viewBox="0 0 24 24"
        {...(rest as SVGProps<SVGSVGElement>)}
      >
        {nodes.map(([tag, attrs], index) =>
          createElement(tag, {
            key: `${tag}-${index}`,
            ...attrs,
          }),
        )}
      </svg>
    );
  };
}

export function TablerRewardIcon({
  name,
  className,
  stroke = 1.9,
  style,
}: {
  name: string;
  className?: string;
  stroke?: number;
  style?: CSSProperties;
}) {
  const StaticIcon = staticRewardIcons[name];
  const [DynamicIcon, setDynamicIcon] = useState<RewardIconComponent | null>(() => iconCache.get(name) ?? null);

  useEffect(() => {
    if (StaticIcon) {
      return;
    }

    const cached = iconCache.get(name);

    if (cached !== undefined) {
      setDynamicIcon(() => cached);
      return;
    }

    let cancelled = false;

    loadOutlineNodes()
      .then((map) => {
        const nodes = map[name];
        const loaded = Array.isArray(nodes) ? createNodeBackedIcon(nodes) : null;
        iconCache.set(name, loaded);

        if (!cancelled) {
          setDynamicIcon(() => loaded);
        }
      })
      .catch(() => {
        iconCache.set(name, null);

        if (!cancelled) {
          setDynamicIcon(() => null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [name, StaticIcon]);

  const Icon = StaticIcon ?? DynamicIcon;

  if (!Icon) {
    return null;
  }

  return <Icon className={className} stroke={stroke} style={style} />;
}
