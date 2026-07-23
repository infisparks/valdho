"use client";

import React, { useState } from "react";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BookingModal({ isOpen, onClose }: BookingModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    countryCode: "+91",
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone) return;
    setStep(2);
  };

  const handleReset = () => {
    setStep(1);
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      countryCode: "+91",
    });
    onClose();
  };

  const whatsappUrl = `https://api.whatsapp.com/send?phone=919876543210&text=${encodeURIComponent(
    `Hi First Option Agency, I have completed the consultation form.\nName: ${formData.fullName}\nEmail: ${formData.email}\nPhone: ${formData.countryCode} ${formData.phone}`
  )}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-toast-in">
      <div className="bg-white text-slate-900 border border-slate-200 w-full max-w-lg rounded-2xl p-5 sm:p-7 shadow-2xl relative max-h-[95vh] overflow-y-auto font-sans">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <span className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wide">
            FILL OUT THE FORM BELOW TO BOOK YOUR CONSULTATION
          </span>
          <button
            onClick={handleReset}
            className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center text-sm transition-colors"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title Description */}
            <h3 className="text-base sm:text-lg font-bold text-slate-900 text-center leading-snug px-2">
              Complete the form below and move to the next step to provide some basic information about your business
            </h3>

            {/* Full Name */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm"
              />
            </div>

            {/* Phone Number with Country Code */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">
                Phone Number
              </label>
              <div className="flex items-center bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500">
                <div className="flex items-center space-x-1 px-3 py-3 bg-slate-50 border-r border-slate-200 text-xs sm:text-sm font-medium text-slate-700">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  type="tel"
                  required
                  placeholder="90962-94110"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Submit Gold Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-b from-[#ffd369] via-[#f7b731] to-[#eb9d14] border border-amber-600/80 rounded-xl p-4 text-center cursor-pointer shadow-md hover:brightness-105 active:scale-[0.99] transition-all mt-3"
            >
              <div className="text-base sm:text-lg font-bold text-slate-950 flex items-center justify-center space-x-1.5 leading-snug">
                <span>Click to save and proceed to the next step</span>
                <span className="text-xl">→</span>
              </div>
              <div className="text-xs font-semibold text-slate-900/90 mt-0.5">
                Book Your call at just 09 rs
              </div>
            </button>
          </form>
        ) : (
          /* Success / WhatsApp Redirect Step */
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center text-3xl mx-auto shadow-sm">
              ✓
            </div>

            <h4 className="text-xl font-bold text-slate-900">
              Information Saved!
            </h4>

            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed px-2">
              Thank you, <span className="text-slate-900 font-bold">{formData.fullName}</span>. Your details have been submitted. Click below to connect on WhatsApp directly:
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-left text-xs text-slate-700 space-y-1 font-mono">
              <div><span className="text-slate-400">Name:</span> {formData.fullName}</div>
              <div><span className="text-slate-400">Email:</span> {formData.email}</div>
              <div><span className="text-slate-400">Phone:</span> {formData.countryCode} {formData.phone}</div>
            </div>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl text-sm uppercase tracking-wide shadow-md transition-colors"
            >
              <i className="fa-brands fa-whatsapp mr-2 text-base"></i>
              Proceed To WhatsApp Consultation
            </a>

            <button
              onClick={handleReset}
              className="text-xs text-slate-500 underline hover:text-slate-800 pt-1 block mx-auto"
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
