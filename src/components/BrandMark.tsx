export function BrandMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#5e6ad2" fillOpacity="0.18" stroke="#7170ff" strokeOpacity="0.55" />
      {/* gate posts */}
      <path d="M9 22V11.5C9 10.12 10.12 9 11.5 9h9c1.38 0 2.5 1.12 2.5 2.5V22" stroke="#f7f8f8" strokeWidth="1.6" strokeLinecap="round" />
      {/* policy bar */}
      <path d="M11 16.5h10" stroke="#7170ff" strokeWidth="1.8" strokeLinecap="round" />
      {/* pulse node */}
      <circle cx="16" cy="16.5" r="2.1" fill="#7170ff" />
      <circle cx="16" cy="16.5" r="3.4" stroke="#7170ff" strokeOpacity="0.35" />
    </svg>
  );
}
