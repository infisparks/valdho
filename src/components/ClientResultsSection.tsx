"use client";

import React, { useState } from "react";

interface ClientResultsSectionProps {
  onVideoClick: (title: string, author: string, embedId?: string) => void;
}

export function ClientResultsSection({ onVideoClick }: ClientResultsSectionProps) {
  const [crmFilter, setCrmFilter] = useState<string>("all");
  const [activeModalIndex, setActiveModalIndex] = useState<number | null>(null);

  const resultImages = [
    { src: "/firstoption/result/11.jpg.jpeg", title: "Live OPD Patient Bookings" },
    { src: "/firstoption/result/12.jpg.jpeg", title: "Verified Ad Account ROI" },
    { src: "/firstoption/result/13.jpg.jpeg", title: "High-Ticket Lead Pipeline" },
    { src: "/firstoption/result/14.jpg.jpeg", title: "WhatsApp Direct Inquiries" },
    { src: "/firstoption/result/15.jpg.jpeg", title: "Daily Appointment Calendar" },
    { src: "/firstoption/result/16.jpg.jpeg", title: "Retail Store Walk-in Logs" },
    { src: "/firstoption/result/17.jpg.jpeg", title: "Qualified Leads Dashboard" },
    { src: "/firstoption/result/18.jpg.jpeg", title: "Strategy Call Registrations" },
    { src: "/firstoption/result/19.jpg.jpeg", title: "Campaign Conversion Analytics" },
    { src: "/firstoption/result/110.jpg.jpeg", title: "Monthly Growth Metrics" },
    { src: "/firstoption/result/111.jpg.jpeg", title: "B2B Contract Inquiries" },
    { src: "/firstoption/result/112.jpg.jpeg", title: "Verified Client Testimonial Proof" },
  ];

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
    <section className="space-y-4 pt-1">
      {/* Section Header */}
      <div className="text-center space-y-1">
        <span className="text-[10px] sm:text-xs font-extrabold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-0.5 rounded-full border border-amber-500/30">
          Real Proof • Verified Case Studies
        </span>
        <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-center text-white tracking-tight pt-0.5">
          Our Client Results
        </h2>
      </div>

      {/* Video Case Study Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
        {videoCaseStudies.map((study, idx) => (
          <div
            key={idx}
            className="bg-zinc-950/90 border border-zinc-800/80 hover:border-amber-500/50 rounded-2xl p-2.5 sm:p-3 text-left space-y-2 shadow-lg flex flex-col justify-between transition-all duration-300 group"
          >
            <div className="space-y-1.5">
              {/* Header: Badge & Rating */}
              <div className="flex items-center justify-between gap-1">
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[8px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider truncate max-w-[65%]">
                  {study.badge}
                </span>
                <div className="flex text-amber-400 text-[8px] sm:text-[10px] space-x-0.5 flex-shrink-0">
                  {[...Array(study.stars)].map((_, sIdx) => (
                    <i key={sIdx} className="fa-solid fa-star"></i>
                  ))}
                </div>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight truncate leading-tight group-hover:text-amber-400 transition-colors">
                  {study.title}
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-400 truncate leading-tight">
                  {study.subtitle}
                </p>
              </div>

              {/* Sleek Compact Metric Pill */}
              {study.quote && (
                <div className="bg-emerald-500/10 border border-emerald-500/25 px-2 py-1 rounded-lg text-[9.5px] sm:text-xs font-bold text-emerald-400 leading-tight flex items-center space-x-1 truncate">
                  <i className="fa-solid fa-circle-check text-[9px] text-emerald-400 flex-shrink-0"></i>
                  <span className="truncate">{study.quote}</span>
                </div>
              )}
            </div>

            {/* Compact Video Thumbnail */}
            <div
              className="relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/90 mt-1 cursor-pointer group/vid"
              onClick={() => onVideoClick(study.videoTitle, "First Option Agency", study.embedId)}
            >
              <div className="relative aspect-video w-full bg-zinc-950 flex items-center justify-center">
                <img
                  src={`https://img.youtube.com/vi/${study.embedId}/hqdefault.jpg`}
                  alt={study.title}
                  className="w-full h-full object-cover opacity-80 group-hover/vid:opacity-100 group-hover/vid:scale-105 transition-all duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                {/* Sleek Centered Play Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg group-hover/vid:scale-110 transition-transform">
                    <i className="fa-solid fa-play text-[10px] sm:text-xs ml-0.5"></i>
                  </div>
                </div>

                {/* Video Title Chip */}
                <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[8px] sm:text-[9px] text-slate-300 font-medium">
                  <span className="truncate max-w-[75%] drop-shadow">{study.videoTitle}</span>
                  <span className="text-amber-400 font-bold drop-shadow">Watch</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Card 6: 12-Month Scaled Campaign & CRM Overview */}
        <div className="bg-zinc-950/90 border border-zinc-800/80 hover:border-blue-500/50 rounded-2xl p-2.5 sm:p-3 text-left space-y-2 shadow-lg flex flex-col justify-between transition-all duration-300 group">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                10k+ Leads
              </span>
              <div className="flex text-amber-400 text-[8px] sm:text-[10px] space-x-0.5">
                {[...Array(5)].map((_, sIdx) => (
                  <i key={sIdx} className="fa-solid fa-star"></i>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight truncate leading-tight group-hover:text-blue-400 transition-colors">
                1-Year Scaled Campaign
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate leading-tight">
                Unani Consultant
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/25 px-2 py-1 rounded-lg text-[9.5px] sm:text-xs font-bold text-blue-400 leading-tight flex items-center space-x-1 truncate">
              <i className="fa-solid fa-chart-line text-[9px] text-blue-400 flex-shrink-0"></i>
              <span className="truncate">10,482+ patient appointments</span>
            </div>
          </div>

          <div 
            className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 p-2 text-left cursor-pointer group/crm"
            onClick={() => onVideoClick("10k Patient Leads Campaign", "First Option Agency", "n1qrvNAMOp4")}
          >
            <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-emerald-400 font-mono font-bold mb-1">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                LIVE CRM
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded font-black">10,482</span>
            </div>
            <div className="text-[8px] sm:text-[9px] text-slate-300 font-mono space-y-0.5">
              <div className="flex justify-between text-slate-200">
                <span className="truncate">Shari Shukla</span>
                <span className="text-emerald-400 font-bold">Booked</span>
              </div>
              <div className="flex justify-between text-slate-200">
                <span className="truncate">Moi Kukreja</span>
                <span className="text-emerald-400 font-bold">Booked</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fanned Card Deck Results Presentation */}
      <div className="pt-2 space-y-2">
        <div className="text-center space-y-0.5">
          <div className="inline-flex items-center space-x-1.5 text-amber-400 font-extrabold text-[10px] sm:text-xs tracking-widest uppercase bg-amber-500/10 px-3 py-0.5 rounded-full border border-amber-500/30">
            <i className="fa-solid fa-layer-group text-[10px]"></i>
            <span>Verified Live Campaign Proof</span>
          </div>
          <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight">
            Real Client Campaign Results
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
            Click the card stack to view all 12 verified campaign result screenshots
          </p>
        </div>

        {/* Fanned Deck Interactive Trigger */}
        <div 
          onClick={() => setActiveModalIndex(0)}
          className="relative max-w-lg mx-auto h-44 sm:h-56 my-2 cursor-pointer group flex items-center justify-center"
        >
          <div className="relative w-36 sm:w-56 h-36 sm:h-52 flex items-center justify-center">
            {[
              resultImages[2], // 13.jpg.jpeg (-rotate-12)
              resultImages[1], // 12.jpg.jpeg (-rotate-6)
              resultImages[0], // 11.jpg.jpeg (rotate-0 FRONT CENTER)
              resultImages[3], // 14.jpg.jpeg (rotate-6)
              resultImages[4], // 15.jpg.jpeg (rotate-12)
            ].map((item, idx) => {
              const rotationClasses = [
                "-rotate-12 -translate-x-8 sm:-translate-x-14 translate-y-1 z-0",
                "-rotate-6 -translate-x-4 sm:-translate-x-7 translate-y-0.5 z-10",
                "rotate-0 translate-y-0 z-30 scale-105 shadow-[0_0_25px_rgba(245,166,35,0.4)] border-amber-400",
                "rotate-6 translate-x-4 sm:translate-x-7 translate-y-0.5 z-20",
                "rotate-12 translate-x-8 sm:translate-x-14 translate-y-1 z-0",
              ][idx];

              return (
                <div
                  key={idx}
                  className={`absolute inset-0 rounded-xl overflow-hidden border-2 shadow-[0_8px_20px_rgba(0,0,0,0.9)] bg-zinc-950 transition-all duration-300 group-hover:scale-105 ${
                    idx === 2 ? "border-amber-400 shadow-[0_0_25px_rgba(245,166,35,0.5)]" : "border-amber-500/60"
                  } ${rotationClasses}`}
                >
                  <img
                    src={item.src}
                    alt={item.title}
                    className="w-full h-full object-contain p-1 bg-zinc-950"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                </div>
              );
            })}

            {/* Glowing Callout Badge */}
            <div className="absolute z-40 -bottom-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 text-[10px] sm:text-xs font-black px-3 py-1.5 rounded-full shadow-[0_0_20px_rgba(245,166,35,0.6)] border border-amber-200 flex items-center space-x-1.5 group-hover:scale-105 transition-transform">
              <i className="fa-solid fa-images"></i>
              <span>Click to View 12 Live Results</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Lightbox Gallery Modal */}
      {activeModalIndex !== null && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between p-3 sm:p-6 animate-fade-in"
          onClick={() => setActiveModalIndex(null)}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between z-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center space-x-3">
              <div className="bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-extrabold px-3 py-1 rounded-full">
                {activeModalIndex + 1} / {resultImages.length}
              </div>
              <h4 className="text-white font-extrabold text-xs sm:text-base truncate max-w-[200px] sm:max-w-md">
                {resultImages[activeModalIndex].title}
              </h4>
            </div>

            <button
              onClick={() => setActiveModalIndex(null)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800 text-white hover:bg-amber-500 hover:text-slate-950 flex items-center justify-center text-lg font-bold transition-all shadow-lg border border-zinc-700"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Main Image Display (Uncropped, Adjusts Height/Width with Gold Border) */}
          <div className="relative flex-1 flex items-center justify-center my-2 sm:my-4" onClick={(e) => e.stopPropagation()}>
            {/* Prev Button */}
            <button
              onClick={() => setActiveModalIndex((prev) => (prev === null || prev === 0 ? resultImages.length - 1 : prev - 1))}
              className="absolute left-1 sm:left-4 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-zinc-900/90 text-amber-400 border border-amber-500/50 hover:bg-amber-500 hover:text-slate-950 flex items-center justify-center text-lg font-black transition-all shadow-xl backdrop-blur"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>

            <div className="max-h-[65vh] sm:max-h-[75vh] max-w-full rounded-2xl overflow-hidden border-2 border-amber-500/60 shadow-[0_0_35px_rgba(245,166,35,0.3)] bg-zinc-950 p-1 flex items-center justify-center">
              <img
                src={resultImages[activeModalIndex].src}
                alt={resultImages[activeModalIndex].title}
                className="max-h-[63vh] sm:max-h-[73vh] w-auto max-w-full object-contain rounded-xl"
              />
            </div>

            {/* Next Button */}
            <button
              onClick={() => setActiveModalIndex((prev) => (prev === null || prev === resultImages.length - 1 ? 0 : prev + 1))}
              className="absolute right-1 sm:right-4 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-zinc-900/90 text-amber-400 border border-amber-500/50 hover:bg-amber-500 hover:text-slate-950 flex items-center justify-center text-lg font-black transition-all shadow-xl backdrop-blur"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>

          {/* Bottom Thumbnail Strip */}
          <div 
            className="flex items-center space-x-2 overflow-x-auto py-2 px-1 max-w-4xl mx-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {resultImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveModalIndex(idx)}
                className={`relative flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all ${
                  activeModalIndex === idx
                    ? "border-amber-400 scale-105 shadow-[0_0_15px_rgba(245,166,35,0.6)] bg-zinc-900 opacity-100"
                    : "border-zinc-800 opacity-60 hover:opacity-100 bg-zinc-950"
                }`}
              >
                <img src={img.src} alt={img.title} className="w-full h-full object-contain p-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
