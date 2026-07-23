"use client";

import React, { useState } from "react";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function BookingModal({ isOpen, onClose }: BookingModalProps) {
  // Step 1: Initial Form
  // Step 2: Qualification Typeform (Q2: Industry, Q3: Role, Q4: Revenue, Q5: Investment)
  // Step 3: Interactive Calendar Booking (Month, Date & Slot Selection)
  // Step 4: Final Success Confirmation & WhatsApp redirect
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [contactInfo, setContactInfo] = useState({
    fullName: "",
    email: "",
    phone: "",
    countryCode: "+91",
  });

  const [qAnswers, setQAnswers] = useState({
    industry: "Doctor / Clinic",
    role: "Founder / Owner",
    revenue: "₹5L – ₹10L",
    investmentReady: "Yes",
  });

  // Qualification Question Index (0 to 3)
  const [activeQIndex, setActiveQIndex] = useState<number>(0);

  // Dynamic Interactive Calendar State
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(6); // 6 = July
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [selectedDay, setSelectedDay] = useState<number>(23);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleReset = () => {
    setStep(1);
    setActiveQIndex(0);
    setSelectedTimeSlot(null);
    setContactInfo({
      fullName: "",
      email: "",
      phone: "",
      countryCode: "+91",
    });
    onClose();
  };

  // Month Switching Handlers
  const handlePrevMonth = () => {
    if (currentMonthIndex > 0) {
      setCurrentMonthIndex(currentMonthIndex - 1);
    } else {
      setCurrentMonthIndex(11);
      setCurrentYear(currentYear - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex < 11) {
      setCurrentMonthIndex(currentMonthIndex + 1);
    } else {
      setCurrentMonthIndex(0);
      setCurrentYear(currentYear + 1);
    }
  };

  // Calculate calendar grid metrics for active month & year
  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonthIndex, 1).getDay();

  const handleSelectSlot = (time: string) => {
    setSelectedTimeSlot(time);
    setStep(4);
  };

  const formattedBookingDate = `${selectedDay} ${MONTH_NAMES[currentMonthIndex]} ${currentYear}`;

  const whatsappUrl = `https://api.whatsapp.com/send?phone=919876543210&text=${encodeURIComponent(
    `Hi First Option Agency, I just booked a Growth Consultation Call.\nName: ${contactInfo.fullName || "User"}\nEmail: ${contactInfo.email || "N/A"}\nPhone: ${contactInfo.countryCode} ${contactInfo.phone || "N/A"}\nIndustry: ${qAnswers.industry}\nRole: ${qAnswers.role}\nMonthly Revenue: ${qAnswers.revenue}\nBooked Slot: ${formattedBookingDate} at ${selectedTimeSlot || "02:00 PM"}`
  )}`;

  const qualificationQuestions = [
    {
      num: 2,
      question: "What industry are you in? *",
      field: "industry",
      options: [
        { label: "Doctor / Clinic", key: "A" },
        { label: "Manufacturer / Distributor", key: "B" },
        { label: "IT / Tech / SaaS", key: "C" },
        { label: "Service Business", key: "D" },
        { label: "Other", key: "E" },
      ],
    },
    {
      num: 3,
      question: "What is your role in the business? *",
      field: "role",
      options: [
        { label: "Founder / Owner", key: "A" },
        { label: "Partner", key: "B" },
        { label: "Marketing Head", key: "C" },
        { label: "Team Member", key: "D" },
      ],
    },
    {
      num: 4,
      question: "What is your current monthly revenue? *",
      field: "revenue",
      options: [
        { label: "Below ₹5L", key: "A" },
        { label: "₹5L – ₹10L", key: "B" },
        { label: "₹10L – ₹25L", key: "C" },
        { label: "₹25L – ₹50L", key: "D" },
        { label: "₹50L+", key: "E" },
      ],
    },
    {
      num: 5,
      question: "Are you ready to invest in a proper marketing system if it makes financial sense? *",
      field: "investmentReady",
      options: [
        { label: "Yes", key: "A" },
        { label: "Maybe", key: "B" },
        { label: "Just exploring", key: "C" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 animate-toast-in overflow-y-auto">
      {/* Step 1: Initial White Form Modal */}
      {step === 1 && (
        <div className="bg-white text-slate-900 border border-slate-200 w-full max-w-lg rounded-2xl p-4 sm:p-7 shadow-2xl relative max-h-[92vh] overflow-y-auto font-sans my-auto">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <span className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wide">
              FILL OUT THE FORM BELOW TO BOOK YOUR CONSULTATION
            </span>
            <button
              onClick={handleReset}
              className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center text-sm transition-colors"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <form onSubmit={handleStep1Submit} className="space-y-3.5">
            <h3 className="text-sm sm:text-lg font-bold text-slate-900 text-center leading-snug px-1">
              Complete the form below and move to the next step to provide some basic information about your business
            </h3>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Enter your full name"
                value={contactInfo.fullName}
                onChange={(e) => setContactInfo({ ...contactInfo, fullName: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 sm:py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={contactInfo.email}
                onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 sm:py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">
                Phone Number
              </label>
              <div className="flex items-center bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500">
                <div className="flex items-center space-x-1 px-3 py-2.5 sm:py-3 bg-slate-50 border-r border-slate-200 text-xs sm:text-sm font-medium text-slate-700">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  type="tel"
                  required
                  placeholder="90962-94110"
                  value={contactInfo.phone}
                  onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                  className="w-full px-3 py-2.5 sm:py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full bg-gradient-to-b from-[#ffd369] via-[#f7b731] to-[#eb9d14] border border-amber-600/80 rounded-xl p-3.5 sm:p-4 text-center cursor-pointer shadow-md hover:brightness-105 active:scale-[0.99] transition-all mt-3"
            >
              <div className="text-sm sm:text-lg font-bold text-slate-950 flex items-center justify-center space-x-1.5 leading-snug">
                <span>Click to save and proceed to the next step</span>
                <span className="text-lg sm:text-xl">→</span>
              </div>
              <div className="text-[11px] sm:text-xs font-semibold text-slate-900/90 mt-0.5">
                Book Your call at just 09 rs
              </div>
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Qualification Questionnaire (Typeform Dark Aesthetic) */}
      {step === 2 && (
        <div className="bg-[#0f0f13] text-white border border-zinc-800 w-full max-w-xl rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xl relative max-h-[92vh] overflow-y-auto font-sans flex flex-col justify-between my-auto">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 mb-3">
              <h3 className="text-xs sm:text-base font-bold text-white tracking-wide truncate">
                Let&apos;s Understand Your Business Before We Grow It
              </h3>
              <button
                onClick={handleReset}
                className="w-7 h-7 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center text-sm flex-shrink-0"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Current Question */}
            {(() => {
              const currentQ = qualificationQuestions[activeQIndex];
              return (
                <div className="space-y-4 pt-1">
                  <div className="text-sm sm:text-lg md:text-xl font-medium text-slate-100 flex items-start space-x-2">
                    <span className="text-amber-400 font-bold flex-shrink-0">{currentQ.num} ➔</span>
                    <span>{currentQ.question}</span>
                  </div>

                  <div className="space-y-2 pt-1 max-w-md">
                    {currentQ.options.map((opt) => {
                      const isSelected =
                        qAnswers[currentQ.field as keyof typeof qAnswers] === opt.label;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setQAnswers({ ...qAnswers, [currentQ.field]: opt.label });
                            if (activeQIndex < qualificationQuestions.length - 1) {
                              setActiveQIndex(activeQIndex + 1);
                            }
                          }}
                          className={`w-full text-left p-2.5 sm:p-3.5 rounded-xl border flex items-center justify-between transition-all duration-200 ${
                            isSelected
                              ? "bg-amber-500/20 border-amber-400 text-white shadow-[0_0_15px_rgba(245,166,35,0.2)]"
                              : "bg-[#18181f] border-zinc-800 text-slate-200 hover:border-zinc-700 hover:bg-[#20202a]"
                          }`}
                        >
                          <span className="text-xs sm:text-sm font-semibold">{opt.label}</span>
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-zinc-700 text-zinc-400 text-[10px] sm:text-xs font-mono flex items-center justify-center bg-zinc-900 flex-shrink-0">
                            {opt.key}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between mt-5">
            <div className="flex items-center space-x-3">
              {activeQIndex === qualificationQuestions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm uppercase tracking-wide flex items-center space-x-2 shadow-lg transition-transform active:scale-95"
                >
                  <span>Submit</span>
                  <i className="fa-solid fa-chevron-right text-xs"></i>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveQIndex(activeQIndex + 1)}
                  className="bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-bold px-4 py-1.5 sm:py-2 rounded-full text-xs flex items-center space-x-1.5 shadow"
                >
                  <span>OK</span>
                  <i className="fa-solid fa-chevron-right text-xs"></i>
                </button>
              )}
              <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
                press <span className="text-white font-bold">Enter ↵</span>
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                disabled={activeQIndex === 0}
                onClick={() => setActiveQIndex(Math.max(0, activeQIndex - 1))}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-slate-950 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <i className="fa-solid fa-chevron-up text-xs"></i>
              </button>
              <button
                type="button"
                disabled={activeQIndex === qualificationQuestions.length - 1}
                onClick={() => setActiveQIndex(Math.min(qualificationQuestions.length - 1, activeQIndex + 1))}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-slate-950 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <i className="fa-solid fa-chevron-down text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Interactive Calendar Appointment Booking with Month Switcher */}
      {step === 3 && (
        <div className="bg-[#0b0b0e] text-white border border-zinc-800 w-full max-w-lg rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto font-sans space-y-3 my-auto">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <p className="text-xs sm:text-sm font-bold text-slate-300">
              Select date & time for your Growth Strategy Call
            </p>
            <button
              onClick={handleReset}
              className="w-7 h-7 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center text-sm"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="bg-[#121217] border border-zinc-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-3.5 shadow-xl">
            {/* Host Card Info */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-400 shadow">
                  <img src="/founder.png" alt="Faiz Ansari" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-base font-bold text-white leading-tight">
                    Your Business Growth Call
                  </h4>
                  <p className="text-[11px] text-amber-400 font-semibold">Faiz Ansari • Senior Strategist</p>
                </div>
              </div>

              <div className="flex items-center space-x-1 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full text-[10px] sm:text-xs text-amber-400 font-mono font-bold">
                <i className="fa-regular fa-clock"></i>
                <span>60 min</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <div className="flex items-center space-x-1.5 font-mono">
                <i className="fa-solid fa-globe text-amber-400"></i>
                <span>Asia/Calcutta (GMT+5:30)</span>
              </div>
            </div>

            {/* Interactive Month Switcher Calendar Card */}
            <div className="border border-zinc-800 rounded-xl sm:rounded-2xl p-3 bg-zinc-950 space-y-3">
              
              {/* Month Navigation Control Header */}
              <div className="flex items-center justify-between text-xs font-extrabold text-white px-1">
                <button
                  onClick={handlePrevMonth}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-amber-400 flex items-center space-x-1 transition-colors"
                >
                  <i className="fa-solid fa-chevron-left text-[10px]"></i>
                  <span>Prev</span>
                </button>

                <span className="text-sm font-black text-white tracking-wide bg-zinc-900/90 px-3 py-1 rounded-lg border border-zinc-800">
                  {MONTH_NAMES[currentMonthIndex]} {currentYear}
                </span>

                <button
                  onClick={handleNextMonth}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-amber-400 flex items-center space-x-1 transition-colors"
                >
                  <span>Next</span>
                  <i className="fa-solid fa-chevron-right text-[10px]"></i>
                </button>
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 text-center text-[9px] sm:text-[10px] font-bold text-slate-500 border-b border-zinc-800/80 pb-1">
                <span>SUN</span>
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
              </div>

              {/* Accurate Calendar Day Grid */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-mono font-bold">
                {/* Empty offset cells before day 1 */}
                {[...Array(firstDayOfWeek)].map((_, emptyIdx) => (
                  <div key={`empty-${emptyIdx}`} className="p-1 sm:p-1.5" />
                ))}

                {/* Days of Month */}
                {[...Array(daysInMonth)].map((_, i) => {
                  const dayNum = i + 1;
                  const isSelected = selectedDay === dayNum;
                  return (
                    <button
                      key={dayNum}
                      onClick={() => setSelectedDay(dayNum)}
                      className={`p-1.5 sm:p-2 rounded-xl transition-all text-xs font-bold ${
                        isSelected
                          ? "bg-amber-500 text-slate-950 font-black shadow-[0_0_15px_rgba(245,166,35,0.4)] scale-105"
                          : "text-slate-200 hover:bg-zinc-800 hover:text-amber-400"
                      }`}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slot Picker for Selected Date */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span>📅 {formattedBookingDate}</span>
                <span className="text-amber-400 text-[10px] uppercase font-mono">Select Time Slot</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {["10:00 AM", "02:00 PM", "05:00 PM", "07:30 PM", "09:00 PM"].map((time) => (
                  <button
                    key={time}
                    onClick={() => handleSelectSlot(time)}
                    className="w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-extrabold p-2.5 sm:p-3 rounded-xl text-xs hover:brightness-110 shadow-md transition-all active:scale-[0.98] flex items-center justify-center space-x-1.5"
                  >
                    <i className="fa-regular fa-clock"></i>
                    <span>{time}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Final Success Confirmation & WhatsApp Action */}
      {step === 4 && (
        <div className="bg-[#0c0c0f] text-white border border-emerald-500/40 w-full max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative text-center space-y-4 font-sans my-auto">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center text-2xl sm:text-3xl mx-auto shadow-lg">
            ✓
          </div>

          <div>
            <h4 className="text-lg sm:text-xl font-black text-white">
              Appointment Locked! 🎉
            </h4>
            <p className="text-xs text-amber-400 font-bold mt-1">
              {formattedBookingDate} at {selectedTimeSlot}
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 text-left text-xs text-slate-300 space-y-1 font-mono">
            <div><span className="text-slate-500">Name:</span> {contactInfo.fullName || "User"}</div>
            <div><span className="text-slate-500">Phone:</span> {contactInfo.countryCode} {contactInfo.phone || "N/A"}</div>
            <div><span className="text-slate-500">Industry:</span> {qAnswers.industry}</div>
            <div><span className="text-slate-500">Slot:</span> {formattedBookingDate} ({selectedTimeSlot})</div>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 sm:py-3.5 px-4 rounded-xl text-xs sm:text-sm uppercase tracking-wide shadow-xl transition-transform active:scale-98"
          >
            <i className="fa-brands fa-whatsapp mr-2 text-base"></i>
            Confirm Slot On WhatsApp Instantly
          </a>

          <button
            onClick={handleReset}
            className="text-xs text-slate-500 underline hover:text-slate-300 pt-1 block mx-auto"
          >
            Close Window
          </button>
        </div>
      )}
    </div>
  );
}
