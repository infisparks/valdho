"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  getLeadsForDate,
  getMeetingsForDate,
  getAllMeetings,
  updateLeadStaffFields,
  sanitizeEmailToId,
  LeadData,
  StaffNote,
} from "@/lib/firebase";
import {
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { CAMPAIGNS } from "@/config/campaigns";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Pastel color palette for calendar meeting pills matching exact screenshot aesthetic
const PILL_COLORS = [
  { bg: "bg-[#dcfce7]", text: "text-[#166534]", border: "border-[#bbf7d0]" }, // Soft Emerald
  { bg: "bg-[#ffe4e6]", text: "text-[#9f1239]", border: "border-[#fecdd3]" }, // Soft Rose/Pink
  { bg: "bg-[#e0e7ff]", text: "text-[#3730a3]", border: "border-[#c7d2fe]" }, // Soft Purple/Indigo
  { bg: "bg-[#dbeafe]", text: "text-[#1e40af]", border: "border-[#bfdbfe]" }, // Soft Blue
  { bg: "bg-[#fef3c7]", text: "text-[#92400e]", border: "border-[#fde68a]" }, // Soft Amber
];

// Helper to format time string to short time like "9a" or "2p"
function formatShortTime(timeStr: string): string {
  if (!timeStr) return "";
  const clean = timeStr.trim();
  if (clean.includes("AM") || clean.includes("PM")) {
    const isPm = clean.includes("PM");
    const parts = clean.split(":");
    const hour = parseInt(parts[0], 10);
    return `${hour}${isPm ? "p" : "a"}`;
  }
  return clean;
}

export default function CRMPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // CRM Dashboard State
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"leads" | "meetings" | "calendar">("leads");

  // Data State
  const [leadsList, setLeadsList] = useState<LeadData[]>([]);
  const [meetingsList, setMeetingsList] = useState<any[]>([]);
  const [allMeetingsList, setAllMeetingsList] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Mobile Sidebar State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Right Drawer State
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [followUpDateInput, setFollowUpDateInput] = useState("");
  const [isSavingStaffData, setIsSavingStaffData] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Calendar View State
  const [calYear, setCalYear] = useState<number>(today.getFullYear());
  const [calMonthIndex, setCalMonthIndex] = useState<number>(today.getMonth());
  const [calViewMode, setCalViewMode] = useState<"month" | "week">("month");

  // Check Auth State on mount; redirect to /login if not authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login?redirect=/crms");
      } else {
        setCurrentUser(user);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch Dashboard & Calendar Data
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsDataLoading(true);
    try {
      const [fetchedLeads, fetchedMeetings, fetchedAllMeetings] = await Promise.all([
        getLeadsForDate(selectedDate, selectedCampaign),
        getMeetingsForDate(selectedDate, selectedCampaign),
        getAllMeetings(selectedCampaign),
      ]);
      setLeadsList(fetchedLeads);
      setMeetingsList(fetchedMeetings);
      setAllMeetingsList(fetchedAllMeetings);
    } catch (err) {
      console.error("CRM Data Fetch Error:", err);
    } finally {
      setIsDataLoading(false);
    }
  }, [currentUser, selectedDate, selectedCampaign]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  // Open & Close Drawer Handlers
  const handleOpenDrawer = (lead: LeadData | any) => {
    setSelectedLead(lead);
    setFollowUpDateInput(lead.followUpDate || "");
    setNewNoteText("");
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedLead(null);
  };

  // Staff Action: Add new note to current lead
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !newNoteText.trim()) return;

    setIsSavingStaffData(true);

    const targetLeadId = selectedLead.id || (selectedLead.email ? sanitizeEmailToId(selectedLead.email) : "lead_" + Date.now());
    const targetCreatedDate = selectedLead.createdDate || selectedDate;
    const targetCampaign = selectedLead.campaign || "firstoptionagency";

    const newNoteObj: StaffNote = {
      id: "note_" + Date.now(),
      text: newNoteText.trim(),
      createdAt: new Date().toISOString(),
      author: currentUser?.email ? currentUser.email.split("@")[0] : "Staff",
    };

    const updatedNotes = [...(selectedLead.notes || []), newNoteObj];

    const success = await updateLeadStaffFields(
      targetLeadId,
      targetCreatedDate,
      { notes: updatedNotes, followUpDate: followUpDateInput || selectedLead.followUpDate },
      targetCampaign
    );

    if (success) {
      const updatedLead = {
        ...selectedLead,
        notes: updatedNotes,
        followUpDate: followUpDateInput || selectedLead.followUpDate,
      };
      setSelectedLead(updatedLead);
      setLeadsList((prev) =>
        prev.map((l) => ((l.id === targetLeadId || l.email === selectedLead.email) ? updatedLead : l))
      );
      setMeetingsList((prev) =>
        prev.map((m) =>
          (m.leadId === targetLeadId || m.email === selectedLead.email)
            ? { ...m, notes: updatedNotes, followUpDate: updatedLead.followUpDate }
            : m
        )
      );
      setAllMeetingsList((prev) =>
        prev.map((m) =>
          (m.leadId === targetLeadId || m.email === selectedLead.email)
            ? { ...m, notes: updatedNotes, followUpDate: updatedLead.followUpDate }
            : m
        )
      );
      setNewNoteText("");
    }
    setIsSavingStaffData(false);
  };

  // Staff Action: Save or update Follow-up Date
  const handleSaveFollowUpDate = async (dateVal: string) => {
    if (!selectedLead) return;
    setFollowUpDateInput(dateVal);
    setIsSavingStaffData(true);

    const targetLeadId = selectedLead.id || (selectedLead.email ? sanitizeEmailToId(selectedLead.email) : "lead_" + Date.now());
    const targetCreatedDate = selectedLead.createdDate || selectedDate;
    const targetCampaign = selectedLead.campaign || "firstoptionagency";

    const success = await updateLeadStaffFields(
      targetLeadId,
      targetCreatedDate,
      { notes: selectedLead.notes || [], followUpDate: dateVal },
      targetCampaign
    );

    if (success) {
      const updatedLead = { ...selectedLead, followUpDate: dateVal };
      setSelectedLead(updatedLead);
      setLeadsList((prev) =>
        prev.map((l) => ((l.id === targetLeadId || l.email === selectedLead.email) ? updatedLead : l))
      );
      setMeetingsList((prev) =>
        prev.map((m) =>
          (m.leadId === targetLeadId || m.email === selectedLead.email)
            ? { ...m, followUpDate: dateVal }
            : m
        )
      );
      setAllMeetingsList((prev) =>
        prev.map((m) =>
          (m.leadId === targetLeadId || m.email === selectedLead.email)
            ? { ...m, followUpDate: dateVal }
            : m
        )
      );
    }
    setIsSavingStaffData(false);
  };

  // Copy helper for links
  const handleCopyLink = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Filtered Leads
  const filteredLeads = leadsList.filter((lead) => {
    const matchesSearch =
      (lead.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.phone || "").includes(searchQuery) ||
      (lead.email || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ? true : lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const totalLeadsCount = leadsList.length;
  const partialLeadsCount = leadsList.filter((l) => l.status === "partial").length;
  const surveyCompletedCount = leadsList.filter(
    (l) => l.status === "survey_completed" || l.status === "completed" || (l.survey && Object.keys(l.survey).length > 0)
  ).length;
  const bookedMeetingsCount = leadsList.filter(
    (l) => l.status === "completed" || !!l.meeting?.meetingDate
  ).length;
  const todayMeetingsScheduled = meetingsList.length;

  // Funnel Percentages
  const surveyPct = totalLeadsCount > 0 ? Math.round((surveyCompletedCount / totalLeadsCount) * 100) : 0;
  const bookedPct = totalLeadsCount > 0 ? Math.round((bookedMeetingsCount / totalLeadsCount) * 100) : 0;

  // CALENDAR NAVIGATION HELPERS
  const handlePrevCalMonth = () => {
    if (calMonthIndex > 0) {
      setCalMonthIndex(calMonthIndex - 1);
    } else {
      setCalMonthIndex(11);
      setCalYear(calYear - 1);
    }
  };

  const handleNextCalMonth = () => {
    if (calMonthIndex < 11) {
      setCalMonthIndex(calMonthIndex + 1);
    } else {
      setCalMonthIndex(0);
      setCalYear(calYear + 1);
    }
  };

  const handleTodayCalMonth = () => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonthIndex(now.getMonth());
  };

  // Build Calendar Month Days Matrix
  const daysInCalMonth = new Date(calYear, calMonthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonthIndex, 1).getDay(); // 0 = Sun
  const prevMonthLastDay = new Date(calYear, calMonthIndex, 0).getDate();

  // Create array of 35 or 42 grid cells
  const calGridCells: Array<{
    dayNum: number;
    monthOffset: -1 | 0 | 1;
    dateStr: string;
    isToday: boolean;
  }> = [];

  // 1. Prev month padding days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dNum = prevMonthLastDay - i;
    const pMonthIndex = calMonthIndex === 0 ? 11 : calMonthIndex - 1;
    const pYear = calMonthIndex === 0 ? calYear - 1 : calYear;
    const mStr = (pMonthIndex + 1).toString().padStart(2, "0");
    const dStr = dNum.toString().padStart(2, "0");
    const dateStr = `${pYear}-${mStr}-${dStr}`;

    calGridCells.push({
      dayNum: dNum,
      monthOffset: -1,
      dateStr,
      isToday: dateStr === todayStr,
    });
  }

  // 2. Current month days
  for (let d = 1; d <= daysInCalMonth; d++) {
    const mStr = (calMonthIndex + 1).toString().padStart(2, "0");
    const dStr = d.toString().padStart(2, "0");
    const dateStr = `${calYear}-${mStr}-${dStr}`;

    calGridCells.push({
      dayNum: d,
      monthOffset: 0,
      dateStr,
      isToday: dateStr === todayStr,
    });
  }

  // 3. Next month padding days to complete 35 or 42 cells
  const remainingCells = 35 - calGridCells.length > 0 ? 35 - calGridCells.length : (42 - calGridCells.length > 0 ? 42 - calGridCells.length : 0);
  for (let n = 1; n <= remainingCells; n++) {
    const nMonthIndex = calMonthIndex === 11 ? 0 : calMonthIndex + 1;
    const nYear = calMonthIndex === 11 ? calYear + 1 : calYear;
    const mStr = (nMonthIndex + 1).toString().padStart(2, "0");
    const dStr = n.toString().padStart(2, "0");
    const dateStr = `${nYear}-${mStr}-${dStr}`;

    calGridCells.push({
      dayNum: n,
      monthOffset: 1,
      dateStr,
      isToday: dateStr === todayStr,
    });
  }

  // Group all meetings by meetingDate YYYY-MM-DD
  const meetingsByDateMap: Record<string, any[]> = {};
  allMeetingsList.forEach((m) => {
    if (m.meetingDate) {
      if (!meetingsByDateMap[m.meetingDate]) {
        meetingsByDateMap[m.meetingDate] = [];
      }
      meetingsByDateMap[m.meetingDate].push(m);
    }
  });

  if (authLoading || !currentUser) {
    return (
      <div className="w-full min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-indigo-600 font-bold text-sm">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
          <span>Redirecting to Admin Login...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-slate-900 font-sans flex flex-col md:flex-row antialiased relative">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-4 transition-transform duration-200 transform ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center space-x-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow">
              FO
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                First Option CRM
              </h2>
              <span className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">
                Executive Portal
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            <button
              onClick={() => {
                setActiveTab("leads");
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                activeTab === "leads"
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <i className="fa-solid fa-chart-line text-sm"></i>
              <span>Dashboard & Leads</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("meetings");
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                activeTab === "meetings"
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <i className="fa-solid fa-calendar-check text-sm"></i>
              <span>Scheduled Meetings</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("calendar");
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                activeTab === "calendar"
                  ? "bg-indigo-50 text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <i className="fa-solid fa-calendar-days text-sm text-indigo-600"></i>
              <span>Meetings Calendar</span>
            </button>

            <div className="pt-4 border-t border-slate-100 px-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Upcoming Modules
              </span>
            </div>

            {["Campaigns", "WhatsApp Automated", "Analytics", "Settings"].map((mod) => (
              <div
                key={mod}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 opacity-60 cursor-not-allowed"
              >
                <span>{mod}</span>
                <span className="text-[9px] bg-slate-100 text-slate-500 font-mono px-1.5 py-0.5 rounded">
                  Soon
                </span>
              </div>
            ))}
          </nav>
        </div>

        {/* User Footer & Logout */}
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <div className="flex items-center space-x-2.5 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
              {currentUser.email?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="truncate text-left">
              <p className="text-xs font-bold text-slate-900 truncate">
                Admin
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {currentUser.email}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 text-xs font-bold text-red-600 hover:bg-red-50 py-2 rounded-xl transition-colors"
          >
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F5F6F8]">
        {/* Responsive Header */}
        <header className="bg-white border-b border-slate-200 px-3 py-2.5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 z-30 shadow-sm gap-2">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center space-x-2.5">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 flex items-center justify-center md:hidden"
              >
                <i className="fa-solid fa-bars"></i>
              </button>

              <div>
                <h1 className="text-sm sm:text-lg font-bold text-slate-900">
                  {activeTab === "calendar" ? "Meetings Calendar" : "Executive CRM"}
                </h1>
                <p className="text-[10px] sm:text-[11px] text-slate-500 hidden sm:block">
                  {activeTab === "calendar"
                    ? "Interactive visual calendar dashboard for managing all client appointments"
                    : "Real-time tracking of leads, survey qualifications, and booked strategy meetings"}
                </p>
              </div>
            </div>

            {/* Mobile Refresh Button */}
            <button
              onClick={fetchData}
              disabled={isDataLoading}
              className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-bold hover:bg-indigo-100 flex items-center justify-center sm:hidden"
            >
              <i className={`fa-solid fa-rotate-right ${isDataLoading ? "fa-spin" : ""}`}></i>
            </button>
          </div>

          {/* Filters & Controls */}
          <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {activeTab !== "calendar" && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-600 flex-1 sm:flex-none"
              />
            )}

            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-600 flex-1 sm:flex-none"
            >
              <option value="all">All Campaigns</option>
              {Object.keys(CAMPAIGNS).map((key) => (
                <option key={key} value={key}>
                  {CAMPAIGNS[key].title}
                </option>
              ))}
            </select>

            <button
              onClick={fetchData}
              disabled={isDataLoading}
              className="hidden sm:flex px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-bold hover:bg-indigo-100 items-center justify-center space-x-1.5 transition-colors"
            >
              <i className={`fa-solid fa-rotate-right ${isDataLoading ? "fa-spin" : ""}`}></i>
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="p-3 sm:p-6 space-y-4 sm:space-y-6 w-full max-w-full">
          {/* TAB 3: DIRECT FULL-WIDTH MEETINGS CALENDAR (WITH MONTH & WEEK VIEWS) */}
          {activeTab === "calendar" ? (
            <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-sm p-4 sm:p-6 space-y-4 font-sans">
              {/* Calendar Top Header Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                {/* Left: Title & Events Count */}
                <div className="flex items-center space-x-3">
                  <div>
                    <h2 className="text-base sm:text-xl font-extrabold text-slate-900">
                      Meetings Calendar
                    </h2>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-xs font-bold text-slate-500">Calendar View</span>
                      <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {allMeetingsList.length} EVENTS
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle: Month & Year Navigator */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={handlePrevCalMonth}
                      className="w-8 h-8 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs transition-colors shadow-2xs"
                    >
                      <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    <button
                      onClick={handleNextCalMonth}
                      className="w-8 h-8 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs transition-colors shadow-2xs"
                    >
                      <i className="fa-solid fa-chevron-right"></i>
                    </button>
                  </div>

                  <button
                    onClick={handleTodayCalMonth}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors shadow-2xs"
                  >
                    Today
                  </button>

                  <h3 className="text-sm sm:text-lg font-bold text-slate-900 font-mono pl-1">
                    {MONTH_NAMES[calMonthIndex]} {calYear}
                  </h3>
                </div>

                {/* Right: View Switcher Toggle (Month / Week) */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold self-end sm:self-auto">
                  <button
                    onClick={() => setCalViewMode("month")}
                    className={`px-3.5 py-1 rounded-lg transition-all ${
                      calViewMode === "month"
                        ? "bg-white text-indigo-600 shadow-sm font-extrabold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setCalViewMode("week")}
                    className={`px-3.5 py-1 rounded-lg transition-all ${
                      calViewMode === "week"
                        ? "bg-white text-indigo-600 shadow-sm font-extrabold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Week
                  </button>
                </div>
              </div>

              {/* MONTH VIEW GRID */}
              {calViewMode === "month" && (
                <div className="space-y-1.5">
                  {/* Days of Week Header */}
                  <div className="grid grid-cols-7 border-b border-slate-200 text-center py-2 text-[10px] sm:text-xs font-extrabold text-slate-400 tracking-wider bg-slate-50 rounded-xl">
                    <span>SUN</span>
                    <span>MON</span>
                    <span>TUE</span>
                    <span>WED</span>
                    <span>THU</span>
                    <span>FRI</span>
                    <span>SAT</span>
                  </div>

                  {/* 35/42 Grid Cells */}
                  <div className="grid grid-cols-7 border-l border-t border-slate-200 bg-slate-100 rounded-xl overflow-hidden gap-[1px]">
                    {calGridCells.map((cell, idx) => {
                      const dayMeetings = meetingsByDateMap[cell.dateStr] || [];
                      const isCurrentMonth = cell.monthOffset === 0;

                      return (
                        <div
                          key={idx}
                          className={`bg-white min-h-[95px] sm:min-h-[125px] p-1.5 flex flex-col justify-between transition-colors relative ${
                            !isCurrentMonth ? "bg-slate-50/60" : "hover:bg-indigo-50/20"
                          }`}
                        >
                          {/* Day Number Header */}
                          <div className="flex items-center justify-end pr-1 pt-0.5">
                            <span
                              className={`text-xs font-mono font-bold ${
                                cell.isToday
                                  ? "w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm"
                                  : isCurrentMonth
                                  ? "text-slate-700"
                                  : "text-slate-300"
                              }`}
                            >
                              {cell.dayNum}
                            </span>
                          </div>

                          {/* Meetings List Pills on Cell */}
                          <div className="space-y-1 my-auto">
                            {dayMeetings.slice(0, 2).map((m, mIdx) => {
                              const colorTheme = PILL_COLORS[mIdx % PILL_COLORS.length];
                              const shortTime = formatShortTime(m.meetingTime);

                              return (
                                <div
                                  key={mIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDrawer(m);
                                  }}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${colorTheme.bg} ${colorTheme.text} ${colorTheme.border} truncate cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-between shadow-2xs`}
                                  title={`${m.fullName} - ${m.meetingTime}`}
                                >
                                  <span className="truncate max-w-[70px] sm:max-w-[120px]">
                                    {m.fullName}
                                  </span>
                                  <span className="font-mono text-[9px] opacity-80 pl-1 flex-shrink-0">
                                    {shortTime}
                                  </span>
                                </div>
                              );
                            })}

                            {dayMeetings.length > 2 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrawer(dayMeetings[2]);
                                }}
                                className="text-[9px] font-extrabold text-indigo-600 hover:underline block text-left px-1 py-0.5 font-mono"
                              >
                                +{dayMeetings.length - 2} more
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* WEEK VIEW GRID */}
              {calViewMode === "week" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500 font-semibold">
                      Full appointment schedule for the active week across daily time slots:
                    </p>
                    <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold">
                      Week Schedule
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                        <tr>
                          <th className="p-3 border-r border-slate-200">Slot Time</th>
                          <th className="p-3">Client Info</th>
                          <th className="p-3">Appointment Date</th>
                          <th className="p-3">Campaign</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {allMeetingsList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                              No meeting appointments found.
                            </td>
                          </tr>
                        ) : (
                          allMeetingsList.map((m, mIdx) => (
                            <tr
                              key={mIdx}
                              onClick={() => handleOpenDrawer(m)}
                              className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                            >
                              <td className="p-3 border-r border-slate-100 font-bold text-indigo-600 font-mono">
                                {m.meetingTime}
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{m.fullName}</div>
                                <div className="text-[11px] text-slate-400">{m.email}</div>
                              </td>
                              <td className="p-3 font-mono text-slate-700 font-bold">
                                {m.meetingDate}
                              </td>
                              <td className="p-3">
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {m.campaign || "firstoptionagency"}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                                  Booked
                                </span>
                              </td>
                              <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleOpenDrawer(m)}
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 text-[10px] font-bold px-3 py-1 rounded-lg transition-colors"
                                >
                                  View Details & Notes
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 1. KEY METRICS CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] sm:text-xs font-bold truncate">Total Leads</span>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs flex-shrink-0">
                      <i className="fa-solid fa-users"></i>
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold text-slate-900">{totalLeadsCount}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Date: {selectedDate}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] sm:text-xs font-bold text-amber-700 truncate">Partial Leads</span>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs flex-shrink-0">
                      <i className="fa-solid fa-hourglass-half"></i>
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold text-amber-600">{partialLeadsCount}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Need survey link</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] sm:text-xs font-bold text-blue-700 truncate">Survey Done</span>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs flex-shrink-0">
                      <i className="fa-solid fa-clipboard-check"></i>
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold text-blue-600">{surveyCompletedCount}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Survey completed</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] sm:text-xs font-bold text-emerald-700 truncate">Meetings</span>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs flex-shrink-0">
                      <i className="fa-solid fa-calendar-day"></i>
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold text-emerald-600">{todayMeetingsScheduled}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Call appointments</p>
                </div>
              </div>

              {/* 2. VISUAL LEAD ACQUISITION FUNNEL */}
              <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      Lead Acquisition Conversion Funnel
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-500">
                      Customer journey conversion rate from form to booked meeting
                    </p>
                  </div>

                  <span className="text-[10px] sm:text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                    {bookedPct}% Conversion
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>1. Contact Form</span>
                      <span className="text-indigo-600 font-mono">{totalLeadsCount} Leads</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2 overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full w-full" />
                    </div>
                    <div className="text-[9px] text-slate-400">100% captured</div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>2. Survey Done</span>
                      <span className="text-blue-600 font-mono">{surveyCompletedCount} Leads</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${surveyPct}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-400">{surveyPct}% completion rate</div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>3. Growth Call</span>
                      <span className="text-emerald-600 font-mono">{bookedMeetingsCount} Meetings</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${bookedPct}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-400">{bookedPct}% final conversion</div>
                  </div>
                </div>
              </div>

              {/* 3. TABBED DATA CONTAINER */}
              <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
                {/* Table Navigation Header */}
                <div className="px-3 py-2.5 sm:px-6 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50/50">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setActiveTab("leads")}
                      className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-center ${
                        activeTab === "leads"
                          ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Leads ({totalLeadsCount})
                    </button>

                    <button
                      onClick={() => setActiveTab("meetings")}
                      className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-center ${
                        activeTab === "meetings"
                          ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Meetings ({todayMeetingsScheduled})
                    </button>
                  </div>

                  {/* Filters for Leads */}
                  {activeTab === "leads" && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Search name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-white border border-slate-300 rounded-xl px-3 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 flex-1 sm:w-48"
                      />

                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-800 font-semibold focus:outline-none"
                      >
                        <option value="all">All</option>
                        <option value="partial">Partial</option>
                        <option value="survey_completed">Survey</option>
                        <option value="completed">Booked</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* TAB 1: LEADS CONTENT */}
                {activeTab === "leads" && (
                  <div>
                    {filteredLeads.length === 0 ? (
                      <div className="p-8 text-center space-y-2">
                        <i className="fa-solid fa-inbox text-3xl text-slate-300"></i>
                        <p className="text-xs text-slate-500 font-bold">
                          No leads generated for {selectedDate}
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* MOBILE CARD VIEW FOR LEADS */}
                        <div className="block md:hidden divide-y divide-slate-100">
                          {filteredLeads.map((lead) => {
                            const whatsappSurveyUrl = `https://api.whatsapp.com/send?phone=${
                              lead.countryCode ? lead.countryCode.replace("+", "") : "91"
                            }${lead.phone}&text=${encodeURIComponent(
                              `Hi ${lead.fullName || "there"}, thanks for requesting a consultation with First Option Agency! Please complete your 30-second business survey here to lock your call: ${
                                lead.links?.surveyUrl || `${window.location.origin}/?step=survey&leadId=${lead.id}&createdDate=${lead.createdDate}`
                              }`
                            )}`;

                            const isSurveyDone =
                              lead.status === "survey_completed" || lead.status === "completed" || (lead.survey && Object.keys(lead.survey).length > 0);
                            const isMeetingDone = lead.status === "completed" || !!lead.meeting?.meetingDate;

                            return (
                              <div
                                key={lead.id}
                                onClick={() => handleOpenDrawer(lead)}
                                className="p-3.5 space-y-2.5 bg-white hover:bg-indigo-50/30 transition-colors cursor-pointer"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center space-x-2.5 truncate">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-sm flex-shrink-0">
                                      {lead.fullName?.charAt(0).toUpperCase() || "L"}
                                    </div>
                                    <div className="truncate">
                                      <h4 className="text-sm font-bold text-slate-900 truncate leading-snug">
                                        {lead.fullName || "Anonymous"}
                                      </h4>
                                      <p className="text-[11px] text-slate-400 truncate">{lead.email}</p>
                                    </div>
                                  </div>

                                  <span
                                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] flex-shrink-0 ${
                                      lead.status === "completed"
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                        : lead.status === "survey_completed"
                                        ? "bg-blue-100 text-blue-800 border border-blue-300"
                                        : "bg-amber-100 text-amber-800 border border-amber-300"
                                    }`}
                                  >
                                    {lead.status === "completed"
                                      ? "Call Booked"
                                      : lead.status === "survey_completed"
                                      ? "Survey Done"
                                      : "Partial"}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-1 text-[10px] font-bold flex-wrap gap-y-1">
                                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded">
                                    ✓ Detail
                                  </span>
                                  <span className="text-slate-300 font-mono">›</span>
                                  <span
                                    className={`px-2 py-0.5 rounded ${
                                      isSurveyDone
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                        : "bg-red-100 text-red-700 border border-red-300"
                                    }`}
                                  >
                                    {isSurveyDone ? "✓ Survey" : "✗ Survey"}
                                  </span>
                                  <span className="text-slate-300 font-mono">›</span>
                                  <span
                                    className={`px-2 py-0.5 rounded ${
                                      isMeetingDone
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                        : "bg-red-100 text-red-700 border border-red-300"
                                    }`}
                                  >
                                    {isMeetingDone ? "✓ Meeting" : "✗ Meeting"}
                                  </span>
                                </div>

                                {(lead.followUpDate || (lead.notes && lead.notes.length > 0)) && (
                                  <div className="flex items-center space-x-2 pt-0.5 flex-wrap gap-1">
                                    {lead.followUpDate && (
                                      <div className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 w-fit flex items-center space-x-1">
                                        <i className="fa-regular fa-calendar text-[10px]"></i>
                                        <span>Follow-up: {lead.followUpDate}</span>
                                      </div>
                                    )}

                                    {lead.notes && lead.notes.length > 0 && (
                                      <div className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit flex items-center space-x-1">
                                        <i className="fa-solid fa-note-sticky text-amber-500 text-[10px]"></i>
                                        <span>{lead.notes.length} Staff Note{lead.notes.length > 1 ? "s" : ""}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                                  <a
                                    href={`tel:${lead.countryCode || "+91"}${lead.phone}`}
                                    className="flex items-center justify-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-1.5 rounded-xl text-[11px] font-bold transition-colors border border-slate-200"
                                  >
                                    <i className="fa-solid fa-phone text-xs text-indigo-600"></i>
                                    <span>Call</span>
                                  </a>

                                  {lead.status === "partial" ? (
                                    <a
                                      href={whatsappSurveyUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-xl text-[11px] font-bold transition-colors shadow-sm"
                                    >
                                      <i className="fa-brands fa-whatsapp text-xs"></i>
                                      <span>Send Survey</span>
                                    </a>
                                  ) : (
                                    <a
                                      href={`https://api.whatsapp.com/send?phone=${lead.countryCode ? lead.countryCode.replace("+", "") : "91"}${lead.phone}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-xl text-[11px] font-bold transition-colors shadow-sm"
                                    >
                                      <i className="fa-brands fa-whatsapp text-xs"></i>
                                      <span>WhatsApp</span>
                                    </a>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleOpenDrawer(lead)}
                                    className="flex items-center justify-center space-x-1 bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-xl text-[11px] font-bold transition-colors shadow-sm"
                                  >
                                    <span>Details</span>
                                    <i className="fa-solid fa-chevron-right text-[10px]"></i>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* DESKTOP TABLE VIEW FOR LEADS */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Lead Info</th>
                                <th className="px-4 py-3">Mobile Number</th>
                                <th className="px-4 py-3">Step Progress & Remarks</th>
                                <th className="px-4 py-3">Survey Responses</th>
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3 text-right">Quick Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {filteredLeads.map((lead) => {
                                const whatsappSurveyUrl = `https://api.whatsapp.com/send?phone=${
                                  lead.countryCode ? lead.countryCode.replace("+", "") : "91"
                                }${lead.phone}&text=${encodeURIComponent(
                                  `Hi ${lead.fullName || "there"}, thanks for requesting a consultation with First Option Agency! Please complete your 30-second business survey here to lock your call: ${
                                    lead.links?.surveyUrl || `${window.location.origin}/?step=survey&leadId=${lead.id}&createdDate=${lead.createdDate}`
                                  }`
                                )}`;

                                const isSurveyDone =
                                  lead.status === "survey_completed" || lead.status === "completed" || (lead.survey && Object.keys(lead.survey).length > 0);
                                const isMeetingDone = lead.status === "completed" || !!lead.meeting?.meetingDate;

                                return (
                                  <tr
                                    key={lead.id}
                                    onClick={() => handleOpenDrawer(lead)}
                                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                                  >
                                    <td className="px-4 py-3">
                                      <div className="font-bold text-slate-900 group-hover:text-indigo-600 flex items-center space-x-1.5">
                                        <span>{lead.fullName || "Anonymous"}</span>
                                        <i className="fa-solid fa-chevron-right text-[10px] text-slate-300 group-hover:text-indigo-600 transition-colors"></i>
                                      </div>
                                      <div className="text-[11px] text-slate-400">{lead.email}</div>
                                    </td>

                                    <td className="px-4 py-3 font-mono font-semibold">
                                      {lead.countryCode} {lead.phone}
                                    </td>

                                    <td className="px-4 py-3">
                                      <div className="flex flex-col space-y-1">
                                        <div className="flex items-center space-x-1 text-[11px] font-bold flex-wrap gap-y-1">
                                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center space-x-1">
                                            <span>✓ Fill Detail</span>
                                          </span>

                                          <span className="text-slate-300 font-mono">›</span>

                                          {isSurveyDone ? (
                                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center space-x-1">
                                              <span>✓ Fill Survey</span>
                                            </span>
                                          ) : (
                                            <span className="bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded-md flex items-center space-x-1">
                                              <span>✗ Fill Survey</span>
                                            </span>
                                          )}

                                          <span className="text-slate-300 font-mono">›</span>

                                          {isMeetingDone ? (
                                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center space-x-1 shadow-sm">
                                              <i className="fa-regular fa-calendar-check text-[10px]"></i>
                                              <span>
                                                ✓ Booked Meeting{" "}
                                                {lead.meeting?.meetingDate && lead.meeting?.meetingTime
                                                  ? `(${lead.meeting.meetingDate} @ ${lead.meeting.meetingTime})`
                                                  : ""}
                                              </span>
                                            </span>
                                          ) : (
                                            <span className="bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded-md flex items-center space-x-1">
                                              <span>✗ Booked Meeting</span>
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center space-x-2 pt-0.5 flex-wrap gap-1">
                                          {lead.followUpDate && (
                                            <div className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 w-fit flex items-center space-x-1">
                                              <i className="fa-regular fa-calendar text-[10px]"></i>
                                              <span>Follow-up: {lead.followUpDate}</span>
                                            </div>
                                          )}

                                          {lead.notes && lead.notes.length > 0 && (
                                            <div className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit flex items-center space-x-1">
                                              <i className="fa-solid fa-note-sticky text-amber-500 text-[10px]"></i>
                                              <span>{lead.notes.length} Staff Note{lead.notes.length > 1 ? "s" : ""}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    <td className="px-4 py-3 max-w-xs">
                                      {lead.survey ? (
                                        <div className="space-y-0.5 text-[11px]">
                                          {Object.keys(lead.survey).map((key) => (
                                            <div key={key} className="truncate">
                                              <span className="text-slate-400 capitalize">{key}:</span>{" "}
                                              <span className="font-bold text-slate-800">{lead.survey![key]}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 italic">No survey filled</span>
                                      )}
                                    </td>

                                    <td className="px-4 py-3 text-slate-500 text-[11px] font-mono">
                                      {lead.updatedAt ? new Date(lead.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A"}
                                    </td>

                                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-end space-x-2">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenDrawer(lead)}
                                          className="inline-flex items-center space-x-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors border border-indigo-200"
                                        >
                                          <i className="fa-solid fa-sidebar text-xs"></i>
                                          <span>Details & Notes</span>
                                        </button>

                                        {lead.status === "partial" ? (
                                          <a
                                            href={whatsappSurveyUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shadow-sm"
                                          >
                                            <i className="fa-brands fa-whatsapp text-xs"></i>
                                            <span>Send Survey</span>
                                          </a>
                                        ) : (
                                          <a
                                            href={`https://api.whatsapp.com/send?phone=${lead.countryCode ? lead.countryCode.replace("+", "") : "91"}${lead.phone}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors"
                                          >
                                            <i className="fa-brands fa-whatsapp text-emerald-600"></i>
                                            <span>Chat</span>
                                          </a>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* TAB 2: MEETINGS CONTENT */}
                {activeTab === "meetings" && (
                  <div>
                    {meetingsList.length === 0 ? (
                      <div className="p-8 text-center space-y-2">
                        <i className="fa-solid fa-calendar-xmark text-3xl text-slate-300"></i>
                        <p className="text-xs text-slate-500 font-bold">
                          No meetings scheduled for {selectedDate}
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* MOBILE CARD VIEW FOR MEETINGS */}
                        <div className="block md:hidden divide-y divide-slate-100">
                          {meetingsList.map((m, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleOpenDrawer(m)}
                              className="p-3.5 space-y-2.5 bg-white hover:bg-indigo-50/30 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className="bg-indigo-100 text-indigo-900 font-black px-2.5 py-0.5 rounded-lg text-xs border border-indigo-200">
                                  🕒 {m.meetingTime}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono font-bold">
                                  📅 {m.meetingDate}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-sm flex-shrink-0">
                                  {m.fullName?.charAt(0).toUpperCase() || "M"}
                                </div>
                                <div className="truncate">
                                  <h4 className="text-sm font-bold text-slate-900 truncate leading-snug">{m.fullName}</h4>
                                  <p className="text-[11px] text-slate-400 truncate">{m.email}</p>
                                </div>
                              </div>

                              {(m.followUpDate || (m.notes && m.notes.length > 0)) && (
                                <div className="flex items-center space-x-2 pt-0.5 flex-wrap gap-1">
                                  {m.followUpDate && (
                                    <div className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 w-fit flex items-center space-x-1">
                                      <i className="fa-regular fa-calendar text-[10px]"></i>
                                      <span>Follow-up: {m.followUpDate}</span>
                                    </div>
                                  )}

                                  {m.notes && m.notes.length > 0 && (
                                    <div className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit flex items-center space-x-1">
                                      <i className="fa-solid fa-note-sticky text-amber-500 text-[10px]"></i>
                                      <span>{m.notes.length} Staff Note{m.notes.length > 1 ? "s" : ""}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="grid grid-cols-3 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                                <a
                                  href={`tel:${m.countryCode || "+91"}${m.phone}`}
                                  className="flex items-center justify-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-1.5 rounded-xl text-[11px] font-bold transition-colors border border-slate-200"
                                >
                                  <i className="fa-solid fa-phone text-xs text-indigo-600"></i>
                                  <span>Call</span>
                                </a>

                                <a
                                  href={`https://api.whatsapp.com/send?phone=${
                                    m.countryCode ? m.countryCode.replace("+", "") : "91"
                                  }${m.phone}&text=${encodeURIComponent(
                                    `Hi ${m.fullName}, reminder for our Strategy Call scheduled on ${m.meetingDate} at ${m.meetingTime}.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-xl text-[11px] font-bold transition-colors shadow-sm"
                                >
                                  <i className="fa-brands fa-whatsapp text-xs"></i>
                                  <span>Reminder</span>
                                </a>

                                <button
                                  type="button"
                                  onClick={() => handleOpenDrawer(m)}
                                  className="flex items-center justify-center space-x-1 bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-xl text-[11px] font-bold transition-colors shadow-sm"
                                >
                                  <span>Details</span>
                                  <i className="fa-solid fa-chevron-right text-[10px]"></i>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* DESKTOP TABLE VIEW FOR MEETINGS */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Time Slot</th>
                                <th className="px-4 py-3">Client Info</th>
                                <th className="px-4 py-3">Mobile Number</th>
                                <th className="px-4 py-3">Campaign & Staff Remarks</th>
                                <th className="px-4 py-3">Survey Profile</th>
                                <th className="px-4 py-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {meetingsList.map((m, idx) => (
                                <tr
                                  key={idx}
                                  onClick={() => handleOpenDrawer(m)}
                                  className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                                >
                                  <td className="px-4 py-3">
                                    <div className="space-y-0.5">
                                      <span className="bg-indigo-100 text-indigo-900 font-black px-2.5 py-1 rounded-lg text-xs border border-indigo-200 block w-fit">
                                        {m.meetingTime}
                                      </span>
                                      <div className="text-[10px] text-slate-500 font-mono font-bold">
                                        {m.meetingDate}
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-4 py-3">
                                    <div className="font-bold text-slate-900 group-hover:text-indigo-600 flex items-center space-x-1">
                                      <span>{m.fullName}</span>
                                      <i className="fa-solid fa-chevron-right text-[10px] text-slate-300 group-hover:text-indigo-600 transition-colors"></i>
                                    </div>
                                    <div className="text-[11px] text-slate-400">{m.email}</div>
                                  </td>

                                  <td className="px-4 py-3 font-mono font-semibold">
                                    {m.countryCode} {m.phone}
                                  </td>

                                  <td className="px-4 py-3 space-y-1">
                                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold block w-fit">
                                      {m.campaign || "firstoptionagency"}
                                    </span>

                                    {m.followUpDate && (
                                      <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 w-fit flex items-center space-x-1">
                                        <i className="fa-regular fa-calendar"></i>
                                        <span>Follow-up: {m.followUpDate}</span>
                                      </div>
                                    )}

                                    {m.notes && m.notes.length > 0 && (
                                      <div className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit flex items-center space-x-1">
                                        <i className="fa-solid fa-note-sticky text-amber-500"></i>
                                        <span>{m.notes.length} Staff Note{m.notes.length > 1 ? "s" : ""}</span>
                                      </div>
                                    )}
                                  </td>

                                  <td className="px-4 py-3 max-w-xs">
                                    {m.survey ? (
                                      <div className="space-y-0.5 text-[11px]">
                                        {Object.keys(m.survey).map((key) => (
                                          <div key={key} className="truncate">
                                            <span className="text-slate-400 capitalize">{key}:</span>{" "}
                                            <span className="font-bold text-slate-800">{m.survey[key]}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic">No survey</span>
                                    )}
                                  </td>

                                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end space-x-2">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDrawer(m)}
                                        className="inline-flex items-center space-x-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors border border-indigo-200"
                                      >
                                        <i className="fa-solid fa-note-sticky text-xs"></i>
                                        <span>Details & Notes</span>
                                      </button>

                                      <a
                                        href={`https://api.whatsapp.com/send?phone=${m.countryCode ? m.countryCode.replace("+", "") : "91"}${m.phone}&text=${encodeURIComponent(
                                          `Hi ${m.fullName}, reminder for our Strategy Call scheduled on ${m.meetingDate} at ${m.meetingTime}.`
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shadow-sm"
                                      >
                                        <i className="fa-brands fa-whatsapp text-xs"></i>
                                        <span>Reminder</span>
                                      </a>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* FULLY RESPONSIVE SLIDE-OVER DRAWER (FULLSCREEN ON MOBILE, SLIDE PANEL ON DESKTOP) */}
      {isDrawerOpen && selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
          {/* Backdrop Click to Close */}
          <div
            className="absolute inset-0 hidden sm:block"
            onClick={handleCloseDrawer}
          />

          {/* Drawer Content Container */}
          <div className="relative w-full sm:max-w-lg bg-white h-full shadow-2xl flex flex-col font-sans border-l border-slate-200 z-10 overflow-hidden">
            {/* Drawer Mobile Top Header */}
            <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center space-x-3 truncate">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 text-white font-bold text-sm sm:text-base flex items-center justify-center shadow-sm flex-shrink-0">
                  {selectedLead.fullName?.charAt(0).toUpperCase() || "L"}
                </div>
                <div className="truncate">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate leading-tight">
                    {selectedLead.fullName || "Anonymous Lead"}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">{selectedLead.email}</p>
                </div>
              </div>

              <button
                onClick={handleCloseDrawer}
                className="w-8 h-8 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 flex items-center justify-center text-sm transition-colors flex-shrink-0"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Scrollable Drawer Body */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 sm:space-y-5">
              {/* Mobile Quick Action Buttons & Status */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                    Status Stage
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                      selectedLead.status === "completed"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : selectedLead.status === "survey_completed"
                        ? "bg-blue-100 text-blue-800 border border-blue-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}
                  >
                    {selectedLead.status === "completed"
                      ? "Growth Call Booked"
                      : selectedLead.status === "survey_completed"
                      ? "Survey Completed"
                      : "Contact Info Saved"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={`tel:${selectedLead.countryCode || "+91"}${selectedLead.phone}`}
                    className="flex items-center justify-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
                    <i className="fa-solid fa-phone text-xs"></i>
                    <span>Call Client</span>
                  </a>

                  <a
                    href={`https://api.whatsapp.com/send?phone=${
                      selectedLead.countryCode ? selectedLead.countryCode.replace("+", "") : "91"
                    }${selectedLead.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
                    <i className="fa-brands fa-whatsapp text-sm"></i>
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* STAFF FOLLOW-UP DATE SECTION */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-2 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <i className="fa-regular fa-calendar text-indigo-600"></i>
                    <span>Scheduled Follow-up Date</span>
                  </label>

                  {selectedLead.followUpDate && (
                    <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
                      Follow-up: {selectedLead.followUpDate}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="date"
                    value={followUpDateInput}
                    onChange={(e) => handleSaveFollowUpDate(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  {followUpDateInput && followUpDateInput !== selectedLead.followUpDate && (
                    <button
                      type="button"
                      disabled={isSavingStaffData}
                      onClick={() => handleSaveFollowUpDate(followUpDateInput)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      Save
                    </button>
                  )}
                </div>
              </div>

              {/* STAFF NOTES & REMARKS SECTION */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <i className="fa-solid fa-note-sticky text-amber-500"></i>
                    <span>Staff Notes & Remarks</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    {selectedLead.notes?.length || 0} Notes
                  </span>
                </div>

                {/* Add Note Form */}
                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    rows={3}
                    placeholder="Type notes after speaking with client (e.g. Budget discussed, wants proposal)..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 sm:p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingStaffData || !newNoteText.trim()}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 sm:py-1.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5 shadow-sm"
                    >
                      {isSavingStaffData ? (
                        <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                      ) : (
                        <i className="fa-solid fa-plus text-xs"></i>
                      )}
                      <span>Add Note</span>
                    </button>
                  </div>
                </form>

                {/* Notes History List */}
                <div className="space-y-2 pt-2 border-t border-slate-100 max-h-48 overflow-y-auto">
                  {!selectedLead.notes || selectedLead.notes.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic text-center py-2">
                      No staff notes recorded yet.
                    </p>
                  ) : (
                    selectedLead.notes.slice().reverse().map((note) => (
                      <div
                        key={note.id}
                        className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 sm:p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-bold text-slate-600">
                            By {note.author || "Staff"}
                          </span>
                          <span>
                            {new Date(note.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            @{" "}
                            {new Date(note.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                          {note.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* STAGE PROGRESS CHECKLIST */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-2.5 shadow-sm">
                <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                  Customer Journey Checklist
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                        ✓
                      </span>
                      <span className="font-bold text-slate-800">1. Basic Contact Info</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {selectedLead.countryCode} {selectedLead.phone}
                    </span>
                  </div>

                  <div
                    className={`flex items-center justify-between p-2.5 rounded-xl border ${
                      selectedLead.survey && Object.keys(selectedLead.survey).length > 0
                        ? "bg-emerald-50/50 border-emerald-200"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          selectedLead.survey && Object.keys(selectedLead.survey).length > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {selectedLead.survey && Object.keys(selectedLead.survey).length > 0
                          ? "✓"
                          : "✗"}
                      </span>
                      <span className="font-bold text-slate-800">2. Business Survey</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {selectedLead.survey && Object.keys(selectedLead.survey).length > 0
                        ? "Completed"
                        : "Not Filled"}
                    </span>
                  </div>

                  <div
                    className={`flex items-center justify-between p-2.5 rounded-xl border ${
                      selectedLead.meeting?.meetingDate
                        ? "bg-emerald-50/50 border-emerald-200"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          selectedLead.meeting?.meetingDate
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {selectedLead.meeting?.meetingDate ? "✓" : "✗"}
                      </span>
                      <span className="font-bold text-slate-800">3. Scheduled Meeting</span>
                    </div>
                    <span className="text-[10px] text-slate-700 font-extrabold">
                      {selectedLead.meeting?.meetingDate && selectedLead.meeting?.meetingTime
                        ? `${selectedLead.meeting.meetingDate} @ ${selectedLead.meeting.meetingTime}`
                        : "No Booking"}
                    </span>
                  </div>
                </div>
              </div>

              {/* DETAILED SURVEY RESPONSES */}
              {selectedLead.survey && Object.keys(selectedLead.survey).length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-2 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <i className="fa-solid fa-list-check text-blue-600"></i>
                    <span>Survey Responses Profile</span>
                  </h4>

                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {Object.keys(selectedLead.survey).map((qKey) => (
                      <div
                        key={qKey}
                        className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-xs flex justify-between items-center"
                      >
                        <span className="text-slate-500 capitalize font-medium">{qKey}:</span>
                        <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 truncate max-w-[180px]">
                          {selectedLead.survey![qKey]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TECHNICAL & LINKS SECTION */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>Campaign: <strong className="text-slate-800">{selectedLead.campaign || "firstoptionagency"}</strong></span>
                  <span>Created: <strong className="text-slate-800">{selectedLead.createdDate}</strong></span>
                </div>

                {selectedLead.links?.surveyUrl && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 font-semibold truncate max-w-[180px] sm:max-w-[240px]">
                      Survey Link
                    </span>
                    <button
                      onClick={() => handleCopyLink(selectedLead.links!.surveyUrl!, "survey")}
                      className="text-indigo-600 hover:text-indigo-800 font-bold bg-white border border-slate-200 px-2 py-0.5 rounded transition-colors"
                    >
                      {copiedLink === "survey" ? "Copied! ✓" : "Copy Link"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
