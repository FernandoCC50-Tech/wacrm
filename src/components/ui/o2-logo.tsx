export function O2Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="O2Nexus"
    >
      {/* Fundo vermelho */}
      <rect width="100" height="100" rx="16" fill="#C8102E" />
      {/* Círculo externo branco */}
      <circle cx="50" cy="46" r="26" stroke="white" strokeWidth="7" fill="none" />
      {/* Número 2 */}
      <text
        x="67"
        y="72"
        fill="white"
        fontSize="28"
        fontWeight="900"
        fontFamily="Arial, sans-serif"
      >
        2
      </text>
    </svg>
  );
}
