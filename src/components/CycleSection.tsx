"use client";

import React from "react";

export function CycleSection() {
  return (
    <section className="relative rounded-3xl p-4 sm:p-7 text-center space-y-4 shadow-[0_0_50px_rgba(239,68,68,0.12)] border border-red-500/30 bg-gradient-to-b from-zinc-950 via-[#0d0e14] to-zinc-950 overflow-hidden my-3">
      {/* Background Subtle Red Glow */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-red-500/10 blur-[80px] rounded-full pointer-events-none" />

      {/* Top Header Badge */}
      <div className="inline-flex items-center space-x-1.5 bg-red-500/10 border border-red-500/30 px-3.5 py-1 rounded-full text-red-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
        <i className="fa-solid fa-arrows-spin text-[10px]"></i>
        <span>The Broken Trap</span>
      </div>

      {/* Section Title */}
      <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-tight">
        Most Businesses Are Stuck In This Cycle:
      </h2>

      {/* Frustration List Box */}
      <div className="bg-red-950/20 border border-red-500/30 rounded-2xl p-3 sm:p-4 text-left space-y-2.5 shadow-inner max-w-2xl mx-auto">
        <div className="flex items-start space-x-2.5">
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center text-[10px] sm:text-xs font-black flex-shrink-0 mt-0.5">
            ✕
          </div>
          <p className="text-slate-200 font-semibold text-xs sm:text-sm md:text-base leading-snug">
            Spending money on ads but getting{" "}
            <span className="font-extrabold text-red-400 underline decoration-red-500/50">
              fake or low-quality leads
            </span>
          </p>
        </div>

        <div className="flex items-start space-x-2.5">
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center text-[10px] sm:text-xs font-black flex-shrink-0 mt-0.5">
            ✕
          </div>
          <p className="text-slate-200 font-semibold text-xs sm:text-sm md:text-base leading-snug">
            Posting on Instagram but getting{" "}
            <span className="font-extrabold text-red-400 underline decoration-red-500/50">
              likes instead of clients
            </span>
          </p>
        </div>

        <div className="flex items-start space-x-2.5">
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center text-[10px] sm:text-xs font-black flex-shrink-0 mt-0.5">
            ✕
          </div>
          <p className="text-slate-200 font-semibold text-xs sm:text-sm md:text-base leading-snug">
            Hiring agencies who show{" "}
            <span className="font-extrabold text-red-400 underline decoration-red-500/50">
              reach & impressions, not revenue
            </span>
          </p>
        </div>

        <div className="flex items-start space-x-2.5">
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center text-[10px] sm:text-xs font-black flex-shrink-0 mt-0.5">
            ✕
          </div>
          <p className="text-slate-200 font-semibold text-xs sm:text-sm md:text-base leading-snug">
            Depending on <span className="font-extrabold text-slate-100">referrals and luck</span> to survive
          </p>
        </div>

        {/* Highlighted takeaway box */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 sm:p-3 text-center text-amber-300 font-extrabold text-xs sm:text-sm leading-snug flex items-center justify-center space-x-2 mt-2">
          <span>👉</span>
          <span>Without appointments, you don’t have a business. You have stress.</span>
        </div>
      </div>
    </section>
  );
}
