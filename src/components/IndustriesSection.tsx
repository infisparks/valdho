"use client";

import React, { useState } from "react";

export function IndustriesSection() {
  const [activeTab, setActiveTab] = useState<number>(0);

  const industries = [
    {
      id: "clinic",
      title: "Doctors & Clinics",
      tabLabel: "Doctors",
      icon: "fa-user-doctor",
      img: "/firstoption/Doctors & Clinics.png",
      badgeTag: "Healthcare",
      points: [
        "Real patients seeking specialized treatment",
        "High-ticket procedure inquiries & OPD leads",
        "Automated booking & instant SMS reminders",
      ],
      badge: "⭐ 100+ to 10,000+ consults delivered for dermatologists, dental & specialty clinics.",
    },
    {
      id: "it",
      title: "IT & Service Companies",
      tabLabel: "IT & B2B",
      icon: "fa-laptop-code",
      img: "/firstoption/IT & Service Companies.png",
      badgeTag: "Tech & B2B",
      points: [
        "Decision-maker demo calls (CTOs, CEOs)",
        "Pre-qualified software & agency inquiries",
        "Predictable recurring retainer client pipeline",
      ],
      badge: "💻 Zero time-wasting leads. 100% pre-qualified decision maker meetings.",
    },
    {
      id: "manufacturing",
      title: "Manufacturers & Wholesalers",
      tabLabel: "Manufacturers",
      icon: "fa-industry",
      img: "/firstoption/Manufacturers & Wholesalers.png",
      badgeTag: "Industrial B2B",
      points: [
        "Verified bulk buyers & nationwide distributors",
        "Direct RFQ (Request for Quotation) leads",
        "High-ticket B2B contract revenue pipeline",
      ],
      badge: "🏭 High-value industrial orders for ceramics, machinery, textiles & building materials.",
    },
  ];

  return (
    <section className="space-y-4 pt-2">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-0.5 rounded-full text-amber-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
          <i className="fa-solid fa-briefcase text-[10px]"></i>
          <span>Proven Track Record</span>
        </div>
        <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-center text-white tracking-tight">
          Industries We Scale
        </h2>
      </div>

      {/* Mobile Interactive Tab Switcher Bar */}
      <div className="flex md:hidden items-center justify-center gap-1.5 p-1 bg-zinc-950/90 border border-zinc-800 rounded-2xl max-w-sm mx-auto shadow-inner">
        {industries.map((ind, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] min-[360px]:text-xs font-extrabold transition-all flex items-center justify-center space-x-1 ${
              activeTab === idx
                ? "bg-amber-500 text-slate-950 shadow-md border border-amber-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <i className={`fa-solid ${ind.icon} text-[9px]`}></i>
            <span className="truncate">{ind.tabLabel}</span>
          </button>
        ))}
      </div>

      {/* Mobile Active Card Display (Only 1 Compact Height Card Shown at a time) */}
      <div className="block md:hidden">
        {(() => {
          const ind = industries[activeTab];
          return (
            <div className="bg-gradient-to-b from-zinc-950 via-[#0d0e14] to-zinc-950 border border-amber-500/30 rounded-3xl p-3.5 space-y-3 shadow-[0_0_30px_rgba(245,166,35,0.1)] relative overflow-hidden">
              {/* Compact Widescreen Image Banner */}
              <div className="relative rounded-2xl overflow-hidden aspect-[16/9] w-full bg-zinc-900 border border-zinc-800 shadow-md">
                <img src={ind.img} alt={ind.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute top-2 left-2 bg-amber-500/20 backdrop-blur-md border border-amber-500/40 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                  {ind.badgeTag}
                </div>
                <div className="absolute bottom-2 left-3 right-3 text-white font-extrabold text-sm sm:text-base drop-shadow">
                  {ind.title}
                </div>
              </div>

              {/* Bullet Points */}
              <div className="space-y-1.5 text-left bg-zinc-950/80 p-2.5 rounded-2xl border border-zinc-800">
                {ind.points.map((pt, pIdx) => (
                  <div key={pIdx} className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                    <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-[9px] flex-shrink-0">
                      <i className="fa-solid fa-check"></i>
                    </div>
                    <span className="truncate">{pt}</span>
                  </div>
                ))}
              </div>

              {/* Result Badge */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-2xl text-amber-300 text-[10px] sm:text-xs font-extrabold leading-snug text-left flex items-start space-x-2">
                <i className="fa-solid fa-star text-amber-400 text-xs mt-0.5 flex-shrink-0"></i>
                <span>{ind.badge}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Desktop Grid Display (3 Columns, Dark Glassmorphic Theme) */}
      <div className="hidden md:grid md:grid-cols-3 gap-4">
        {industries.map((ind, idx) => (
          <div
            key={idx}
            className="bg-gradient-to-b from-zinc-950 via-[#0d0e14] to-zinc-950 border border-amber-500/30 hover:border-amber-400/60 rounded-3xl p-4 text-left space-y-3 shadow-lg flex flex-col justify-between transition-all duration-300 group"
          >
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden aspect-[16/10] w-full bg-zinc-900 border border-zinc-800 shadow-md">
                <img
                  src={ind.img}
                  alt={ind.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute top-2.5 left-2.5 bg-amber-500/20 backdrop-blur-md border border-amber-500/40 text-amber-400 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                  {ind.badgeTag}
                </div>
              </div>

              <h3 className="text-lg font-extrabold text-white tracking-tight group-hover:text-amber-400 transition-colors">
                {ind.title}
              </h3>

              <div className="space-y-1.5 bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800">
                {ind.points.map((pt, pIdx) => (
                  <div key={pIdx} className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                    <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-[9px] flex-shrink-0">
                      <i className="fa-solid fa-check"></i>
                    </div>
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-2xl text-amber-300 text-xs font-extrabold leading-snug flex items-start space-x-2">
              <i className="fa-solid fa-star text-amber-400 text-xs mt-0.5 flex-shrink-0"></i>
              <span>{ind.badge}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
