"use client";

import React, { useState } from "react";

export function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "How fast can we expect results?",
      a: "Our revenue system starts generating qualified inquiries within 7 to 14 days of launch. Unlike traditional agencies that waste months on 'brand awareness', our focus is immediate appointments.",
    },
    {
      q: "How are you different from a typical digital marketing agency?",
      a: "Typical agencies deliver impressions, clicks, and unverified leads that never pick up the phone. First Option Agency builds an end-to-end Revenue System combining performance ads, trust content, qualification funnels, and automated CRM booking.",
    },
    {
      q: "What ad budget do I need to get started?",
      a: "We work with businesses starting at a minimum ad spend of ₹20,000 to ₹30,000 / month up to multi-lakh monthly scale. We optimize every single rupee spent to maximize ROI.",
    },
    {
      q: "Do you provide money-back or performance guarantees?",
      a: "Yes! During your 1-on-1 Growth Session, we set clear KPI milestones. If we don't hit the agreed appointment benchmark in month 1, we work for free until we do.",
    },
    {
      q: "Will this work for my specific industry?",
      a: "We have proven case studies across Healthcare (Doctors & Clinics), Industrial Manufacturing, B2B IT/Software, Retail Mobile Shops, Real Estate, and FMCG Food Brands.",
    },
  ];

  return (
    <section className="space-y-5 pt-4">
      <div className="text-center space-y-1">
        <span className="text-amber-400 font-extrabold text-xs tracking-widest uppercase bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
          Got Questions?
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-2">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className="dark-gold-card rounded-2xl overflow-hidden transition-colors"
            >
              <button
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full p-4.5 text-left flex items-center justify-between font-extrabold text-white text-sm sm:text-base focus:outline-none"
              >
                <span className="pr-2">{faq.q}</span>
                <span className={`text-amber-400 text-lg transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  <i className="fa-solid fa-chevron-down"></i>
                </span>
              </button>
              {isOpen && (
                <div className="px-4.5 pb-4 text-slate-300 text-xs sm:text-sm font-medium leading-relaxed border-t border-zinc-800/80 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
