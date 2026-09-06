import Image from 'next/image';
// Bundled examples: choosing or browsing styles never invokes a provider.
export function ImageStyleSample({ preset }: { preset: string }) {
  if (preset === 'photography') return <span className="relative mb-2 block h-16 overflow-hidden rounded-lg"><Image alt="" fill sizes="220px" className="object-cover" src="/images/org-landing-team-photo.jpg"/></span>;
  return <svg aria-hidden="true" viewBox="0 0 200 80" className="mb-2 h-16 w-full rounded-lg bg-slate-50">
    {preset === 'diagram' ? <g fill="white" stroke="#456178" strokeWidth="2"><path d="M100 22V43M45 43H155M45 43V55M155 43V55"/><rect x="73" y="7" width="54" height="22" rx="4"/><rect x="18" y="55" width="54" height="18" rx="4"/><rect x="128" y="55" width="54" height="18" rx="4"/></g>
      : preset === 'custom' ? <g fill="none" stroke="#42536b" strokeWidth="3" strokeLinecap="round"><path d="M35 59Q60 8 90 45T164 21M37 66L58 62M154 13L164 21L153 26"/></g>
      : <><defs><radialGradient id="image-style-tree"><stop stopColor="#a5cc91"/><stop offset="1" stopColor="#366556"/></radialGradient></defs>
        <ellipse cx="100" cy="70" rx="45" ry="7" fill={preset === 'realistic' ? '#cbd5cb' : '#dceade'}/>
        <path d="M95 35H105V70H95Z" fill="#79594c"/>
        <path d="M100 5C65 4 49 37 71 48C51 66 135 68 136 43C149 25 123 5 100 5Z" fill={preset === 'realistic' ? 'url(#image-style-tree)' : '#4ca78a'}/>
        {preset === 'realistic' && <path d="M100 62V33M100 47L86 35M100 42L111 28" fill="none" stroke="#587350" strokeWidth="2"/>}
      </>}
  </svg>;
}
