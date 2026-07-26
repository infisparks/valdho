"use client";

import React, { useState, useEffect } from "react";

export function StickyMobileCTA({ onBookClick }: { onBookClick: () => void }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky CTA once user scrolls past 280px (past top hero section)
      if (window.scrollY > 280) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-3 left-3 right-3 sm:bottom-5 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-xl z-50 transition-all duration-500 ease-out ${
        isVisible
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "translate-y-16 opacity-0 pointer-events-none"
      }`}
    >
      {/* Container: Glassmorphic Floating Pill Bar */}
      <div className="bg-zinc-950/95 border-2 border-amber-400/80 rounded-2xl sm:rounded-full p-2.5 sm:p-2 sm:px-4 shadow-[0_10px_40px_rgba(245,166,35,0.4)] backdrop-blur-xl flex items-center justify-between gap-2.5">
        {/* Left Side: Pulsing Dot & Urgency Info */}
        <div className="flex items-center space-x-2.5 overflow-hidden pl-1">
          {/* Pulsing Live Urgency Badge */}
          <div className="relative flex-shrink-0 flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </div>

          <div className="text-left leading-tight overflow-hidden">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] sm:text-xs font-black text-amber-400 uppercase tracking-widest truncate">
                🔥 3 Spots Left This Month
              </span>
            </div>
            <p className="text-xs sm:text-sm font-extrabold text-white truncate">
              Ready to Scale Revenue?
            </p>
          </div>
        </div>

        {/* Right Side: High-Impact Gold Button */}
        <button
          onClick={onBookClick}
          className="cta-gold-btn shimmer py-2.5 px-3.5 sm:px-5 rounded-xl sm:rounded-full text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wide flex items-center space-x-1.5 shadow-xl hover:scale-105 active:scale-95 transition-all flex-shrink-0"
        >
          <span>BOOK APPOINTMENT</span>
          <i className="fa-solid fa-arrow-right text-xs"></i>
        </button>
      </div>
    </div>
  );
}
