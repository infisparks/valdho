"use client";

import React, { useState } from "react";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BookingModal({ isOpen, onClose }: BookingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    businessCategory: "Clinic / Healthcare",
    monthlySpend: "₹30,000 - ₹50,000",
    preferredDate: "Tomorrow",
    preferredTime: "11:00 AM",
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!formData.fullName || !formData.phone) return;
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleReset = () => {
    setStep(1);
    setFormData({
      fullName: "",
      phone: "",
      businessCategory: "Clinic / Healthcare",
      monthlySpend: "₹30,000 - ₹50,000",
      preferredDate: "Tomorrow",
      preferredTime: "11:00 AM",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#131316] border border-amber-500/50 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div>
            <span className="text-amber-400 font-extrabold text-[10px] sm:text-xs tracking-widest uppercase bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/30">
              1-on-1 Growth Session
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white mt-1">
              {step === 3 ? "Session Confirmed! 🎉" : "Book Your Growth Session"}
            </h3>
          </div>
          <button
            onClick={handleReset}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-slate-300 flex items-center justify-center text-sm"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Step Indicator */}
        {step !== 3 && (
          <div className="flex items-center space-x-2 mb-5 text-xs font-bold">
            <div className={`flex-1 py-1 text-center rounded-full ${step >= 1 ? "bg-amber-500 text-slate-950" : "bg-zinc-800 text-slate-400"}`}>
              1. Business Info
            </div>
            <div className={`flex-1 py-1 text-center rounded-full ${step >= 2 ? "bg-amber-500 text-slate-950" : "bg-zinc-800 text-slate-400"}`}>
              2. Select Slot
            </div>
          </div>
        )}

        {/* Step 1: Contact & Business Details */}
        {step === 1 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Your Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. Rajesh Kumar"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                WhatsApp / Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. +91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Business Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.businessCategory}
                onChange={(e) => setFormData({ ...formData, businessCategory: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value="Clinic / Healthcare">Doctor / Clinic / Hospital</option>
                <option value="Manufacturing & B2B">Manufacturer / B2B Wholesaler</option>
                <option value="IT & Software Agency">IT / Software Company / B2B Agency</option>
                <option value="Retail & Mobile Shop">Retail Store / Mobile / Electronics</option>
                <option value="Real Estate & Interiors">Real Estate & Interior Design</option>
                <option value="Food & Restaurant">Food Brand & FMCG</option>
                <option value="Other">Other Business</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Monthly Marketing Budget <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.monthlySpend}
                onChange={(e) => setFormData({ ...formData, monthlySpend: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value="Under ₹20,000">Under ₹20,000 / month</option>
                <option value="₹20,000 - ₹50,000">₹20,000 - ₹50,000 / month</option>
                <option value="₹50,000 - ₹1,50,000">₹50,000 - ₹1,50,000 / month</option>
                <option value="₹1,50,000+">Above ₹1,50,000 / month</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full cta-gold-btn shimmer py-3.5 px-4 rounded-xl text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center space-x-2 mt-4"
            >
              <span>Continue To Slot Selection</span>
              <i className="fa-solid fa-arrow-right"></i>
            </button>
          </form>
        )}

        {/* Step 2: Slot Selection */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                Select Preferred Day:
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                {["Today", "Tomorrow", "In 2 Days"].map((day) => (
                  <button
                    type="button"
                    key={day}
                    onClick={() => setFormData({ ...formData, preferredDate: day })}
                    className={`py-2.5 px-2 rounded-xl border text-center transition-all ${
                      formData.preferredDate === day
                        ? "bg-amber-500 text-slate-950 border-amber-400"
                        : "bg-zinc-900 text-slate-300 border-zinc-700"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                Select Preferred Time Slot:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                {["11:00 AM", "02:00 PM", "05:00 PM", "07:30 PM"].map((time) => (
                  <button
                    type="button"
                    key={time}
                    onClick={() => setFormData({ ...formData, preferredTime: time })}
                    className={`py-2.5 px-2 rounded-xl border text-center transition-all ${
                      formData.preferredTime === time
                        ? "bg-amber-500 text-slate-950 border-amber-400"
                        : "bg-zinc-900 text-slate-300 border-zinc-700"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 font-medium">
              ⚡ Note: Our Senior Revenue Strategist will call you at your selected slot to present your customized revenue roadmap.
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl text-xs"
              >
                Back
              </button>
              <button
                type="submit"
                className="w-2/3 cta-gold-btn shimmer py-3 rounded-xl text-slate-950 font-black text-xs uppercase tracking-wide flex items-center justify-center space-x-1"
              >
                <span>Confirm & Lock Spot</span>
                <i className="fa-solid fa-check"></i>
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Success Confirmation */}
        {step === 3 && (
          <div className="text-center space-y-4 py-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center text-3xl mx-auto">
              ✓
            </div>
            
            <h4 className="text-xl font-black text-white">
              Growth Session Requested!
            </h4>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Thank you, <span className="text-white font-bold">{formData.fullName}</span>. We have reserved your spot for{" "}
              <span className="text-amber-400 font-bold">{formData.preferredDate} at {formData.preferredTime}</span>.
            </p>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-left text-xs text-slate-300 space-y-1.5 font-mono">
              <div><span className="text-slate-500">Phone:</span> {formData.phone}</div>
              <div><span className="text-slate-500">Category:</span> {formData.businessCategory}</div>
              <div><span className="text-slate-500">Monthly Budget:</span> {formData.monthlySpend}</div>
            </div>

            <a
              href={`https://api.whatsapp.com/send?phone=919876543210&text=Hi%20First%20Option%20Agency,%20I%20just%20booked%20a%20Growth%20Session%20for%20my%20${encodeURIComponent(formData.businessCategory)}%20business.`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 px-4 rounded-xl text-xs sm:text-sm uppercase tracking-wide shadow-lg"
            >
              <i className="fa-brands fa-whatsapp mr-2 text-base"></i>
              Connect On WhatsApp Immediately
            </a>

            <button
              onClick={handleReset}
              className="text-xs text-slate-400 underline hover:text-white"
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
