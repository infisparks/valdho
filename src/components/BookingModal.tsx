"use client";

import React, { useState, useEffect } from "react";
import {
  saveOrUpdateLead,
  getLeadById,
  findExistingLead,
  sanitizeEmailToId,
  getBookedSlotsForDate,
  sanitizeSlotKey,
  LeadData,
} from "@/lib/firebase";
import { getCampaignConfig, DEFAULT_CAMPAIGN_ID } from "@/config/campaigns";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: 1 | 2 | 3 | 4;
  initialLeadId?: string | null;
  initialCreatedDate?: string | null;
  campaignName?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Exact 8 daily time slots matching user request
const DAILY_TIME_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "02:00 PM",
  "03:00 PM",
  "07:00 PM",
  "09:00 PM",
];

/**
 * Helper: Check if a specific time slot string (e.g. "09:00 AM") has already passed for a given date.
 */
export function isSlotTimePassed(
  timeStr: string,
  day: number,
  month: number,
  year: number
): boolean {
  const now = new Date();

  // Past dates
  if (year < now.getFullYear()) return true;
  if (year === now.getFullYear() && month < now.getMonth()) return true;
  if (year === now.getFullYear() && month === now.getMonth() && day < now.getDate()) return true;

  // Future dates (tomorrow or later)
  if (year > now.getFullYear() || month > now.getMonth() || day > now.getDate()) return false;

  // Selected date is TODAY: parse slot time
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return false;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  const slotDate = new Date(year, month, day, hours, minutes, 0, 0);
  return slotDate.getTime() <= now.getTime();
}

