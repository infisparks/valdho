"use client";

import React from "react";

export function IndustriesSection() {
  const industries = [
    {
      title: "For Doctors & Clinics",
      img: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
      intro: "We bring:",
      points: [
        "Real patients seeking treatment",
        "High-ticket procedure inquiries",
        "Automated appointment booking & SMS reminders",
      ],
      badge: "⭐ 100+ to 10,000+ patient consults delivered for dermatologists, dental, and specialty clinics.",
    },
    {
      title: "For Manufacturers & Industrial B2B",
      img: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80",
      intro: "We bring:",
      points: [
        "Verified bulk buyers & distributors",
        "Direct RFQ (Request for Quotation) leads",
        "High-ticket B2B contract pipeline",
      ],
      badge: "🏭 High-value industrial orders for ceramics, machinery, textiles, and building materials.",
    },
    {
      title: "For IT Companies & B2B Services",
      img: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
      intro: "We bring:",
      points: [
        "Decision-maker demo calls (CTOs, CEOs)",
        "Qualified software & agency inquiries",
        "Predictable recurring retainer clients",
      ],
      badge: "💻 Zero time-wasting leads. 100% pre-qualified decision maker meetings.",
    },
    {
      title: "For Retail, Mobile & Tech Stores",
      img: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80",
      intro: "We bring:",
      points: [
        "Foot traffic to your physical store",
        "Direct WhatsApp buyers asking for pricing",
        "High margin product sale campaigns",
      ],
      badge: "📱 Proven retail store foot-traffic campaigns with instant WhatsApp inquiries.",
    },
    {
      title: "For Real Estate & Interior Designers",
      img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
      intro: "We bring:",
      points: [
        "Verified home buyers looking for site visits",
        "High net worth interior design clients",
        "Automated qualification funnels",
      ],
      badge: "🏠 Direct site-visit bookings for premium residential & commercial projects.",
    },
    {
      title: "For Food Brands & FMCG",
      img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
      intro: "We bring:",
      points: [
        "Franchise inquiries & bulk distributors",
        "Mass consumer brand awareness & order spikes",
        "Local store walk-ins & viral social proof",
      ],
      badge: "🍔 Scaled local food brands into regional franchise powerhouses.",
    },
  ];

  return (
    <section className="space-y-6 pt-4">
      <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-white tracking-tight">
        Industries we have worked with
      </h2>

      <div className="space-y-6">
        {industries.map((ind, idx) => (
          <div
            key={idx}
            className="gold-border-card bg-white text-slate-900 rounded-3xl p-4 sm:p-6 text-center space-y-4 shadow-xl"
          >
            <div className="rounded-2xl overflow-hidden aspect-[4/3] w-full bg-slate-100 shadow-inner">
              <img
                src={ind.img}
                alt={ind.title}
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-2xl font-black text-slate-950">{ind.title}</h3>

            <div className="space-y-2 text-base text-slate-800 font-bold">
              <p className="text-slate-600 font-medium">{ind.intro}</p>
              {ind.points.map((pt, pIdx) => (
                <p key={pIdx} className="text-base sm:text-lg font-black text-slate-950">
                  {pt}
                </p>
              ))}
            </div>

            {/* Yellow Highlight Badge */}
            <div className="yellow-callout-badge p-3 rounded-xl text-center text-xs sm:text-sm tracking-wide leading-snug">
              {ind.badge}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
