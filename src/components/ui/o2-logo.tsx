import React from "react";
interface O2LogoProps { size?: number; className?: string; }
export function O2Logo({ size = 32, className }: O2LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="100" height="100" rx="20" fill="#C8102E" />
      <circle cx="50" cy="42" r="22" fill="none" stroke="white" strokeWidth="7" />
      <text x="50" y="51" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold" fontFamily="Arial, sans-serif">2</text>
      <text x="50" y="85" textAnchor="middle" fill="white" fontSize="10" fontFamily="Arial, sans-serif" letterSpacing="1">O2NEXUS</text>
    </svg>
  );
}