export function BookingModal({
  isOpen,
  onClose,
  initialStep = 1,
  initialLeadId = null,
  initialCreatedDate = null,
  campaignName = DEFAULT_CAMPAIGN_ID,
}: BookingModalProps) {
  // Load dynamic campaign questions & info
  const activeCampaign = getCampaignConfig(campaignName);

  // Step 1: Initial Contact Form
  // Step 2: Qualification Typeform Questionnaire
  // Step 3: Interactive Calendar Booking (Month, Date & Slot Selection)
  // Step 4: Final Success Confirmation & WhatsApp redirect
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep);

  // Lead ID & Creation Date in Firebase & LocalStorage
  const [firebaseLeadId, setFirebaseLeadId] = useState<string | null>(initialLeadId);
  const [createdDate, setCreatedDate] = useState<string | null>(initialCreatedDate);

  // Form Contact State
  const [contactInfo, setContactInfo] = useState({
    fullName: "",
    email: "",
    phone: "",
    countryCode: "+91",
  });

  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Dynamic Survey Answers State
  const [qAnswers, setQAnswers] = useState<Record<string, string>>({});

  // Qualification Question Index (0 based)
  const [activeQIndex, setActiveQIndex] = useState<number>(0);

  // Get current real-world date for past date prevention
  const today = new Date();
  const realTodayYear = today.getFullYear();
  const realTodayMonth = today.getMonth(); // 0-based
  const realTodayDay = today.getDate();

  // Dynamic Interactive Calendar State
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(realTodayMonth);
  const [currentYear, setCurrentYear] = useState<number>(realTodayYear);
  const [selectedDay, setSelectedDay] = useState<number>(realTodayDay);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  // Real-time booked slots map for the selected date
  const [bookedSlotsMap, setBookedSlotsMap] = useState<Record<string, boolean>>({});
  const [generatedMeetUrl, setGeneratedMeetUrl] = useState<string | null>(null);

  // Synchronize initialStep when modal opens or URL parameters change
  useEffect(() => {
    if (isOpen) {
      if (initialStep) setStep(initialStep);
      if (initialLeadId) setFirebaseLeadId(initialLeadId);
      if (initialCreatedDate) setCreatedDate(initialCreatedDate);
    }
  }, [isOpen, initialStep, initialLeadId, initialCreatedDate]);

  // Dynamically sync browser URL address bar params when step changes
  useEffect(() => {
    if (!isOpen) {
      if (typeof window !== "undefined" && window.location.search) {
        window.history.replaceState({}, "", window.location.pathname);
      }
      return;
    }

    if (typeof window !== "undefined" && firebaseLeadId) {
      const todayDate = createdDate || new Date().toISOString().split("T")[0];
      let stepName = "";

      if (step === 2) stepName = "survey";
      else if (step === 3) stepName = "meeting";
      else if (step === 4) stepName = "success";

      if (stepName) {
        const newUrl = `${window.location.pathname}?step=${stepName}&leadId=${firebaseLeadId}&createdDate=${todayDate}&campaign=${activeCampaign.id}`;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [isOpen, step, firebaseLeadId, createdDate, activeCampaign.id]);

  // Pre-fill contact details from Firebase or LocalStorage
  // FALLBACK: If contact details are NOT found for this user, auto-back to Step 1 (Contact Form popup)
  useEffect(() => {
    async function restoreLead() {
      if (!isOpen) return;

      const targetId = initialLeadId || (typeof window !== "undefined" ? localStorage.getItem("firstoption_lead_id") : null);
      const targetDate = initialCreatedDate || (typeof window !== "undefined" ? localStorage.getItem("firstoption_created_date") : null);

      let foundContact = false;

      if (targetId) {
        const existingMatch = await findExistingLead(targetId, targetDate, activeCampaign.id);
        if (existingMatch && existingMatch.lead) {
          const fbLead = existingMatch.lead;
          setFirebaseLeadId(targetId);
          setCreatedDate(existingMatch.createdDate);
          if (fbLead.fullName && fbLead.phone) {
            setContactInfo({
              fullName: fbLead.fullName || "",
              email: fbLead.email || "",
              phone: fbLead.phone || "",
              countryCode: fbLead.countryCode || "+91",
            });
            if (fbLead.survey) {
              setQAnswers(fbLead.survey as Record<string, string>);
            }
            // If lead already has a booked meeting, restore date/time and show confirmation
            if (fbLead.meeting?.meetingDate && fbLead.meeting?.meetingTime) {
              setSelectedTimeSlot(fbLead.meeting.meetingTime);
              const parts = fbLead.meeting.meetingDate.split("-");
              if (parts.length === 3) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const d = parseInt(parts[2], 10);
                if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                  setCurrentYear(y);
                  setCurrentMonthIndex(m);
                  setSelectedDay(d);
                }
              }
              setStep(4);
            }
            foundContact = true;
          }
        }
      }

      // Check LocalStorage fallback
      if (!foundContact && typeof window !== "undefined") {
        try {
          const savedContact = localStorage.getItem("firstoption_user_contact");
          if (savedContact) {
            const parsed = JSON.parse(savedContact);
            if (parsed.fullName && parsed.phone) {
              setContactInfo({
                fullName: parsed.fullName || "",
                email: parsed.email || "",
                phone: parsed.phone || "",
                countryCode: parsed.countryCode || "+91",
              });
              foundContact = true;
            }
          }
        } catch (e) {
          console.error("LocalStorage restore error:", e);
        }
      }

      // If user navigated directly to survey/meeting URL but contact info is NOT found -> AUTO BACK TO STEP 1 FORM
      if (!foundContact && (initialStep === 2 || initialStep === 3)) {
        setStep(1);
      }
    }

    restoreLead();
  }, [isOpen, initialStep, initialLeadId, initialCreatedDate, activeCampaign.id]);

  // Realtime Booked Slots Listener whenever selected date changes
  useEffect(() => {
    async function fetchSlots() {
      if (!isOpen || step !== 3) return;

      const formattedMonth = (currentMonthIndex + 1).toString().padStart(2, "0");
      const formattedDay = selectedDay.toString().padStart(2, "0");
      const appointmentDateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;

      const bookedMap = await getBookedSlotsForDate(appointmentDateStr, activeCampaign.id);
      setBookedSlotsMap(bookedMap);
    }

    fetchSlots();
  }, [isOpen, step, selectedDay, currentMonthIndex, currentYear, activeCampaign.id]);

  // Auto-restore profile when user finishes typing email in Step 1
  const handleEmailBlur = async () => {
    if (contactInfo.email && contactInfo.email.includes("@")) {
      const emailPrefixId = sanitizeEmailToId(contactInfo.email);
      const existingMatch = await findExistingLead(emailPrefixId, createdDate, activeCampaign.id);
      if (existingMatch && existingMatch.lead) {
        const fbLead = existingMatch.lead;
        setFirebaseLeadId(emailPrefixId);
        setCreatedDate(existingMatch.createdDate);
        setContactInfo((prev) => ({
          fullName: prev.fullName || fbLead.fullName || "",
          email: prev.email || fbLead.email || "",
          phone: prev.phone || fbLead.phone || "",
          countryCode: prev.countryCode || fbLead.countryCode || "+91",
        }));
        if (fbLead.survey) {
          setQAnswers(fbLead.survey as Record<string, string>);
        }
      }
    }
  };

  if (!isOpen) return null;

  // Step 1 Submit: Save ONLY Contact details to Firebase without wiping existing survey or meeting details
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);

    const cleanPhone = contactInfo.phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setPhoneError("Please enter a valid 10-digit mobile number");
      return;
    }

    // Determine deterministic email prefix lead ID
    const emailPrefixId = sanitizeEmailToId(contactInfo.email);

    // Persist contact to LocalStorage
    try {
      localStorage.setItem("firstoption_user_contact", JSON.stringify(contactInfo));
      localStorage.setItem("firstoption_lead_id", emailPrefixId);
    } catch (err) {
      console.error("LocalStorage save error:", err);
    }

    // Sync to Firebase with status "partial" and pipelineStage "in_progress"
    const leadPayload: LeadData = {
      fullName: contactInfo.fullName,
      email: contactInfo.email,
      phone: cleanPhone,
      countryCode: contactInfo.countryCode,
      status: "partial",
      pipelineStage: "in_progress",
      stageMovedAt: new Date().toISOString(),
    };

    const res = await saveOrUpdateLead(leadPayload, emailPrefixId, createdDate, activeCampaign.id);
    if (res) {
      setFirebaseLeadId(res.leadId);
      setCreatedDate(res.createdDate);
      if (res.leadData?.survey) {
        setQAnswers(res.leadData.survey as Record<string, string>);
      }
      try {
        localStorage.setItem("firstoption_created_date", res.createdDate);
      } catch (err) {
        console.error("LocalStorage leadId error:", err);
      }
    }

    setStep(2);

    // Asynchronously trigger automatic WhatsApp Welcome Message in background (no user wait / zero lag)
    const serverUrl = (process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL || "https://first.infiplus.in").replace(/\/$/, "");
    fetch(`${serverUrl}/api/whatsapp/auto-send-welcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: contactInfo.fullName,
        email: contactInfo.email,
        phone: `${contactInfo.countryCode}${cleanPhone}`,
      }),
    }).catch((err) => console.error("Async WhatsApp Auto-Welcome Trigger Error:", err));
  };

  // Step 2 Submit: Save Survey Answers to SAME Firebase Lead Node (status: "survey_completed")
  const handleStep2Submit = async () => {
    const emailPrefixId = firebaseLeadId || sanitizeEmailToId(contactInfo.email);

    const surveyPayload: LeadData = {
      fullName: contactInfo.fullName,
      email: contactInfo.email,
      phone: contactInfo.phone.replace(/\D/g, ""),
      countryCode: contactInfo.countryCode,
      status: "survey_completed",
      pipelineStage: "survey_completed",
      stageMovedAt: new Date().toISOString(),
      survey: qAnswers,
    };

    await saveOrUpdateLead(surveyPayload, emailPrefixId, createdDate, activeCampaign.id);
    setStep(3);

    // Asynchronously trigger automatic Survey WhatsApp Message in background (no user wait)
    const serverUrl = (process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL || "https://first.infiplus.in").replace(/\/$/, "");
    fetch(`${serverUrl}/api/whatsapp/auto-send-survey`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: contactInfo.fullName,
        email: contactInfo.email,
        phone: `${contactInfo.countryCode}${contactInfo.phone.replace(/\D/g, "")}`,
      }),
    }).catch((err) => console.error("Async WhatsApp Auto-Survey Trigger Error:", err));
  };

  const handleReset = () => {
    setStep(1);
    setActiveQIndex(0);
    setSelectedTimeSlot(null);
    setPhoneError(null);

    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    onClose();
  };

  // Month Switching Handlers with Prev Month Prevention
  const isPrevMonthDisabled =
    currentYear < realTodayYear ||
    (currentYear === realTodayYear && currentMonthIndex <= realTodayMonth);

  const handlePrevMonth = () => {
    if (isPrevMonthDisabled) return;

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

  // Helper to check if a specific day is in the past
  const isPastDay = (dayNum: number) => {
    if (currentYear < realTodayYear) return true;
    if (currentYear === realTodayYear && currentMonthIndex < realTodayMonth) return true;
    if (
      currentYear === realTodayYear &&
      currentMonthIndex === realTodayMonth &&
      dayNum < realTodayDay
    ) {
      return true;
    }
    return false;
  };

  // Step 3 Submit: Update Meeting details & Slot Booking in Firebase (status: "completed")
  const handleSelectSlot = async (time: string) => {
    const slotKey = sanitizeSlotKey(time);
    if (bookedSlotsMap[slotKey]) return; // Block booking already booked slot

    setSelectedTimeSlot(time);

    const emailPrefixId = firebaseLeadId || sanitizeEmailToId(contactInfo.email);
    const formattedMonth = (currentMonthIndex + 1).toString().padStart(2, "0");
    const formattedDay = selectedDay.toString().padStart(2, "0");
    const appointmentDateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;

    const completedPayload: LeadData = {
      fullName: contactInfo.fullName,
      email: contactInfo.email,
      phone: contactInfo.phone.replace(/\D/g, ""),
      countryCode: contactInfo.countryCode,
      status: "completed",
      pipelineStage: "meeting_booked",
      stageMovedAt: new Date().toISOString(),
      survey: qAnswers,
      meeting: {
        meetingDate: appointmentDateStr,
        meetingTime: time,
        bookedAt: new Date().toISOString(),
      },
    };

    await saveOrUpdateLead(completedPayload, emailPrefixId, createdDate, activeCampaign.id);
    setStep(4);

    // Asynchronously trigger automatic Calendar Meeting Booked WhatsApp Message in background
    const serverUrl = (process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL || "https://first.infiplus.in").replace(/\/$/, "");
    const formattedDateStr = `${MONTH_NAMES[currentMonthIndex]} ${selectedDay}, ${currentYear}`;
    fetch(`${serverUrl}/api/whatsapp/auto-send-meeting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: contactInfo.fullName,
        email: contactInfo.email,
        phone: `${contactInfo.countryCode}${contactInfo.phone.replace(/\D/g, "")}`,
        date: formattedDateStr,
        time: time,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.meetingUrl) {
          setGeneratedMeetUrl(data.meetingUrl);
        }
      })
      .catch((err) => console.error("Async WhatsApp Auto-Meeting Trigger Error:", err));
  };

  const formattedBookingDate = `${selectedDay} ${MONTH_NAMES[currentMonthIndex]} ${currentYear}`;

  const whatsappUrl = `https://api.whatsapp.com/send?phone=919876543210&text=${encodeURIComponent(
    `Hi ${activeCampaign.title}, I just booked a Growth Consultation Call.\nName: ${contactInfo.fullName || "User"}\nEmail: ${contactInfo.email || "N/A"}\nPhone: ${contactInfo.countryCode} ${contactInfo.phone || "N/A"}\nBooked Slot: ${formattedBookingDate} at ${selectedTimeSlot || "02:00 PM"}`
  )}`;

  const qualificationQuestions = activeCampaign.questions;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 animate-toast-in overflow-y-auto">
      {/* Step 1: Executive Dark Form Modal (Fast Mobile Filing) */}
      {step === 1 && (
        <div className="bg-gradient-to-b from-zinc-950 via-[#0d0e14] to-zinc-950 text-white border border-amber-500/40 w-full max-w-md sm:max-w-lg rounded-3xl p-4 sm:p-7 shadow-[0_0_50px_rgba(245,166,35,0.2)] relative max-h-[92vh] overflow-y-auto font-sans my-auto">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
            <div className="flex items-center space-x-2">
              <span className="bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                Step 1 of 3
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide">
                Fast 30-Sec Booking
              </span>
            </div>
            <button
              onClick={handleReset}
              className="w-7 h-7 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center text-sm transition-colors"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <form onSubmit={handleStep1Submit} className="space-y-3.5 text-left">
            <div className="text-center space-y-1">
              <h3 className="text-base sm:text-xl font-black text-white leading-snug">
                Claim Your 1-on-1 Growth Consultation
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                Enter your details to reserve your custom revenue strategy session
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Full Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                placeholder="Enter your full name"
                value={contactInfo.fullName}
                onChange={(e) => setContactInfo({ ...contactInfo, fullName: e.target.value })}
                className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3.5 py-2.5 sm:py-3 text-sm text-white placeholder-zinc-500 shadow-inner outline-none transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Work Email <span className="text-amber-400">*</span>
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="name@company.com"
                value={contactInfo.email}
                onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                onBlur={handleEmailBlur}
                className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3.5 py-2.5 sm:py-3 text-sm text-white placeholder-zinc-500 shadow-inner outline-none transition-colors"
              />
            </div>

            {/* 10-digit Phone Number with Mobile Numeric Keypad */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                WhatsApp Phone Number <span className="text-amber-400">*</span>
              </label>
              <div className="flex items-center bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-inner focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400">
                <div className="flex items-center space-x-1 px-3 py-2.5 sm:py-3 bg-zinc-950 border-r border-zinc-800 text-xs sm:text-sm font-bold text-slate-300">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  pattern="[0-9]*"
                  maxLength={10}
                  required
                  placeholder="9876543210"
                  value={contactInfo.phone}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, "");
                    setContactInfo({ ...contactInfo, phone: onlyNums });
                    if (phoneError) setPhoneError(null);
                  }}
                  className="w-full px-3 py-2.5 sm:py-3 text-sm text-white bg-transparent placeholder-zinc-500 focus:outline-none font-mono tracking-wider"
                />
              </div>
              {phoneError && (
                <p className="text-red-400 font-bold text-xs mt-1 animate-pulse flex items-center space-x-1">
                  <span>⚠</span>
                  <span>{phoneError}</span>
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full cta-gold-btn shimmer rounded-2xl p-3.5 sm:p-4 text-center cursor-pointer shadow-xl hover:opacity-95 active:scale-[0.99] transition-all mt-4"
            >
              <div className="text-sm sm:text-base font-black text-slate-950 flex items-center justify-center space-x-2 uppercase tracking-wide">
                <span>CONTINUE TO SELECT SLOT</span>
                <i className="fa-solid fa-arrow-right text-xs sm:text-sm"></i>
              </div>
              <div className="text-[10px] sm:text-xs font-extrabold text-slate-900 mt-0.5">
                ⚡ 100% Free Strategy Session • No Sales Pitch
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
                {activeCampaign.subtitle}
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
              if (!currentQ) return null;
              return (
                <div className="space-y-4 pt-1">
                  <div className="text-sm sm:text-lg md:text-xl font-medium text-slate-100 flex items-start space-x-2">
                    <span className="text-amber-400 font-bold flex-shrink-0">{currentQ.num} ➔</span>
                    <span>{currentQ.question}</span>
                  </div>

                  <div className="space-y-2 pt-1 max-w-md">
                    {currentQ.options.map((opt) => {
                      const isSelected = qAnswers[currentQ.field] === opt.label;
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
                  onClick={handleStep2Submit}
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
              <div className="flex items-center justify-between text-xs font-extrabold text-white px-1">
                <button
                  type="button"
                  disabled={isPrevMonthDisabled}
                  onClick={handlePrevMonth}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-amber-400 flex items-center space-x-1 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <i className="fa-solid fa-chevron-left text-[10px]"></i>
                  <span>Prev</span>
                </button>

                <span className="text-sm font-black text-white tracking-wide bg-zinc-900/90 px-3 py-1 rounded-lg border border-zinc-800">
                  {MONTH_NAMES[currentMonthIndex]} {currentYear}
                </span>

                <button
                  type="button"
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

              {/* Accurate Calendar Day Grid with Past Date Prevention */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-mono font-bold">
                {[...Array(firstDayOfWeek)].map((_, emptyIdx) => (
                  <div key={`empty-${emptyIdx}`} className="p-1 sm:p-1.5" />
                ))}

                {[...Array(daysInMonth)].map((_, i) => {
                  const dayNum = i + 1;
                  const isSelected = selectedDay === dayNum;
                  const isPast = isPastDay(dayNum);

                  return (
                    <button
                      key={dayNum}
                      disabled={isPast}
                      onClick={() => setSelectedDay(dayNum)}
                      className={`p-1.5 sm:p-2 rounded-xl transition-all text-xs font-bold ${
                        isPast
                          ? "text-zinc-700 bg-zinc-900/30 cursor-not-allowed opacity-30 pointer-events-none line-through"
                          : isSelected
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

            {/* Time Slot Picker for Selected Date with Real-time Disabling & Past Slot Hiding */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span>📅 {formattedBookingDate}</span>
                <span className="text-amber-400 text-[10px] uppercase font-mono">Select Time Slot</span>
              </div>

              {/* Filter out slots that have already passed for the selected date */}
              {(() => {
                const activeSlots = DAILY_TIME_SLOTS.filter(
                  (time) => !isSlotTimePassed(time, selectedDay, currentMonthIndex, currentYear)
                );

                if (activeSlots.length === 0) {
                  return (
                    <div className="p-3 text-center rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5 my-1">
                      <p className="text-xs text-amber-400 font-bold flex items-center justify-center space-x-1">
                        <span>⏰</span>
                        <span>All time slots for today have passed.</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Please select tomorrow or an upcoming date from the calendar above.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                    {activeSlots.map((time) => {
                      const slotKey = sanitizeSlotKey(time);
                      const isBooked = bookedSlotsMap[slotKey] === true;

                      return (
                        <button
                          key={time}
                          disabled={isBooked}
                          onClick={() => handleSelectSlot(time)}
                          className={`w-full p-2.5 rounded-xl text-xs font-bold transition-all shadow ${
                            isBooked
                              ? "bg-zinc-800/80 border border-zinc-700 text-zinc-500 cursor-not-allowed line-through flex items-center justify-center space-x-1 opacity-60"
                              : "bg-amber-500 hover:bg-amber-400 text-slate-950 font-black hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-1"
                          }`}
                        >
                          <i className="fa-regular fa-clock text-[11px]"></i>
                          <span>{isBooked ? `${time} (Booked)` : time}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Final Success Confirmation & Back to Home Page */}
      {step === 4 && (
        <div className="bg-[#0c0c0f] text-white border border-emerald-500/40 w-full max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative text-center space-y-4 font-sans my-auto animate-toast-in">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center text-2xl sm:text-3xl mx-auto shadow-lg">
            ✓
          </div>

          <div>
            <h4 className="text-lg sm:text-xl font-black text-white">
              Appointment Slot Booked Successfully! 🎉
            </h4>
            <p className="text-xs text-amber-400 font-bold mt-1">
              {formattedBookingDate} at {selectedTimeSlot}
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 text-left text-xs text-slate-300 space-y-1 font-mono">
            <div><span className="text-slate-500">Name:</span> {contactInfo.fullName || "User"}</div>
            <div><span className="text-slate-500">Phone:</span> {contactInfo.countryCode} {contactInfo.phone || "N/A"}</div>
            <div><span className="text-slate-500">Campaign:</span> {activeCampaign.title}</div>
            <div><span className="text-slate-500">Booked Slot:</span> {formattedBookingDate} ({selectedTimeSlot})</div>
            {generatedMeetUrl && (
              <div className="pt-1.5 border-t border-zinc-800 text-indigo-300">
                <span className="text-slate-500 block">Google Meet Link:</span>
                <a href={generatedMeetUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline text-indigo-400 break-all hover:text-white">
                  🎥 {generatedMeetUrl}
                </a>
              </div>
            )}
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleReset}
            className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 sm:py-3.5 px-4 rounded-xl text-xs sm:text-sm uppercase tracking-wide shadow-xl transition-transform active:scale-98"
          >
            <i className="fa-brands fa-whatsapp mr-2 text-base"></i>
            Confirm Slot On WhatsApp & Go Home
          </a>

          <button
            onClick={handleReset}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors block"
          >
            Back to Home Page
          </button>
        </div>
      )}
    </div>
  );
}
