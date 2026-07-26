"use client";

import React from "react";

export function SolutionSection({ onBookClick }: { onBookClick: () => void }) {
  return (
    <section className="relative rounded-3xl p-4 sm:p-7 md:p-8 text-center space-y-4 shadow-[0_0_50px_rgba(245,166,35,0.15)] border border-amber-500/30 bg-gradient-to-b from-zinc-950 via-[#0d0e14] to-zinc-950 overflow-hidden my-3">
      {/* Background Subtle Radial Glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 blur-[90px] rounded-full pointer-events-none" />

      {/* Top Header Badge */}
      <div className="inline-flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 rounded-full text-amber-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
        <span>The Growth Architecture</span>
      </div>

      {/* Section Headings */}
      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
          We Don’t Run Ads.
        </h2>
        <p className="text-xl sm:text-2xl md:text-3xl font-black bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
          We Build Revenue Systems.
        </p>
      </div>

      {/* Synergistic 2-Column Architecture */}
      <div className="space-y-2.5 max-w-2xl mx-auto">
        <p className="text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center justify-center space-x-2">
          <span className="w-8 h-[1px] bg-zinc-800"></span>
          <span>WE COMBINE INTO ONE SYSTEM</span>
          <span className="w-8 h-[1px] bg-zinc-800"></span>
        </p>

        {/* 2 Side-by-Side High-Tech Cards */}
        <div className="grid grid-cols-2 gap-2.5 text-left">
          {/* Card 1: Performance Marketing */}
          <div className="p-3 sm:p-4 bg-zinc-900/90 rounded-2xl border border-amber-500/40 hover:border-amber-400 transition-all shadow-lg flex flex-col items-center text-center space-y-2 group">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-[0_0_15px_rgba(245,166,35,0.2)] group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <div className="text-xs sm:text-sm font-extrabold text-white leading-tight">
                Performance Marketing
              </div>
              <div className="text-[10px] sm:text-xs font-semibold text-amber-400 mt-0.5">
                (Paid Ads Engine)
              </div>
            </div>
          </div>

          {/* Card 2: Organic Content */}
          <div className="p-3 sm:p-4 bg-zinc-900/90 rounded-2xl border border-blue-500/40 hover:border-blue-400 transition-all shadow-lg flex flex-col items-center text-center space-y-2 group">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-500/15 border border-blue-500/40 text-blue-400 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
            </div>
            <div>
              <div className="text-xs sm:text-sm font-extrabold text-white leading-tight">
                Organic Content
              </div>
              <div className="text-[10px] sm:text-xs font-semibold text-blue-400 mt-0.5">
                (Trust & Authority)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Outcome Bullet List */}
      <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-2xl p-3.5 sm:p-4 text-left shadow-inner max-w-2xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-bold text-slate-200 text-xs sm:text-sm">
          <div className="flex items-center space-x-2.5">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
              <i className="fa-solid fa-check text-[10px] sm:text-xs"></i>
            </div>
            <span>Attracts the right people</span>
          </div>

          <div className="flex items-center space-x-2.5">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
              <i className="fa-solid fa-check text-[10px] sm:text-xs"></i>
            </div>
            <span>Builds trust automatically</span>
          </div>

          <div className="flex items-center space-x-2.5">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
              <i className="fa-solid fa-check text-[10px] sm:text-xs"></i>
            </div>
            <span>Filters out time-wasters</span>
          </div>

          <div className="flex items-center space-x-2.5">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
              <i className="fa-solid fa-check text-[10px] sm:text-xs"></i>
            </div>
            <span>
              Sends you{" "}
              <span className="font-black text-amber-400 underline decoration-amber-400">
                ready-to-buy clients
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <button
        onClick={onBookClick}
        className="w-full max-w-2xl mx-auto cta-gold-btn shimmer rounded-2xl p-3 sm:p-4 text-center text-slate-950 font-black hover:opacity-95 transition-all overflow-hidden block"
      >
        <div className="text-xs min-[360px]:text-sm sm:text-xl md:text-2xl font-black uppercase tracking-tight sm:tracking-wide whitespace-nowrap overflow-hidden text-ellipsis flex items-center justify-center space-x-2">
          <span>BOOK YOUR GROWTH SESSION</span>
          <i className="fa-solid fa-arrow-right text-xs sm:text-lg"></i>
        </div>
        <div className="text-[10px] sm:text-xs font-extrabold text-slate-900 mt-0.5">
          No sales pitch. Just a real roadmap for your business.
        </div>
      </button>
    </section>
  );
}
