"use client";

import React from "react";

export function HowItWorksSection({ onBookClick }: { onBookClick: () => void }) {
  const steps = [
    {
      step: "01",
      icon: "fa-solid fa-triangle-exclamation",
      title: "Step 1 – We Find Your Buyer",
      desc: "We identify who actually pays you, not just who clicks.",
    },
    {
      step: "02",
      icon: "fa-solid fa-turn-up",
      title: "Step 2 – We Create High-Converting Ads",
      desc: "Ads designed to attract buyers, not browsers.",
    },
    {
      step: "03",
      icon: "fa-solid fa-layer-group",
      title: "Step 3 – We Build Trust With Content",
      desc: "Reels, posts, and videos that make people feel “I trust this brand”.",
    },
    {
      step: "04",
      icon: "fa-solid fa-filter",
      title: "Step 4 – We Send Them to a Funnel",
      desc: "Landing pages that convert traffic into booked calls.",
    },
    {
      step: "05",
      icon: "fa-solid fa-calendar-check",
      title: "Step 5 – You Get Appointments",
      desc: "You only talk to people who are ready.",
    },
  ];

  return (
    <section className="space-y-6 pt-4">
      <h2 className="text-2xl sm:text-3xl font-black text-center text-white tracking-wider uppercase">
        HOW IT WORKS
      </h2>

      <div className="space-y-4">
        {steps.map((s, idx) => (
          <div
            key={idx}
            className="dark-gold-card rounded-2xl p-5 space-y-2 relative overflow-hidden transition-all hover:border-amber-400"
          >
            <div className="absolute top-2 right-4 text-4xl font-black text-amber-500/10 select-none">
              {s.step}
            </div>
            <div className="text-amber-400 text-3xl font-bold mb-1">
              <i className={s.icon}></i>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white">
              {s.title}
            </h3>
            <p className="text-slate-300 text-sm sm:text-base font-medium">
              {s.desc}
            </p>
          </div>
        ))}
      </div>

      {/* CTA Gold Button Box */}
      <button
        onClick={onBookClick}
        className="w-full cta-gold-btn shimmer rounded-2xl p-4 sm:p-5 text-center text-slate-950 font-black hover:opacity-95 transition-all"
      >
        <div className="text-xl sm:text-2xl font-black uppercase tracking-wide">
          BOOK YOUR GROWTH SESSION
        </div>
        <div className="text-xs sm:text-sm font-semibold text-slate-900 mt-1">
          No sales pitch. Just a real roadmap for your business.
        </div>
      </button>
    </section>
  );
}
