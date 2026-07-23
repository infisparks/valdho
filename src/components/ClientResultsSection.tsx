"use client";

import React, { useState } from "react";

interface ClientResultsSectionProps {
  onVideoClick: (title: string, author: string, embedId?: string) => void;
}

export function ClientResultsSection({ onVideoClick }: ClientResultsSectionProps) {
  const [crmFilter, setCrmFilter] = useState<string>("all");

  const videoCaseStudies = [
    {
      title: "Dr-Sajid-Firdousi",
      subtitle: "Unani and Herbal Consultant",
      stars: 5,
      quote: "100+ patient consults in 1 month for skin problem.",
      videoTitle: "Dr-Sajid-Sir-Results",
      embedId: "n1qrvNAMOp4",
      badge: "Healthcare",
    },
    {
      title: "Wao Mobile",
      subtitle: "Mobile and computer shop",
      stars: 5,
      quote: "45+ daily store walk-ins & mobile inquiries.",
      videoTitle: "Wao Mobile Results",
      embedId: "NI1QXg4GuvM",
      badge: "Retail",
    },
    {
      title: "Aman Samosa",
      subtitle: "Food Brand",
      stars: 5,
      quote: "Scaled local outlet into regional food brand.",
      videoTitle: "Aman Samosa Case Study",
      embedId: "0U8D8ahfZe0",
      badge: "Food Brand",
    },
    {
      title: "Prince ceramic & Building Material",
      subtitle: "(Owner)",
      stars: 5,
      quote: "Consistent high-ticket B2B building material orders.",
      videoTitle: "Prince Ceramic Case Study",
      embedId: "keW6PQ5CzCY",
      badge: "Industrial B2B",
    },
    {
      title: "Model Town",
      subtitle: "(Clothing Brand)",
      stars: 5,
      quote: "High-converting sales pipeline for apparel line.",
      videoTitle: "Model Town Case Study",
      embedId: "gEGqh-N1IK0",
      badge: "Fashion Retail",
    },
  ];

  // Exactly 5 Appointment Proof Cards
  const appointmentProofCards = [
    {
      title: "Skin clinic OPD",
      subtitle: "Paid Appointments",
      imgPlaceholder: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=600&q=80",
      tag: "Live OPD Calendar",
    },
    {
      title: "Clinic Results",
      subtitle: "Ayurvedic Clinic Results",
      imgPlaceholder: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80",
      tag: "23,450 Visitors • 1,833 Leads",
    },
    {
      title: "April-2026",
      subtitle: "High Quality Appointments",
      imgPlaceholder: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80",
      tag: "Verified 37 Total Bookings",
    },
    {
      title: "March-2026",
      subtitle: "High Quality Appointments",
      imgPlaceholder: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80",
      tag: "Verified Monthly Appointments",
    },
    {
      title: "Feb-2026",
      subtitle: "High Quality Appointments",
      imgPlaceholder: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80",
      tag: "Verified CRM Lead Logs",
    },
  ];

  const liveLeads = [
    { name: "Shari Shukla", condition: "Skin Consult", status: "Booked", date: "Feb 18, 2026", city: "Delhi" },
    { name: "Moi Kukreja", condition: "Dermatology", status: "Booked", date: "Feb 18, 2026", city: "Mumbai" },
    { name: "Rahul P", condition: "Skin Consult", status: "Booked", date: "Feb 17, 2026", city: "Bangalore" },
    { name: "Ananya Sharma", condition: "Acne Treatment", status: "Completed", date: "Feb 17, 2026", city: "Pune" },
    { name: "Vikram Singh", condition: "Psoriasis Consult", status: "Booked", date: "Feb 16, 2026", city: "Jaipur" },
  ];

  const filteredLeads = crmFilter === "all" 
    ? liveLeads 
    : liveLeads.filter(l => l.status.toLowerCase() === crmFilter.toLowerCase());

  return (
    <section className="space-y-5 pt-1">
      <div className="text-center space-y-1">
        <span className="text-xs font-extrabold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3.5 py-1 rounded-full border border-amber-500/30">
          Real Proof • Verified Case Studies
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center text-white tracking-tight pt-1">
          Our Client Results
        </h2>
      </div>

      {/* Video Case Study Cards Grid: 2 cards per row on mobile (grid-cols-2), 3 cards on desktop (md:grid-cols-3) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3.5">
        {videoCaseStudies.map((study, idx) => (
          <div
            key={idx}
            className="gold-border-card bg-white text-slate-900 rounded-2xl p-2 sm:p-3.5 text-center space-y-1.5 shadow-md flex flex-col justify-between"
          >
            <div className="space-y-1">
              <span className="inline-block bg-amber-100 text-amber-900 text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                {study.badge}
              </span>
              
              <h3 className="text-xs sm:text-base font-black tracking-tight text-slate-950 truncate leading-snug">
                {study.title}
              </h3>
              
              <p className="text-[9px] sm:text-xs font-bold text-slate-600 truncate">
                {study.subtitle}
              </p>

              {/* 5 Stars */}
              <div className="flex justify-center items-center space-x-0.5 text-amber-400 text-[10px] sm:text-xs">
                {[...Array(study.stars)].map((_, sIdx) => (
                  <i key={sIdx} className="fa-solid fa-star"></i>
                ))}
              </div>

              {study.quote && (
                <div className="bg-amber-50/90 p-1.5 rounded-lg border border-amber-200/80 text-[9px] sm:text-xs font-extrabold text-slate-900 leading-snug">
                  &quot;{study.quote}&quot;
                </div>
              )}
            </div>

            {/* Compact Video Card Thumbnail */}
            <div
              className="relative rounded-lg overflow-hidden bg-slate-900 border border-slate-200 mt-1 cursor-pointer group"
              onClick={() => onVideoClick(study.videoTitle, "First Option Agency", study.embedId)}
            >
              <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center">
                <img
                  src={`https://img.youtube.com/vi/${study.embedId}/hqdefault.jpg`}
                  alt={study.title}
                  className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                />

                {/* Overlay Title */}
                <div className="absolute top-0 left-0 right-0 p-1 bg-gradient-to-b from-black/80 to-transparent flex items-center space-x-1 text-left">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-purple-700 flex items-center justify-center font-bold text-white text-[8px] flex-shrink-0">
                    F
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-white font-bold text-[8px] sm:text-[10px] leading-tight truncate">
                      {study.videoTitle}
                    </p>
                  </div>
                </div>

                {/* Play Button Icon */}
                <div className="relative z-10 w-8 h-5 sm:w-10 sm:h-7 bg-red-600 rounded flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <div className="w-0 h-0 border-y-[3px] sm:border-y-[5px] border-y-transparent border-l-[7px] sm:border-l-[10px] border-l-white ml-0.5"></div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Card 6: 12-Month Scaled Campaign & CRM Overview */}
        <div className="gold-border-card bg-white text-slate-900 rounded-2xl p-2 sm:p-3.5 text-center space-y-1.5 shadow-md flex flex-col justify-between">
          <div className="space-y-1">
            <span className="inline-block bg-blue-100 text-blue-900 text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              10k+ Leads
            </span>
            
            <h3 className="text-xs sm:text-base font-black tracking-tight text-slate-950 truncate leading-snug">
              1-Year Scaled Campaign
            </h3>
            
            <p className="text-[9px] sm:text-xs font-bold text-slate-600 truncate">
              Unani Consultant
            </p>

            <div className="flex justify-center items-center space-x-0.5 text-amber-400 text-[10px] sm:text-xs">
              {[...Array(5)].map((_, sIdx) => (
                <i key={sIdx} className="fa-solid fa-star"></i>
              ))}
            </div>

            <div className="bg-blue-50/90 p-1.5 rounded-lg border border-blue-200/80 text-[9px] sm:text-xs font-extrabold text-slate-900 leading-snug">
              &quot;10,482+ patient appointments generated in 1 year.&quot;
            </div>
          </div>

          <div 
            className="rounded-lg overflow-hidden border border-slate-300 bg-slate-900 mt-1 p-1.5 text-left cursor-pointer group"
            onClick={() => onVideoClick("10k Patient Leads Campaign", "First Option Agency", "n1qrvNAMOp4")}
          >
            <div className="flex items-center justify-between text-[8px] sm:text-[10px] text-emerald-400 font-mono font-bold mb-0.5">
              <span>LIVE CRM</span>
              <span className="bg-emerald-600 text-white text-[7px] sm:text-[9px] px-1 rounded font-black">10,482</span>
            </div>
            <div className="text-[8px] text-slate-300 font-mono space-y-0.5">
              <div className="flex justify-between text-white font-bold">
                <span className="truncate">Shari Shukla</span>
                <span className="text-emerald-400">Booked</span>
              </div>
              <div className="flex justify-between text-white font-bold">
                <span className="truncate">Moi Kukreja</span>
                <span className="text-emerald-400">Booked</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Proof & Dashboard Calendar Screenshots Grid (5 cards: 5th card spans 2 cols on mobile for balanced layout) */}
      <div className="pt-3 space-y-2.5">
        <div className="text-center">
          <h3 className="text-lg sm:text-xl font-black text-white">
            Appointment Calendars & Live Dashboard Results
          </h3>
          <p className="text-[11px] text-slate-400">Verified 5-campaign appointment reporting</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3.5">
          {appointmentProofCards.map((proof, pIdx) => (
            <div
              key={pIdx}
              className={`dark-gold-card rounded-2xl p-2 sm:p-3 text-center space-y-1.5 border border-amber-500/30 hover:border-amber-400 transition-colors shadow-md ${
                pIdx === 4 ? "col-span-2 md:col-span-1 max-w-xs sm:max-w-none justify-self-center w-full" : ""
              }`}
            >
              <h4 className="text-xs sm:text-sm font-black text-white truncate">
                {proof.title}
              </h4>
              <p className="text-[9px] sm:text-xs text-amber-400 font-semibold truncate">
                {proof.subtitle}
              </p>

              <div className="rounded-lg overflow-hidden aspect-[4/3] w-full bg-slate-900 border border-zinc-800 shadow-inner group">
                <img
                  src={proof.imgPlaceholder}
                  alt={proof.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>

              <div className="bg-black/60 border border-zinc-800 rounded p-1 text-[8px] sm:text-[10px] font-mono text-emerald-400 font-bold truncate">
                ✓ {proof.tag}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
