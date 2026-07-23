"use client";

import React from "react";

export function HeaderBadge({ onBookClick }: { onBookClick: () => void }) {
  return (
    <header className="w-full max-w-md md:max-w-xl lg:max-w-2xl px-4 pt-4 pb-1">
      <div 
        onClick={onBookClick}
        className="cta-gold-btn shimmer text-slate-950 font-black text-base sm:text-lg text-center py-3.5 px-4 rounded-2xl shadow-xl leading-snug tracking-tight cursor-pointer hover:scale-[1.01] transition-transform"
      >
        Turn Your Business Into a Client-Getting Machine
      </div>
    </header>
  );
}
