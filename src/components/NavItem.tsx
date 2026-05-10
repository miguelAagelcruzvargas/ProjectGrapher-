import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function NavItem({ active, onClick, icon, label, mobile, badge }: { 
  active: boolean, 
  onClick: () => void, 
  icon: React.ReactNode, 
  label: string,
  mobile?: boolean,
  badge?: boolean
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-2xl px-2.5 py-2.5 transition-all lg:justify-start lg:gap-3 lg:rounded-xl lg:px-3 lg:py-3",
        "flex-1 lg:flex-none",
        active 
          ? "bg-brand-primary text-white" 
          : "text-gray-500 hover:text-white hover:bg-gray-800"
      )}
    >
      <div className="shrink-0">{icon}</div>
      {mobile && <span className="max-w-[68px] truncate text-[10px] font-medium leading-tight lg:hidden">{label}</span>}
      {badge && <div className="absolute top-2 right-2 md:top-1 md:right-1 w-2 h-2 bg-brand-secondary rounded-full" />}
    </button>
  );
}
