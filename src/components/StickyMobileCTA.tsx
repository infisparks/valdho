"use client";

import React from "react";

export function StickyMobileCTA({ onBookClick }: { onBookClick: () => void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-2.5 bg-black/90 backdrop-blur-md border-t border-amber-500/30 sm:hidden flex items-center justify-between shadow-2xl">
      <div className="flex flex-col text-left pl-2">
        <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider">
          Limited Spots Left
        </span>
        <span className="text-xs font-black text-white leading-tight">
          Turn Clicks into Revenue
        </span>
      </div>
      <button
        onClick={onBookClick}
        className="cta-gold-btn shimmer py-2.5 px-4 rounded-xl text-slate-950 font-black text-xs uppercase tracking-wide flex items-center space-x-1 shadow-lg"
      >
        <span>Book Session</span>
        <i className="fa-solid fa-arrow-right text-[10px]"></i>
      </button>
    </div>
  );
}
