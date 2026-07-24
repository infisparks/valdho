"use client";

import React from "react";

export function IndustriesSection() {
  const industries = [
    {
      title: "For Doctors & Clinics",
      img: "/firstoption/Doctors & Clinics.png",
      intro: "We bring:",
      points: [
        "Real patients seeking treatment",
        "High-ticket procedure inquiries",
        "Automated appointment booking & SMS reminders",
      ],
      badge: "⭐ 100+ to 10,000+ patient consults delivered for dermatologists, dental, and specialty clinics.",
    },
    {
      title: "For IT & Service Companies",
      img: "/firstoption/IT & Service Companies.png",
      intro: "We bring:",
      points: [
        "Decision-maker demo calls (CTOs, CEOs)",
        "Qualified software & agency inquiries",
        "Predictable recurring retainer clients",
      ],
      badge: "💻 Zero time-wasting leads. 100% pre-qualified decision maker meetings.",
    },
    {
      title: "For Manufacturers & Wholesalers",
      img: "/firstoption/Manufacturers & Wholesalers.png",
      intro: "We bring:",
      points: [
        "Verified bulk buyers & distributors",
        "Direct RFQ (Request for Quotation) leads",
        "High-ticket B2B contract pipeline",
      ],
      badge: "🏭 High-value industrial orders for ceramics, machinery, textiles, and building materials.",
    },
  ];

  return (
    <section className="space-y-6 pt-4">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-center text-white tracking-tight">
        Industries we have worked with
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {industries.map((ind, idx) => (
          <div
            key={idx}
            className="gold-border-card bg-white text-slate-900 rounded-3xl p-5 sm:p-6 text-center space-y-4 shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden aspect-[4/3] md:h-52 lg:h-60 w-full bg-slate-100 shadow-inner">
                <img
                  src={ind.img}
                  alt={ind.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-950">{ind.title}</h3>

              <div className="space-y-2 text-sm sm:text-base text-slate-800 font-bold">
                <p className="text-slate-600 font-medium">{ind.intro}</p>
                {ind.points.map((pt, pIdx) => (
                  <p key={pIdx} className="text-sm sm:text-base md:text-lg font-black text-slate-950">
                    {pt}
                  </p>
                ))}
              </div>
            </div>

            {/* Yellow Highlight Badge */}
            <div className="yellow-callout-badge p-3.5 rounded-xl text-center text-xs sm:text-sm tracking-wide leading-snug mt-2">
              {ind.badge}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
