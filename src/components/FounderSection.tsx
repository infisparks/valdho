"use client";

import React from "react";

export function FounderSection({ onBookClick }: { onBookClick: () => void }) {
  return (
    <section className="gold-border-card bg-gradient-to-b from-[#131316] to-[#0a0a0c] text-white rounded-3xl p-5 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      <div className="flex items-center space-x-2 text-amber-400 font-extrabold text-xs tracking-widest uppercase bg-amber-500/10 px-3.5 py-1 rounded-full border border-amber-500/30 w-fit mx-auto">
        <i className="fa-solid fa-user-shield text-xs"></i>
        <span>Meet The Founder</span>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 text-center md:text-left">
        {/* Founder Image */}
        <div className="relative flex-shrink-0">
          <div className="w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-3xl overflow-hidden border-2 border-amber-500/60 shadow-[0_0_30px_rgba(245,166,35,0.25)] relative group">
            <img
              src="/founder.png"
              alt="Founder - First Option Agency"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-slate-950 text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full shadow-lg border border-emerald-300 flex items-center space-x-1">
            <i className="fa-solid fa-circle-check"></i>
            <span>Verified Founder</span>
          </div>
        </div>

        {/* Founder Bio & Statement */}
        <div className="space-y-3 flex-1">
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Behind First Option Agency
            </h3>
            <p className="text-amber-400 font-bold text-xs sm:text-sm mt-0.5">
              Founder & Senior Revenue Strategist
            </p>
          </div>

          <p className="text-slate-300 text-xs sm:text-sm md:text-base leading-relaxed font-medium">
            &quot;We created First Option Agency after watching hundreds of business owners burn lakhs of rupees on traditional agencies that only delivered impressions, vanity metrics, and fake leads. Our mission is simple: build a predictable, automated revenue engine that turns clicks into real buyers.&quot;
          </p>

          <div className="pt-2 flex flex-wrap gap-2 justify-center md:justify-start text-xs font-bold text-slate-200">
            <span className="bg-zinc-800/90 border border-zinc-700 px-3 py-1 rounded-xl">
              🎯 Direct Response Ads
            </span>
            <span className="bg-zinc-800/90 border border-zinc-700 px-3 py-1 rounded-xl">
              📈 Revenue Systems
            </span>
            <span className="bg-zinc-800/90 border border-zinc-700 px-3 py-1 rounded-xl">
              🚀 10k+ Lead Pipeline
            </span>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <button
        onClick={onBookClick}
        className="w-full cta-gold-btn shimmer rounded-2xl p-3.5 sm:p-4 text-center text-slate-950 font-black hover:opacity-95 transition-all overflow-hidden mt-2"
      >
        <div className="text-sm sm:text-base md:text-lg font-black uppercase tracking-wide flex items-center justify-center space-x-2">
          <span>Book a 1-on-1 Strategy Session With Me</span>
          <i className="fa-solid fa-arrow-right"></i>
        </div>
      </button>
    </section>
  );
}
