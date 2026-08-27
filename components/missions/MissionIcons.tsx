type IconProps = {
  className?: string;
};

export function BoostIcon({ className = "size-[1.05em] shrink-0 translate-y-px" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 16 16">
      <path
        d="M8.95 1.5 3.4 8.55h4.05l-.42 5.95 5.58-7.2H8.55l.4-5.8Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function BookmarkIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M6.5 4.5c0-.7.6-1.3 1.3-1.3h8.4c.7 0 1.3.6 1.3 1.3v15l-5.5-3.4-5.5 3.4v-15Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function CameraIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M4 8.5c0-.8.7-1.5 1.5-1.5h1.3l.9-1.6c.2-.4.6-.6 1-.6h6.6c.4 0 .8.2 1 .6l.9 1.6h1.3c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function DocumentIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M9 12.5h6M9 16h6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function CheckCircleIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="m8 12.3 2.6 2.6L16.2 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function AlertCircleIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5v6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <circle cx="12" cy="16.7" fill="currentColor" r="1.05" />
    </svg>
  );
}

export function UploadCloudIcon({ className = "size-5" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M7.5 17.5A4 4 0 0 1 6.8 9.6a5 5 0 0 1 9.7-1.7 3.8 3.8 0 0 1 2.5 6.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M12 20v-7m0 0-2.4 2.4M12 13l2.4 2.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function MedicalIcon({ className = "size-5" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M6 8.5c0-1.7 1.3-3 3-3h6c1.7 0 3 1.3 3 3v3c0 4.7-3.1 7.3-6 8.5-2.9-1.2-6-3.8-6-8.5v-3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M12 9v5.2M9.4 11.6h5.2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function KitIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <rect height="12.5" rx="1.5" stroke="currentColor" strokeWidth="2" width="16" x="4" y="6.5" />
      <path d="M4 12h16M12 9.5v5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function OpenExternalIcon({ className = "size-[18px]" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M9 6H6.8A1.8 1.8 0 0 0 5 7.8v9.4A1.8 1.8 0 0 0 6.8 19h9.4a1.8 1.8 0 0 0 1.8-1.8V15M14 5h5v5M18.5 5.5l-8 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function ShareIcon({ className = "size-5" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M12 15V4m0 0L8.2 7.7M12 4l3.8 3.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M6 12v6.2c0 .99.8 1.8 1.8 1.8h8.4c1 0 1.8-.8 1.8-1.8V12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function CopyIcon({ className = "size-[18px]" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <rect height="12.5" rx="1.8" stroke="currentColor" strokeWidth="2" width="12.5" x="8.5" y="8.5" />
      <path
        d="M6 15.5h-.2A1.8 1.8 0 0 1 4 13.7V5.8A1.8 1.8 0 0 1 5.8 4h7.9c1 0 1.8.8 1.8 1.8V6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function HubIcon({ className = "size-9" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="2" />
      <circle cx="5" cy="6.5" r="1.9" stroke="currentColor" strokeWidth="2" />
      <circle cx="19" cy="6.5" r="1.9" stroke="currentColor" strokeWidth="2" />
      <circle cx="5" cy="17.5" r="1.9" stroke="currentColor" strokeWidth="2" />
      <circle cx="19" cy="17.5" r="1.9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9.9 10.6 6.4 8M14.1 10.6 17.6 8M9.9 13.4 6.4 16M14.1 13.4 17.6 16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function MedalIcon({ className = "size-6" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="14.5" r="5" stroke="currentColor" strokeWidth="2" />
      <path
        d="m9.2 10.6-2.7-6.1M14.8 10.6l2.7-6.1M8.2 4.5h7.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="m12 12.3 1 2.1 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3 1-2.1Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}

export function FlagIcon({ className = "size-6" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M6 3v18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path
        d="M6 4.5c2-1 4-1 6 0s4 1 6 0v9c-2 1-4 1-6 0s-4-1-6 0v-9Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function InfoIcon({ className = "size-[18px]" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v5.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <circle cx="12" cy="8" fill="currentColor" r="1" />
    </svg>
  );
}

export function BuildingIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M5 20V7.6c0-.6.4-1.1.9-1.3l5.6-2.2c.3-.1.7-.1 1 0l5.6 2.2c.5.2.9.7.9 1.3V20"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M9 20v-3.6h6V20M8.6 9.8h.01M12 9.8h.01M15.4 9.8h.01M8.6 13h.01M15.4 13h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function StarBadgeIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3.2 14.5 9l6.3.5-4.8 4.1 1.5 6.2-5.5-3.3-5.5 3.3 1.5-6.2-4.8-4.1L9.5 9 12 3.2Z" />
    </svg>
  );
}
