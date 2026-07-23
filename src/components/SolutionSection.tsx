"use client";

import React from "react";

export function SolutionSection({ onBookClick }: { onBookClick: () => void }) {
  return (
    <section className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl my-6">
      <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950">
        We Don’t Run Ads.
      </h2>

      <p className="text-xl sm:text-2xl font-black text-slate-800">
        We Build Revenue Systems.
      </p>

      <div className="space-y-3 py-2 text-slate-800">
        <p className="text-base sm:text-lg font-medium text-slate-600">We combine:</p>

        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 font-black text-lg sm:text-xl text-slate-950 shadow-sm">
          Performance Marketing (Paid Ads)
        </div>

        <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 font-black text-lg sm:text-xl text-slate-950 shadow-sm">
          Organic Content (Trust & Authority)
        </div>

        <p className="text-base sm:text-lg font-medium text-slate-600 pt-2">
          Into one powerful system that:
        </p>
      </div>

      {/* Bullet List Card inside white section */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-4 shadow-sm">
        <div className="flex items-start space-x-3">
          <div className="text-amber-500 text-xl font-bold mt-0.5">
            <i className="fa-solid fa-arrow-up-right-from-square"></i>
          </div>
          <p className="text-slate-800 font-bold text-base sm:text-lg">
            Attracts the right people
          </p>
        </div>

        <div className="flex items-start space-x-3">
          <div className="text-amber-500 text-xl font-bold mt-0.5">
            <i className="fa-solid fa-arrow-up-right-from-square"></i>
          </div>
          <p className="text-slate-800 font-bold text-base sm:text-lg">
            Builds trust automatically
          </p>
        </div>

        <div className="flex items-start space-x-3">
          <div className="text-amber-500 text-xl font-bold mt-0.5">
            <i className="fa-solid fa-arrow-up-right-from-square"></i>
          </div>
          <p className="text-slate-800 font-bold text-base sm:text-lg">
            Filters out time-wasters
          </p>
        </div>

        <div className="flex items-start space-x-3">
          <div className="text-amber-500 text-xl font-bold mt-0.5">
            <i className="fa-solid fa-arrow-up-right-from-square"></i>
          </div>
          <p className="text-slate-800 font-bold text-base sm:text-lg">
            Sends you only{" "}
            <span className="font-black text-slate-950 underline decoration-amber-400">
              ready-to-buy clients
            </span>
          </p>
        </div>
      </div>

      {/* CTA Button inside white section */}
      <button
        onClick={onBookClick}
        className="w-full cta-gold-btn shimmer rounded-2xl p-3.5 sm:p-5 text-center text-slate-950 font-black hover:opacity-95 transition-all overflow-hidden"
      >
        <div className="text-[13px] min-[360px]:text-sm sm:text-xl md:text-2xl font-black uppercase tracking-tight sm:tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
          BOOK YOUR GROWTH SESSION
        </div>
        <div className="text-[11px] sm:text-sm font-semibold text-slate-900 mt-1">
          No sales pitch. Just a real roadmap for your business.
        </div>
      </button>
    </section>
  );
}
