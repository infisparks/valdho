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
      quote: "In a Single Month we have generated More than 100 patients appointment for Skin Problem Only",
      videoTitle: "Dr-Sajid-Sir-Results",
      embedId: "n1qrvNAMOp4",
      badge: "Healthcare",
    },
    {
      title: "Wao Mobile",
      subtitle: "Mobile and computer shop",
      stars: 5,
      quote: "Generated 45+ direct store walk-ins and high-value mobile inquiries daily.",
      videoTitle: "Wao Mobile Results",
      embedId: "NI1QXg4GuvM",
      badge: "Retail",
    },
    {
      title: "Aman Samosa",
      subtitle: "Food Brand",
      stars: 5,
      quote: "Scaled local food outlet into regional brand with viral customer foot-traffic.",
      videoTitle: "Aman Samosa Case Study",
      embedId: "0U8D8ahfZe0",
      badge: "Food Brand",
    },
    {
      title: "Prince ceramic & Building Material",
      subtitle: "(Owner)",
      stars: 5,
      quote: "Generated consistent high-ticket B2B inquiries for tiles & building materials.",
      videoTitle: "Prince Ceramic Case Study",
      embedId: "keW6PQ5CzCY",
      badge: "Industrial B2B",
    },
    {
      title: "Model Town",
      subtitle: "(Clothing Brand)",
      stars: 5,
      quote: "Transformed seasonal apparel collections into high-converting sales pipeline.",
      videoTitle: "Model Town Case Study",
      embedId: "gEGqh-N1IK0",
      badge: "Fashion Retail",
    },
  ];

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
    <section className="space-y-6 pt-2">
      <div className="text-center space-y-1">
        <span className="text-xs font-extrabold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3.5 py-1 rounded-full border border-amber-500/30">
          Real Proof • Verified Case Studies
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center text-white tracking-tight pt-2">
          Our Client Results
        </h2>
      </div>

      {/* Video Case Study Cards Grid: 2 cards in 1 row on mobile (grid-cols-2), 3 cards on desktop (md:grid-cols-3) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
        {videoCaseStudies.map((study, idx) => (
          <div
            key={idx}
            className="gold-border-card bg-white text-slate-900 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 text-center space-y-2 shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-1.5">
              <span className="inline-block bg-amber-100 text-amber-900 text-[9px] sm:text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                {study.badge}
              </span>
              
              <h3 className="text-sm sm:text-lg md:text-xl font-black tracking-tight text-slate-950 truncate">
                {study.title}
              </h3>
              
              <p className="text-[10px] sm:text-xs font-bold text-slate-600 truncate">
                {study.subtitle}
              </p>

              {/* 5 Stars */}
              <div className="flex justify-center items-center space-x-0.5 text-amber-400 text-xs sm:text-sm">
                {[...Array(study.stars)].map((_, sIdx) => (
                  <i key={sIdx} className="fa-solid fa-star"></i>
                ))}
              </div>

              {study.quote && (
                <div className="bg-amber-50 p-2 rounded-xl border border-amber-200/80 text-[10px] sm:text-xs font-extrabold text-slate-900 line-clamp-3">
                  &quot;{study.quote}&quot;
                </div>
              )}
            </div>

            {/* Video Card Thumbnail */}
            <div
              className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200 mt-2 cursor-pointer group"
              onClick={() => onVideoClick(study.videoTitle, "First Option Agency", study.embedId)}
            >
              <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center">
                <img
                  src={`https://img.youtube.com/vi/${study.embedId}/hqdefault.jpg`}
                  alt={study.title}
                  className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                />

                {/* Overlay Title */}
                <div className="absolute top-0 left-0 right-0 p-1.5 sm:p-2 bg-gradient-to-b from-black/80 to-transparent flex items-center space-x-1.5 text-left">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-700 flex items-center justify-center font-bold text-white text-[9px] sm:text-xs flex-shrink-0">
                    F
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-white font-bold text-[10px] sm:text-xs leading-tight truncate">
                      {study.videoTitle}
                    </p>
                    <p className="text-zinc-300 text-[8px] sm:text-[10px] truncate">First Option Agency</p>
                  </div>
                </div>

                {/* Play Button Icon */}
                <div className="relative z-10 w-9 h-6 sm:w-11 sm:h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <div className="w-0 h-0 border-y-[4px] sm:border-y-[6px] border-y-transparent border-l-[8px] sm:border-l-[11px] border-l-white ml-0.5"></div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Card 6: 12-Month Scaled Campaign & CRM Overview */}
        <div className="gold-border-card bg-white text-slate-900 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 text-center space-y-2 shadow-lg flex flex-col justify-between">
          <div className="space-y-1.5">
            <span className="inline-block bg-blue-100 text-blue-900 text-[9px] sm:text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              10k+ Patient Leads
            </span>
            
            <h3 className="text-sm sm:text-lg md:text-xl font-black tracking-tight text-slate-950 truncate">
              1-Year Scaled Campaign
            </h3>
            
            <p className="text-[10px] sm:text-xs font-bold text-slate-600 truncate">
              Unani and Herbal Consultant
            </p>

            <div className="flex justify-center items-center space-x-0.5 text-amber-400 text-xs sm:text-sm">
              {[...Array(5)].map((_, sIdx) => (
                <i key={sIdx} className="fa-solid fa-star"></i>
              ))}
            </div>

            <div className="bg-blue-50 p-2 rounded-xl border border-blue-200/80 text-[10px] sm:text-xs font-extrabold text-slate-900 line-clamp-3">
              &quot;In 1 year we generated 10,482+ patient appointments for skin treatment.&quot;
            </div>
          </div>

          <div 
            className="rounded-xl overflow-hidden border border-slate-300 bg-slate-900 mt-2 p-2 text-left cursor-pointer group"
            onClick={() => onVideoClick("10k Patient Leads Campaign", "First Option Agency", "n1qrvNAMOp4")}
          >
            <div className="flex items-center justify-between text-[9px] sm:text-xs text-emerald-400 font-mono font-bold mb-1">
              <span>LIVE CRM FEED</span>
              <span className="bg-emerald-600 text-white text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded font-black">10,482 LEADS</span>
            </div>
            <div className="text-[9px] text-slate-300 font-mono space-y-1">
              <div className="flex justify-between border-b border-slate-800 pb-0.5 text-slate-500 font-sans font-bold">
                <span>Patient</span>
                <span>Status</span>
              </div>
              <div className="flex justify-between items-center text-white">
                <span className="truncate">Shari Shukla</span>
                <span className="text-emerald-400 font-bold">Booked</span>
              </div>
              <div className="flex justify-between items-center text-white">
                <span className="truncate">Moi Kukreja</span>
                <span className="text-emerald-400 font-bold">Booked</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Proof & Dashboard Calendar Screenshots Grid (2 cards per row on mobile) */}
      <div className="pt-4 space-y-3">
        <div className="text-center">
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Appointment Calendars & Live Dashboard Results
          </h3>
          <p className="text-xs text-slate-400">Verified appointment schedules and CRM reporting</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
          {appointmentProofCards.map((proof, pIdx) => (
            <div
              key={pIdx}
              className="dark-gold-card rounded-2xl p-2.5 sm:p-4 text-center space-y-2 border border-amber-500/30 hover:border-amber-400 transition-colors shadow-lg"
            >
              <h4 className="text-xs sm:text-base font-black text-white truncate">
                {proof.title}
              </h4>
              <p className="text-[10px] sm:text-xs text-amber-400 font-semibold truncate">
                {proof.subtitle}
              </p>

              <div className="rounded-xl overflow-hidden aspect-[4/3] w-full bg-slate-900 border border-zinc-800 shadow-inner group">
                <img
                  src={proof.imgPlaceholder}
                  alt={proof.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>

              <div className="bg-black/60 border border-zinc-800 rounded-lg p-1.5 text-[9px] sm:text-xs font-mono text-emerald-400 font-bold">
                ✓ {proof.tag}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
