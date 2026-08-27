type IconProps = {
  className?: string;
};

export function ShoppingBagIcon({ className = "size-5" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M6.5 8.5h11l.9 11a1.6 1.6 0 0 1-1.6 1.7H7.2a1.6 1.6 0 0 1-1.6-1.7l.9-11Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function CoinIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M14.2 9.6a2.4 2.4 0 0 0-2.2-1.2c-1.6 0-2.6 1-2.6 2.1 0 3.1 4.9 1.3 4.9 4.2 0 1.2-1.1 2.2-2.6 2.2a2.6 2.6 0 0 1-2.4-1.3M12 7.3v1.1M12 15.6v1.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function CalendarXIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <rect height="15" rx="1.6" stroke="currentColor" strokeWidth="2" width="16" x="4" y="5" />
      <path d="M4 9.5h16M8 3v3.4M16 3v3.4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="m9.8 13.3 4.4 4.4m0-4.4-4.4 4.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function LockIcon({ className = "size-6" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <rect height="10" rx="1.8" stroke="currentColor" strokeWidth="2" width="14" x="5" y="11" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <circle cx="12" cy="15.6" fill="currentColor" r="1.15" />
    </svg>
  );
}

export function ArrowRightAltIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 12h15.5m0 0-5-5m5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
