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
    return `₹${val.toLocaleString('en-IN')} / month`;
  };

  return (
    <section className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl relative">
      <div className="text-center space-y-2 mb-5">
        <span className="text-amber-400 font-extrabold text-xs tracking-widest uppercase bg-amber-500/10 px-3.5 py-1 rounded-full border border-amber-500/30">
          Interactive Revenue Calculator
        </span>
        <h3 className="text-xl sm:text-2xl font-black text-white">
          Estimate Your Monthly Appointment Potential
        </h3>
        <p className="text-xs sm:text-sm text-slate-400 font-medium">
          Select your industry & budget to see what a Revenue System can generate:
        </p>
      </div>

      <div className="space-y-5">
        {/* Industry Select */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
            Select Your Business Category:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold">
            <button
              onClick={() => setIndustry("clinic")}
              className={`p-2.5 rounded-xl text-center border font-bold transition-all ${
                industry === "clinic"
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg scale-[1.02]"
                  : "bg-zinc-800 text-slate-300 border-zinc-700 hover:bg-zinc-750"
              }`}
            >
              👨‍⚕️ Clinic / Doctor
            </button>
            <button
              onClick={() => setIndustry("manufacturing")}
              className={`p-2.5 rounded-xl text-center border font-bold transition-all ${
                industry === "manufacturing"
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg scale-[1.02]"
                  : "bg-zinc-800 text-slate-300 border-zinc-700 hover:bg-zinc-750"
              }`}
            >
              🏭 Manufacturer
            </button>
            <button
              onClick={() => setIndustry("it")}
              className={`p-2.5 rounded-xl text-center border font-bold transition-all ${
                industry === "it"
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg scale-[1.02]"
                  : "bg-zinc-800 text-slate-300 border-zinc-700 hover:bg-zinc-750"
              }`}
            >
              💻 IT / B2B Agency
            </button>
            <button
              onClick={() => setIndustry("retail")}
              className={`p-2.5 rounded-xl text-center border font-bold transition-all ${
                industry === "retail"
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg scale-[1.02]"
                  : "bg-zinc-800 text-slate-300 border-zinc-700 hover:bg-zinc-750"
              }`}
            >
              🏪 Retail / Store
            </button>
          </div>
        </div>

        {/* Budget Range Slider */}
        <div>
          <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-300 mb-2">
            <span>Monthly Marketing Budget:</span>
            <span className="text-amber-400 font-black text-sm sm:text-base">
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
            className="w-full accent-amber-500 h-2.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>₹15k/mo</span>
            <span>₹75k/mo</span>
            <span>₹1.5L/mo</span>
          </div>
        </div>

        {/* Calculator Output Box */}
        <div className="bg-black/80 border border-amber-500/30 rounded-2xl p-4 sm:p-5 text-center grid grid-cols-2 gap-3 shadow-inner">
          <div className="border-r border-zinc-800 pr-2">
            <div className="text-xs text-slate-400 font-semibold mb-1">Estimated {label}</div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
              {minAppts} - {maxAppts}
            </div>
            <div className="text-[10px] sm:text-xs text-emerald-400 font-bold mt-1">
              High-Intent Ready Buyers
            </div>
          </div>
          <div className="pl-2">
            <div className="text-xs text-slate-400 font-semibold mb-1">Estimated Sales Pipeline</div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ₹{minRevInLakhs}L - ₹{maxRevInLakhs}L
            </div>
            <div className="text-[10px] sm:text-xs text-amber-400 font-bold mt-1">
              Predictable Revenue
            </div>
          </div>
        </div>

        <button
          onClick={onBookClick}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 border border-zinc-700 transition-colors shadow-md"
        >
          <span>Lock In These Numbers For Your Business</span>
          <i className="fa-solid fa-chevron-right text-xs"></i>
        </button>
      </div>
    </section>
  );
}
