"use client";

import React, { useState } from "react";

interface GrowthCalculatorProps {
  onBookClick: () => void;
}

export function GrowthCalculator({ onBookClick }: GrowthCalculatorProps) {
  const [industry, setIndustry] = useState<"clinic" | "manufacturing" | "it" | "retail">("clinic");
  const [budget, setBudget] = useState<number>(30000);

  // Growth formulas based on industry multiplier
  const getMultipliers = () => {
    switch (industry) {
      case "clinic":
        return { apptRatio: 0.0035, revMultiplier: 12, label: "Patients / Consults" };
      case "manufacturing":
        return { apptRatio: 0.0012, revMultiplier: 25, label: "B2B Buyer Meetings" };
      case "it":
        return { apptRatio: 0.0015, revMultiplier: 18, label: "Qualified Demos" };
      case "retail":
        return { apptRatio: 0.005, revMultiplier: 8, label: "Store Visits & Orders" };
      default:
        return { apptRatio: 0.003, revMultiplier: 10, label: "Appointments" };
    }
  };

  const { apptRatio, revMultiplier, label } = getMultipliers();
  const minAppts = Math.round((budget * apptRatio) * 0.8);
  const maxAppts = Math.round((budget * apptRatio) * 1.2);

  const minRevInLakhs = ((budget * revMultiplier * 0.8) / 100000).toFixed(1);
  const maxRevInLakhs = ((budget * revMultiplier * 1.2) / 100000).toFixed(1);

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString('en-IN')} / mo`;
  };

  return (
    <section className="relative rounded-3xl p-4 sm:p-7 text-center space-y-4 shadow-[0_0_50px_rgba(245,166,35,0.12)] border border-amber-500/30 bg-gradient-to-b from-zinc-950 via-[#0d0e14] to-zinc-950 overflow-hidden my-3">
      {/* Background Subtle Radial Glow */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none" />

      {/* Top Header Badge */}
      <div className="inline-flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full text-amber-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
        <i className="fa-solid fa-calculator text-[10px]"></i>
        <span>Interactive Revenue Calculator</span>
      </div>

      <div className="space-y-1 max-w-xl mx-auto">
        <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight">
          Estimate Your Monthly Appointment Potential
        </h3>
        <p className="text-[11px] sm:text-xs text-slate-400 font-medium leading-relaxed">
          Select your industry & budget to calculate expected output:
        </p>
      </div>

      <div className="space-y-4 max-w-2xl mx-auto text-left">
        {/* Industry Select */}
        <div>
          <label className="block text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
            Select Your Business Category:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold">
            <button
              onClick={() => setIndustry("clinic")}
              className={`px-2.5 py-2 rounded-xl text-center border font-bold transition-all text-[11px] sm:text-xs flex items-center justify-center space-x-1.5 ${
                industry === "clinic"
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-[1.02]"
                  : "bg-zinc-900/90 text-slate-300 border-zinc-800 hover:bg-zinc-800"
              }`}
            >
              <span>👨‍⚕️</span>
              <span className="truncate">Clinic / Doctor</span>
            </button>

            <button
              onClick={() => setIndustry("manufacturing")}
              className={`px-2.5 py-2 rounded-xl text-center border font-bold transition-all text-[11px] sm:text-xs flex items-center justify-center space-x-1.5 ${
                industry === "manufacturing"
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-[1.02]"
                  : "bg-zinc-900/90 text-slate-300 border-zinc-800 hover:bg-zinc-800"
              }`}
            >
              <span>🏭</span>
              <span className="truncate">Manufacturer</span>
            </button>

            <button
              onClick={() => setIndustry("it")}
              className={`px-2.5 py-2 rounded-xl text-center border font-bold transition-all text-[11px] sm:text-xs flex items-center justify-center space-x-1.5 ${
                industry === "it"
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-[1.02]"
                  : "bg-zinc-900/90 text-slate-300 border-zinc-800 hover:bg-zinc-800"
              }`}
            >
              <span>💻</span>
              <span className="truncate">IT / B2B Agency</span>
            </button>

            <button
              onClick={() => setIndustry("retail")}
              className={`px-2.5 py-2 rounded-xl text-center border font-bold transition-all text-[11px] sm:text-xs flex items-center justify-center space-x-1.5 ${
                industry === "retail"
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-[1.02]"
                  : "bg-zinc-900/90 text-slate-300 border-zinc-800 hover:bg-zinc-800"
              }`}
            >
              <span>🏪</span>
              <span className="truncate">Retail / Store</span>
            </button>
          </div>
        </div>

        {/* Budget Range Slider */}
        <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-3 sm:p-4 space-y-2">
          <div className="flex justify-between items-center text-xs sm:text-sm font-extrabold text-slate-300">
            <span className="text-[11px] sm:text-xs">Monthly Marketing Budget:</span>
            <span className="text-amber-400 font-black text-xs sm:text-sm bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
              {formatCurrency(budget)}
            </span>
          </div>
          <input
            type="range"
            min="15000"
            max="150000"
            step="5000"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full accent-amber-500 h-2 bg-zinc-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>₹15k/mo</span>
            <span>₹75k/mo</span>
            <span>₹1.5L/mo</span>
          </div>
        </div>

        {/* Calculator Output Box */}
        <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-3 sm:p-4 text-center grid grid-cols-2 gap-2 sm:gap-3 shadow-inner">
          <div className="border-r border-zinc-800/90 pr-1.5 sm:pr-3 flex flex-col justify-center">
            <div className="text-[10px] sm:text-xs text-slate-400 font-medium truncate mb-0.5">
              Est. {label}
            </div>
            <div className="text-lg min-[360px]:text-xl sm:text-3xl font-black text-amber-400 tracking-tight leading-none my-1">
              {minAppts} – {maxAppts}
            </div>
            <div className="text-[9px] sm:text-xs text-emerald-400 font-extrabold truncate">
              High-Intent Ready Buyers
            </div>
          </div>

          <div className="pl-1.5 sm:pl-3 flex flex-col justify-center">
            <div className="text-[10px] sm:text-xs text-slate-400 font-medium truncate mb-0.5">
              Est. Sales Pipeline
            </div>
            <div className="text-lg min-[360px]:text-xl sm:text-3xl font-black text-white tracking-tight leading-none my-1">
              ₹{minRevInLakhs}L – ₹{maxRevInLakhs}L
            </div>
            <div className="text-[9px] sm:text-xs text-amber-400 font-extrabold truncate">
              Predictable Revenue
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={onBookClick}
          className="w-full cta-gold-btn shimmer rounded-2xl p-3 sm:p-4 text-center text-slate-950 font-black hover:opacity-95 transition-all overflow-hidden flex items-center justify-center space-x-2"
        >
          <span className="text-xs sm:text-sm uppercase tracking-wide font-black">
            Lock In These Numbers For Your Business
          </span>
          <i className="fa-solid fa-arrow-right text-xs"></i>
        </button>
      </div>
    </section>
  );
}
