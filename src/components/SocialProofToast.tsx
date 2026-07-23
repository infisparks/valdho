"use client";

import React, { useState, useEffect } from "react";

const toastMessages = [
  { name: "Dr. Malhotra (Delhi)", action: "Booked a Growth Session", time: "2 mins ago" },
  { name: "Wao Mobile (Mumbai)", action: "Generated 45 store inquiries today", time: "6 mins ago" },
  { name: "Apex Manufacturing (Gujarat)", action: "Received B2B Contract RFQ", time: "12 mins ago" },
  { name: "Dr. Sajid Firdousi", action: "Scaled to 10k patient appointments", time: "15 mins ago" },
  { name: "TechnoSoft Solutions (Bangalore)", action: "Scheduled 1-on-1 Strategy Call", time: "18 mins ago" },
];

export function SocialProofToast() {
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);

  useEffect(() => {
    // Initial delay before first toast
    const timer1 = setTimeout(() => {
      setCurrentIdx(0);
    }, 4000);

    const interval = setInterval(() => {
      setCurrentIdx((prev) => {
        if (prev === null) return 0;
        const next = (prev + 1) % toastMessages.length;
        return next;
      });

      // Auto hide after 5 seconds
      setTimeout(() => {
        setCurrentIdx(null);
      }, 5000);
    }, 14000);

    return () => {
      clearTimeout(timer1);
      clearInterval(interval);
    };
  }, []);

  if (currentIdx === null) return null;

  const currentToast = toastMessages[currentIdx];

  return (
    <div className="fixed bottom-14 sm:bottom-6 left-4 z-40 max-w-xs animate-toast-in">
      <div className="bg-zinc-900/95 border border-amber-500/40 text-white rounded-2xl p-3 shadow-2xl backdrop-blur-md flex items-center space-x-3">
        <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 text-sm font-black border border-amber-500/40">
          <i className="fa-solid fa-check"></i>
        </div>
        <div className="text-xs">
          <p className="font-extrabold text-white leading-tight">{currentToast.name}</p>
          <p className="text-amber-400 font-semibold">{currentToast.action}</p>
          <p className="text-slate-400 text-[10px] mt-0.5">{currentToast.time}</p>
        </div>
      </div>
    </div>
  );
}
