"use client";

import React, { useState } from "react";

interface ClientResultsSectionProps {
  onVideoClick: (title: string, author: string, embedId?: string) => void;
}

export function ClientResultsSection({ onVideoClick }: ClientResultsSectionProps) {
  const [crmFilter, setCrmFilter] = useState<string>("all");

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
        <span className="text-xs font-extrabold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
          Real Proof • Real Screenshots
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-center text-white tracking-tight pt-2">
          Our Client Results
        </h2>
      </div>

      {/* Result Card 1: Dr. Sajid Firdousi (Single Month) */}
      <div className="gold-border-card bg-white text-slate-900 rounded-3xl p-5 text-center space-y-3 shadow-xl">
        <div className="inline-block bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mb-1">
          Verified Healthcare Result
        </div>
        <h3 className="text-2xl font-black tracking-tight text-slate-950">Dr-Sajid-Firdousi</h3>
        <p className="text-base font-bold text-slate-700">Unani and Herbal Consultant</p>

        {/* 5 Stars */}
        <div className="flex justify-center items-center space-x-1 text-amber-400 text-xl">
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
        </div>

        <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
          <p className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
            &quot;In a Single Month we have generated More than 100 patients appointment for Skin Problem Only&quot;
          </p>
        </div>

        {/* Video Card Mockup */}
        <div
          className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 mt-3 cursor-pointer group"
          onClick={() => onVideoClick("Dr-Sajid-Sir-Results", "First Option Agency")}
        >
          <div className="relative aspect-[4/3] w-full bg-slate-900 flex items-center justify-center">
            <img
              src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=80"
              alt="Dr Sajid Results"
              className="w-full h-full object-cover opacity-75 group-hover:opacity-90 transition-opacity"
            />
            <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center space-x-2 text-left">
              <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center font-bold text-white text-sm">
                F
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Dr-Sajid-Sir-Results</p>
                <p className="text-zinc-300 text-xs">First Option Agency</p>
              </div>
            </div>
            <div className="relative z-10 w-14 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[11px] border-l-white ml-0.5"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Result Card 2: Dr. Sajid Firdousi (1 Year Case & CRM Screenshot) */}
      <div className="gold-border-card bg-white text-slate-900 rounded-3xl p-5 text-center space-y-3 shadow-xl">
        <div className="inline-block bg-blue-100 text-blue-900 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mb-1">
          12-Month Scaled Campaign
        </div>
        <h3 className="text-xl font-black text-slate-950">Unani and Herbal Consultant</h3>

        {/* 5 Stars */}
        <div className="flex justify-center items-center space-x-1 text-amber-400 text-xl">
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
        </div>

        <div className="bg-blue-50 p-3.5 rounded-2xl border border-blue-200">
          <p className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
            &quot;In 1 year we have generated More than 10 k patients appointment for Skin Problem Only&quot;
          </p>
        </div>

        {/* CRM Mockup / Leads Table Screenshot */}
        <div className="rounded-2xl overflow-hidden border border-slate-300 bg-slate-900 mt-3 text-left shadow-lg">
          <div className="bg-slate-800 p-2.5 border-b border-slate-700 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
              <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></span>
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
              <span className="font-mono text-slate-200 font-bold ml-1">CRM Live Lead Feed</span>
            </div>
            <div className="flex items-center space-x-2">
              <select 
                value={crmFilter}
                onChange={(e) => setCrmFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-[10px] text-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-amber-400"
              >
                <option value="all">All Leads</option>
                <option value="booked">Booked Only</option>
                <option value="completed">Completed</option>
              </select>
              <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded font-black tracking-wide">
                10,482 LEADS
              </span>
            </div>
          </div>
          <div className="p-3 bg-[#0d1117] text-slate-200 text-xs font-mono space-y-2.5 overflow-x-auto">
            <div className="grid grid-cols-4 min-w-[340px] border-b border-slate-800 pb-1.5 text-slate-400 font-sans font-bold text-[11px]">
              <span>Patient Name</span>
              <span>Condition</span>
              <span>Status</span>
              <span className="text-right">Date</span>
            </div>
            {filteredLeads.map((lead, idx) => (
              <div key={idx} className="grid grid-cols-4 min-w-[340px] items-center py-1 border-b border-slate-800/60">
                <span className="text-white font-bold truncate">{lead.name}</span>
                <span className="text-amber-400 truncate">{lead.condition}</span>
                <span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    lead.status === "Booked" ? "bg-emerald-900/80 text-emerald-300" : "bg-blue-900/80 text-blue-300"
                  }`}>
                    {lead.status}
                  </span>
                </span>
                <span className="text-slate-400 text-right text-[11px]">{lead.date}</span>
              </div>
            ))}
            <div className="text-center pt-2 text-slate-400 text-[11px] font-sans italic">
              ✓ Verified 10,482 patient appointments delivered directly to CRM.
            </div>
          </div>
        </div>
      </div>

      {/* Result Card 3: Wao Mobile */}
      <div className="gold-border-card bg-white text-slate-900 rounded-3xl p-5 text-center space-y-3 shadow-xl">
        <h3 className="text-2xl font-black tracking-tight text-slate-950">Wao Mobile</h3>
        <p className="text-base font-bold text-slate-700">Mobile and computer shop</p>

        <div className="flex justify-center items-center space-x-1 text-amber-400 text-xl">
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
        </div>

        <div
          className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 mt-2 cursor-pointer group"
          onClick={() => onVideoClick("Wao Mobile Case Study", "First Option Agency")}
        >
          <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center">
            <img
              src="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80"
              alt="Wao Mobile"
              className="w-full h-full object-cover opacity-75 group-hover:opacity-90 transition-opacity"
            />
            <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center space-x-2 text-left">
              <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center font-bold text-white text-sm">
                F
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Wao Mobile</p>
                <p className="text-zinc-300 text-xs">First Option Agency</p>
              </div>
            </div>
            <div className="relative z-10 w-14 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[11px] border-l-white ml-0.5"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Result Card 4: Aman Samosa */}
      <div className="gold-border-card bg-white text-slate-900 rounded-3xl p-5 text-center space-y-3 shadow-xl">
        <h3 className="text-2xl font-black tracking-tight text-slate-950">Aman Samosa</h3>
        <p className="text-base font-bold text-slate-700">Food Brand</p>

        <div className="flex justify-center items-center space-x-1 text-amber-400 text-xl">
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
        </div>

        <div
          className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 mt-2 cursor-pointer group"
          onClick={() => onVideoClick("Aman Samosa Case Study", "First Option Agency")}
        >
          <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center">
            <img
              src="https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80"
              alt="Aman Samosa"
              className="w-full h-full object-cover opacity-75 group-hover:opacity-90 transition-opacity"
            />
            <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center space-x-2 text-left">
              <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center font-bold text-white text-sm">
                F
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Aman Samosa</p>
                <p className="text-zinc-300 text-xs">First Option Agency</p>
              </div>
            </div>
            <div className="relative z-10 w-14 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[11px] border-l-white ml-0.5"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Result Card 5: Prince Ceramic */}
      <div className="gold-border-card bg-white text-slate-900 rounded-3xl p-5 text-center space-y-3 shadow-xl">
        <h3 className="text-xl font-black tracking-tight text-slate-950">Prince ceramic and Building Material</h3>
        <p className="text-base font-bold text-slate-700">(Owner)</p>

        <div className="flex justify-center items-center space-x-1 text-amber-400 text-xl">
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
          <i className="fa-solid fa-star"></i>
        </div>

        <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-slate-900 text-sm font-extrabold">
          &quot;Generated consistent high-ticket B2B inquiries for tiles, sanitation and wholesale cement orders across 3 regions.&quot;
        </div>
      </div>
    </section>
  );
}
