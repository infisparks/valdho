"use client";

import React from "react";

export function CycleSection() {
  return (
    <section className="bg-white text-slate-900 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 border-2 border-slate-200">
      <h2 className="text-2xl sm:text-3xl font-black text-center text-slate-950 leading-tight">
        Most businesses are stuck in this cycle:
      </h2>

      <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-5 space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-start space-x-3">
          <span className="text-red-600 text-xl font-black mt-0.5">
            <i className="fa-solid fa-xmark"></i>
          </span>
          <p className="text-slate-900 font-bold text-base sm:text-lg leading-snug">
            Spending money on ads but getting{" "}
            <span className="font-black underline decoration-red-500">
              fake or low-quality leads
            </span>
          </p>
        </div>

        <div className="flex items-start space-x-3">
          <span className="text-red-600 text-xl font-black mt-0.5">
            <i className="fa-solid fa-xmark"></i>
          </span>
          <p className="text-slate-900 font-bold text-base sm:text-lg leading-snug">
            Posting on Instagram but getting{" "}
            <span className="font-black underline decoration-red-500">
              likes instead of clients
            </span>
          </p>
        </div>

        <div className="flex items-start space-x-3">
          <span className="text-red-600 text-xl font-black mt-0.5">
            <i className="fa-solid fa-xmark"></i>
          </span>
          <p className="text-slate-900 font-bold text-base sm:text-lg leading-snug">
            Hiring agencies who show{" "}
            <span className="font-black underline decoration-red-500">
              reach & impressions, not revenue
            </span>
          </p>
        </div>

        <div className="flex items-start space-x-3">
          <span className="text-red-600 text-xl font-black mt-0.5">
            <i className="fa-solid fa-xmark"></i>
          </span>
          <p className="text-slate-900 font-bold text-base sm:text-lg leading-snug">
            Depending on referrals and luck to survive
          </p>
        </div>

        {/* Highlighted takeaway box */}
        <div className="bg-amber-100 border border-amber-300 rounded-xl p-3.5 mt-2 text-center text-slate-950 font-extrabold text-sm sm:text-base">
          👉 Without appointments, you don’t have a business. You have stress.
        </div>
      </div>
    </section>
  );
}
