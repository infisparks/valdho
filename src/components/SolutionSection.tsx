"use client";

import React from "react";

export function SolutionSection({ onBookClick }: { onBookClick: () => void }) {
  return (
    <section className="bg-white text-slate-900 rounded-3xl p-4 sm:p-7 text-center space-y-3.5 shadow-xl my-3">
      <div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-950 leading-tight">
          We Don’t Run Ads.
        </h2>
        <p className="text-lg sm:text-xl md:text-2xl font-black text-amber-600 mt-0.5">
          We Build Revenue Systems.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">
          We combine into one system:
        </p>

        {/* 2-Column Side-by-Side Grid for Mobile to Save Vertical Height */}
        <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm font-extrabold text-slate-950">
          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-center items-center text-center">
            <span className="text-amber-600 text-sm mb-0.5">⚡</span>
            <span>Performance Marketing (Paid Ads)</span>
          </div>

          <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200 shadow-sm flex flex-col justify-center items-center text-center">
            <span className="text-blue-600 text-sm mb-0.5">🌱</span>
            <span>Organic Content (Trust & Authority)</span>
          </div>
        </div>
      </div>

      {/* Compact Outcome Bullet List */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 text-left space-y-2 shadow-sm text-xs sm:text-base">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-bold text-slate-800">
          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-circle-check text-amber-500 text-sm flex-shrink-0"></i>
            <span>Attracts the right people</span>
          </div>

          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-circle-check text-amber-500 text-sm flex-shrink-0"></i>
            <span>Builds trust automatically</span>
          </div>

          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-circle-check text-amber-500 text-sm flex-shrink-0"></i>
            <span>Filters out time-wasters</span>
          </div>

          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-circle-check text-amber-500 text-sm flex-shrink-0"></i>
            <span>
              Sends you{" "}
              <span className="font-black text-slate-950 underline decoration-amber-400">
                ready-to-buy clients
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <button
        onClick={onBookClick}
        className="w-full cta-gold-btn shimmer rounded-2xl p-3 sm:p-4 text-center text-slate-950 font-black hover:opacity-95 transition-all overflow-hidden"
      >
        <div className="text-[13px] min-[360px]:text-sm sm:text-xl md:text-2xl font-black uppercase tracking-tight sm:tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
          BOOK YOUR GROWTH SESSION
        </div>
        <div className="text-[10px] sm:text-xs font-semibold text-slate-900 mt-0.5">
          No sales pitch. Just a real roadmap for your business.
        </div>
      </button>
    </section>
  );
}
