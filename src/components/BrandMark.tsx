export function BrandMark({
  className = "h-6 w-6",
  solid = false,
}: {
  className?: string;
  solid?: boolean;
}) {
  if (solid) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <rect x="0" y="0" width="64" height="64" rx="16" fill="#5E6AD2" />
        <path d="M18 46V24c0-3.314 2.686-6 6-6h16c3.314 0 6 2.686 6 6v22" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M22 34h20" stroke="#D7DCFF" strokeWidth="3.6" strokeLinecap="round" />
        <circle cx="32" cy="34" r="4.2" fill="#FFFFFF" />
        <circle cx="32" cy="34" r="7.2" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#5E6AD2" fillOpacity="0.16" stroke="#7170FF" strokeOpacity="0.55" strokeWidth="2" />
      <path d="M18 46V24c0-3.314 2.686-6 6-6h16c3.314 0 6 2.686 6 6v22" stroke="#F7F8F8" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M22 34h20" stroke="#7170FF" strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="32" cy="34" r="4.2" fill="#7170FF" />
      <circle cx="32" cy="34" r="7.2" stroke="#7170FF" strokeOpacity="0.35" strokeWidth="2" />
    </svg>
  );
}
