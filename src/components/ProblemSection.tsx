"use client";

import React from "react";

export function ProblemSection() {
  const problems = [
    "Wrong hiring (no real growth & sales expertise)",
    "Wrong agency (leads come, but clients don’t close)",
    "No proper qualification system",
    "No sales funnel strategy",
    "No automated appointment booking",
    "No CRM & follow-up discipline",
  ];

  return (
    <section className="space-y-6 pt-2">
      <h2 className="text-2xl sm:text-3xl font-black text-center text-white leading-tight">
        Why Most Businesses Are Not Growing Even After Spending on Marketing
      </h2>

      {/* 6 Red Cross Problem Cards */}
      <div className="space-y-3">
        {problems.map((prob, idx) => (
          <div
            key={idx}
            className="dark-gold-card rounded-2xl p-4 flex items-center space-x-3.5 hover:border-amber-500/60 transition-colors"
          >
            <div className="text-red-500 text-2xl font-black flex-shrink-0">
              <i className="fa-solid fa-xmark"></i>
            </div>
            <p className="text-slate-200 text-sm sm:text-base font-semibold">
              {prob}
            </p>
          </div>
        ))}
      </div>

      {/* Problem Diagnosis Content */}
      <div className="text-center space-y-4 pt-3 px-2">
        <p className="text-xl sm:text-2xl font-bold text-white">
          The real <span className="text-red-500 font-black">problem</span> is not your product or service.
        </p>

        <p className="text-xl sm:text-2xl font-bold text-white">
          The <span className="text-red-500 font-black">problem</span> is you don’t have a{" "}
          <span className="font-extrabold text-white underline decoration-amber-400">
            revenue system
          </span>
          .
        </p>

        <div className="py-3.5 px-4 bg-zinc-900/90 rounded-2xl border border-zinc-800 text-base sm:text-lg text-slate-300 font-medium space-y-2">
          <p className="text-slate-300 font-bold">Right now your business is running on:</p>
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-amber-400 font-extrabold tracking-wide text-xs sm:text-sm md:text-base">
            <span>Ads</span>
            <span className="text-slate-500 font-normal">→</span>
            <span>Random leads</span>
            <span className="text-slate-500 font-normal">→</span>
            <span>Missed follow-ups</span>
            <span className="text-slate-500 font-normal">→</span>
            <span className="text-red-500 font-bold">Lost sales</span>
          </div>
        </div>

        <p className="text-base text-slate-300 font-medium">That’s why...</p>

        <p className="text-xl sm:text-2xl font-extrabold text-white">
          You get inquiries... but <span className="text-red-500 font-black">not</span> predictable revenue.
        </p>
      </div>
    </section>
  );
}
