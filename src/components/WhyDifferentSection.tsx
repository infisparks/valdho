"use client";

import React from "react";

export function WhyDifferentSection() {
  return (
    <section className="relative rounded-3xl p-4 sm:p-7 text-center space-y-4 shadow-[0_0_50px_rgba(245,166,35,0.15)] border border-amber-500/30 bg-gradient-to-b from-zinc-950 via-[#0d0e14] to-zinc-950 overflow-hidden my-3">
      {/* Background Subtle Radial Glow */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none" />

      {/* Top Header Badge */}
      <div className="inline-flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 rounded-full text-amber-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
        <i className="fa-solid fa-layer-group text-[10px]"></i>
        <span>Proven Methodology</span>
      </div>

      {/* Section Title */}
      <div className="flex items-center justify-center space-x-2 text-xl sm:text-3xl font-black text-white text-center tracking-tight">
        <i className="fa-solid fa-chart-line text-amber-400 text-lg sm:text-2xl"></i>
        <h2>WHY WE ARE DIFFERENT</h2>
      </div>

      <div className="space-y-3.5 text-center max-w-2xl mx-auto">
        {/* Most Agencies Broken Model */}
        <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-3 sm:p-4 space-y-2 shadow-inner">
          <p className="text-[10px] sm:text-xs uppercase tracking-wider font-extrabold text-red-400 flex items-center justify-center space-x-1.5">
            <i className="fa-solid fa-triangle-exclamation text-red-400"></i>
            <span>Most agencies focus on:</span>
          </p>
          <div className="flex items-center justify-center flex-wrap gap-1.5 sm:gap-2">
            <span className="bg-red-500/10 text-red-200 border border-red-500/20 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-extrabold">
              Ads
            </span>
            <i className="fa-solid fa-arrow-right text-[10px] text-red-400/60"></i>
            <span className="bg-red-500/10 text-red-200 border border-red-500/20 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-extrabold">
              Leads
            </span>
            <i className="fa-solid fa-arrow-right text-[10px] text-red-400/60"></i>
            <span className="bg-red-500/10 text-red-200 border border-red-500/20 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-extrabold">
              Done
            </span>
            <span className="bg-red-500/20 text-red-400 border border-red-500/40 w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-black ml-1">
              ✕
            </span>
          </div>
        </div>

        {/* First Option Agency Winning Model */}
        <div className="bg-emerald-950/40 border-2 border-emerald-500/50 rounded-2xl p-3.5 sm:p-4 space-y-2.5 shadow-[0_0_25px_rgba(16,185,129,0.15)] relative">
          <p className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-emerald-400 flex items-center justify-center space-x-1.5">
            <i className="fa-solid fa-bullseye text-emerald-400"></i>
            <span>WE FOCUS ON (THE WINNING REVENUE SYSTEM):</span>
          </p>
          
          <div className="flex items-center justify-center flex-wrap gap-1.5 sm:gap-2">
            <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 sm:px-3 py-1 rounded-xl text-xs sm:text-sm font-extrabold shadow-sm">
              Ads
            </span>
            <i className="fa-solid fa-arrow-right text-[10px] text-emerald-400/70"></i>
            <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 sm:px-3 py-1 rounded-xl text-xs sm:text-sm font-extrabold shadow-sm">
              Content
            </span>
            <i className="fa-solid fa-arrow-right text-[10px] text-emerald-400/70"></i>
            <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 sm:px-3 py-1 rounded-xl text-xs sm:text-sm font-extrabold shadow-sm">
              Trust
            </span>
            <i className="fa-solid fa-arrow-right text-[10px] text-emerald-400/70"></i>
            <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 sm:px-3 py-1 rounded-xl text-xs sm:text-sm font-extrabold shadow-sm">
              Funnel
            </span>
            <i className="fa-solid fa-arrow-right text-[10px] text-emerald-400/70"></i>
            <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 sm:px-3 py-1 rounded-xl text-xs sm:text-sm font-extrabold shadow-sm">
              Appointment
            </span>
            <i className="fa-solid fa-arrow-right text-[10px] text-emerald-400/70"></i>
            <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 sm:px-3 py-1 rounded-xl text-xs sm:text-sm font-extrabold shadow-sm">
              Sale
            </span>
            <span className="bg-emerald-500 text-slate-950 w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-black ml-1 shadow-md">
              ✓
            </span>
          </div>
        </div>

        {/* Client Outcomes Box */}
        <div className="border border-zinc-800/90 rounded-2xl p-3.5 sm:p-4 text-left bg-zinc-950/80 space-y-2.5 shadow-inner">
          <p className="text-center font-black text-white text-sm sm:text-base">
            That’s why our clients get:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="flex items-center space-x-2.5 text-slate-200 font-extrabold text-xs sm:text-sm bg-zinc-900/60 p-2 rounded-xl border border-zinc-800">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xs flex-shrink-0">
                <i className="fa-solid fa-check-double"></i>
              </div>
              <span>Better quality leads</span>
            </div>

            <div className="flex items-center space-x-2.5 text-slate-200 font-extrabold text-xs sm:text-sm bg-zinc-900/60 p-2 rounded-xl border border-zinc-800">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xs flex-shrink-0">
                <i className="fa-solid fa-check-double"></i>
              </div>
              <span>Higher closing rate</span>
            </div>

            <div className="flex items-center space-x-2.5 text-slate-200 font-extrabold text-xs sm:text-sm bg-zinc-900/60 p-2 rounded-xl border border-zinc-800">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xs flex-shrink-0">
                <i className="fa-solid fa-check-double"></i>
              </div>
              <span>Predictable revenue & ROI</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
