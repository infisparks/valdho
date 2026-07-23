"use client";

import React from "react";

export function WhyDifferentSection() {
  return (
    <section className="gold-border-card bg-white text-slate-900 rounded-3xl p-5 sm:p-7 space-y-5">
      <div className="flex items-center justify-center space-x-2 text-2xl sm:text-3xl font-black text-slate-950 text-center">
        <span>📈</span>
        <h2>WHY WE ARE DIFFERENT</h2>
      </div>

      <div className="space-y-4 text-center">
        {/* Most Agencies Bad Model */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-1">
          <p className="text-xs uppercase tracking-wider font-extrabold text-red-700">
            Most agencies focus on:
          </p>
          <p className="text-base sm:text-lg font-black text-slate-950 flex items-center justify-center flex-wrap gap-1">
            <span>Ads</span>
            <span className="text-slate-400 font-normal">→</span>
            <span>Leads</span>
            <span className="text-slate-400 font-normal">→</span>
            <span>Done</span>
            <span className="text-red-600 font-black text-xl ml-1">❌</span>
          </p>
        </div>

        {/* First Option Agency Winning Model */}
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 space-y-1.5 shadow-md">
          <p className="text-xs uppercase tracking-wider font-black text-emerald-800">
            We focus on :
          </p>
          <p className="text-xs sm:text-sm md:text-base font-black text-slate-950 leading-relaxed flex items-center justify-center flex-wrap gap-1">
            <span>Ads</span>
            <span className="text-slate-400 font-normal">→</span>
            <span>Content</span>
            <span className="text-slate-400 font-normal">→</span>
            <span>Trust</span>
            <span className="text-slate-400 font-normal">→</span>
            <span>Funnel</span>
            <span className="text-slate-400 font-normal">→</span>
            <span>Appointment</span>
            <span className="text-slate-400 font-normal">→</span>
            <span>Sale</span>
            <span className="text-emerald-600 font-black text-xl ml-1">✅</span>
          </p>
        </div>

        {/* Client Outcomes Box */}
        <div className="border border-slate-300 rounded-2xl p-5 text-left bg-slate-50 space-y-3">
          <p className="text-center font-black text-slate-900 text-lg">
            That’s why our clients get:
          </p>

          <div className="flex items-center space-x-3 text-slate-900 font-extrabold text-base">
            <i className="fa-solid fa-check-double text-emerald-600 text-xl"></i>
            <span>Better quality leads</span>
          </div>

          <div className="flex items-center space-x-3 text-slate-900 font-extrabold text-base">
            <i className="fa-solid fa-check-double text-emerald-600 text-xl"></i>
            <span>Higher closing rate</span>
          </div>

          <div className="flex items-center space-x-3 text-slate-900 font-extrabold text-base">
            <i className="fa-solid fa-check-double text-emerald-600 text-xl"></i>
            <span>Predictable revenue & ROI</span>
          </div>
        </div>
      </div>
    </section>
  );
}
