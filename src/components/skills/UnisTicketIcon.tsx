export function UnisTicketIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="8" fill="hsl(267, 53%, 49%)" />
      <text
        x="20"
        y="27"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="18"
        fill="white"
        letterSpacing="-0.5"
      >
        UT
      </text>
    </svg>
  );
}
