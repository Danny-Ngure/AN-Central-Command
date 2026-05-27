import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-9 h-9" }) => {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Outer Blue Ring matching the logo circle */}
      <circle cx="50" cy="46" r="38" fill="none" stroke="#0066FF" strokeWidth="2.5" opacity="0.9" />
      
      {/* Red Left Diagonal Arrow part of the 'A' */}
      <path 
        d="M 23,53 L 50,15 L 59,26 L 35,53 Z" 
        fill="url(#logoRedGradient)" 
      />
      
      {/* Blue Right Loop & Crossbar of the 'A' */}
      <path 
        d="M 50,15 L 77,53 L 68,53 L 61,42 L 42,42 L 36,50 L 41,53 L 68,53 L 50,26 Z" 
        fill="url(#logoBlueGradient)" 
      />
      
      {/* Stacked Database Cylinder at the base */}
      <g transform="translate(0, 4)">
        {/* Top Cap */}
        <ellipse cx="50" cy="56" rx="9" ry="3" fill="#00D4FF" />
        
        {/* Top Cylinder body */}
        <path d="M 41,56 A 9,3 0 0 0 59,56 L 59,60 A 9,3 0 0 1 41,60 Z" fill="url(#cylinderGradient)" stroke="#0066FF" strokeWidth="0.5" />
        
        {/* Middle Cylinder body */}
        <path d="M 41,60 A 9,3 0 0 0 59,60 L 59,64 A 9,3 0 0 1 41,64 Z" fill="url(#cylinderGradient)" stroke="#0066FF" strokeWidth="0.5" />
        
        {/* Bottom Cylinder body */}
        <path d="M 41,64 A 9,3 0 0 0 59,64 L 59,68 A 9,3 0 0 1 41,68 Z" fill="url(#cylinderGradient)" stroke="#0066FF" strokeWidth="0.5" />
      </g>
      
      {/* Gradient Definitions */}
      <defs>
        {/* Red Arrow Gradient */}
        <linearGradient id="logoRedGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF5533" />
          <stop offset="100%" stopColor="#CC1100" />
        </linearGradient>
        
        {/* Blue Loop Gradient */}
        <linearGradient id="logoBlueGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00D4FF" />
          <stop offset="100%" stopColor="#0044CC" />
        </linearGradient>

        {/* Cylinder Fill Gradient */}
        <linearGradient id="cylinderGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0033AA" />
          <stop offset="50%" stopColor="#0088FF" />
          <stop offset="100%" stopColor="#002288" />
        </linearGradient>
      </defs>
    </svg>
  );
};
export default Logo;
