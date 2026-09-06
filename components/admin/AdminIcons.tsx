import { cn } from "@/lib/utils";

type IconProps = {
  className?: string;
};

function iconStroke(className?: string) {
  return cn("h-[18px] w-[18px] shrink-0 stroke-[2.2]", className);
}

export function AdminOverviewIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M4 5h7v6H4zM13 5h7v10h-7zM4 13h7v6H4zM13 17h7v2h-7z" stroke="currentColor" />
    </svg>
  );
}

export function AdminPeopleIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" />
      <path d="M16 5.5a3 3 0 0 1 0 6M19 19a5 5 0 0 0-3.5-5.7" stroke="currentColor" />
    </svg>
  );
}

export function AdminCoursesIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 0z" stroke="currentColor" />
      <path d="M5 4v16" stroke="currentColor" />
      <path d="M9 8h6M9 11h6" stroke="currentColor" />
    </svg>
  );
}

export function AdminProgrammesIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M5 5h14v5H5zM5 14h6v5H5zM15 14h4v5h-4z" stroke="currentColor" />
      <path d="M12 7.5h3M8 16.5h1M17 16.5h.5" stroke="currentColor" />
    </svg>
  );
}

export function AdminCohortsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M8.5 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15.5 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" />
      <path d="M4.5 18a4 4 0 0 1 8 0M11.5 18a4 4 0 0 1 8 0" stroke="currentColor" />
    </svg>
  );
}

export function AdminReportingIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M5 19V5M5 19h14" stroke="currentColor" />
      <path d="M8 15v-4M12 15V8M16 15v-6" stroke="currentColor" />
      <path d="M8 18h8" stroke="currentColor" />
    </svg>
  );
}

export function AdminMissionsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M12 4a8 8 0 1 0 8 8" stroke="currentColor" />
      <path d="m15 5 4 1-1 4" stroke="currentColor" />
      <path d="M12 12 19 6" stroke="currentColor" />
    </svg>
  );
}

export function AdminRewardsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M7 7h10v10H7z" stroke="currentColor" />
      <path d="M12 7v10M7 12h10" stroke="currentColor" />
      <path d="M8.5 7A1.5 1.5 0 1 1 10 5.5V7M15.5 7A1.5 1.5 0 1 0 14 5.5V7" stroke="currentColor" />
    </svg>
  );
}

export function AdminPointsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path
        d="m12 3 2.4 4.86 5.36.78-3.88 3.78.92 5.34L12 15.27l-4.8 2.49.92-5.34-3.88-3.78 5.36-.78z"
        stroke="currentColor"
      />
    </svg>
  );
}

export function AdminAssessmentsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M7 3h10v18H7z" stroke="currentColor" />
      <path d="M9.5 1.5h5v3h-5z" stroke="currentColor" />
      <path d="M9 11.5 10.5 13 14 9" stroke="currentColor" />
    </svg>
  );
}

export function AdminActivityIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M12 21a9 9 0 1 0-9-9" stroke="currentColor" />
      <path d="M3 3v6h6" stroke="currentColor" />
      <path d="M12 8v5l3 2" stroke="currentColor" />
    </svg>
  );
}

export function AdminSettingsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Z" stroke="currentColor" />
      <path d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12M18.36 18.36l-2.12-2.12M7.76 7.76 5.64 5.64" stroke="currentColor" />
    </svg>
  );
}

export function AdminInterventionsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M12 4 4 18h16z" stroke="currentColor" />
      <path d="M12 9v4M12 16h.01" stroke="currentColor" />
    </svg>
  );
}

export function AdminRecommendationsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="m12 4 2.2 4.45 4.8.7-3.5 3.4.83 4.8L12 15.1 7.67 17.35l.83-4.8L5 9.15l4.8-.7z" stroke="currentColor" />
    </svg>
  );
}

export function AdminFlagIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M6 3v18" stroke="currentColor" />
      <path d="M6 4h12l-2.5 3.5L18 11H6" stroke="currentColor" />
    </svg>
  );
}

export function AdminErrorIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" stroke="currentColor" />
      <path d="M12 7.5v6M12 16.5h.01" stroke="currentColor" />
    </svg>
  );
}

export function AdminRuleIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M5 4h14v16H5z" stroke="currentColor" />
      <path d="M8 8h8M8 12h5" stroke="currentColor" />
      <path d="m7.5 15.5 1.2 1.2L11 14" stroke="currentColor" />
    </svg>
  );
}

export function AdminAddBoxIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <rect height="16" rx="2" stroke="currentColor" width="16" x="4" y="4" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" />
    </svg>
  );
}

export function AdminSupportAgentIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M4 13a8 8 0 0 1 16 0" stroke="currentColor" />
      <rect height="5" rx="1.5" stroke="currentColor" width="4" x="3" y="12" />
      <rect height="5" rx="1.5" stroke="currentColor" width="4" x="17" y="12" />
      <path d="M19 17.5v.5a4 4 0 0 1-4 4h-2" stroke="currentColor" />
    </svg>
  );
}

export function AdminMonitoringIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M3 17h3l3-9 4 12 3-9 2 6h3" stroke="currentColor" />
    </svg>
  );
}

export function AdminDesignIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="m14.5 4.5 5 5-11 11H3.5v-5z" stroke="currentColor" />
      <path d="m12.5 6.5 5 5" stroke="currentColor" />
    </svg>
  );
}

export function AdminCopyIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <rect height="13" rx="2" stroke="currentColor" width="13" x="8" y="8" />
      <path d="M5 16V5a1 1 0 0 1 1-1h11" stroke="currentColor" />
    </svg>
  );
}

export function AdminArchiveIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <rect height="4" rx="1" stroke="currentColor" width="18" x="3" y="4" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" stroke="currentColor" />
      <path d="M10 13h4" stroke="currentColor" />
    </svg>
  );
}

export function AdminDragHandleIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="currentColor" stroke="none" viewBox="0 0 24 24">
      <circle cx="8" cy="6" r="1.6" />
      <circle cx="16" cy="6" r="1.6" />
      <circle cx="8" cy="12" r="1.6" />
      <circle cx="16" cy="12" r="1.6" />
      <circle cx="8" cy="18" r="1.6" />
      <circle cx="16" cy="18" r="1.6" />
    </svg>
  );
}

export function AdminPendingActionsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" />
      <path d="M12 9v4M12 17h.01" stroke="currentColor" />
    </svg>
  );
}

export function AdminGifIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <rect height="14" rx="2" stroke="currentColor" width="18" x="3" y="5" />
      <path d="M7 10v4M12 10v4M17 10.5c-.8-.5-2-.5-2 .8v1.4c0 1.3 1.2 1.3 2 .8" stroke="currentColor" />
    </svg>
  );
}

export function AdminCreditsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" />
    </svg>
  );
}

export function AdminScopePlatformIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.3-3.6-8.5S9.6 5.8 12 3.5Z" stroke="currentColor" />
    </svg>
  );
}

export function AdminScopePrivateIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <rect height="10" rx="2" stroke="currentColor" width="14" x="5" y="11" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" />
    </svg>
  );
}

export function AdminScopeAdaptedIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M17 2.1 21 6l-4 3.9" stroke="currentColor" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" stroke="currentColor" />
      <path d="m7 21.9-4-3.9 4-3.9" stroke="currentColor" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" stroke="currentColor" />
    </svg>
  );
}
