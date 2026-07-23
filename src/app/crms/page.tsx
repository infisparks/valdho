"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  getLeadsForDate,
  getMeetingsForDate,
  LeadData,
} from "@/lib/firebase";
import {
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { CAMPAIGNS } from "@/config/campaigns";

export default function CRMPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // CRM Dashboard State
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"leads" | "meetings">("leads");

  // Data State
  const [leadsList, setLeadsList] = useState<LeadData[]>([]);
  const [meetingsList, setMeetingsList] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Mobile Sidebar State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

  // Fetch Dashboard Data
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsDataLoading(true);
    try {
      const [fetchedLeads, fetchedMeetings] = await Promise.all([
        getLeadsForDate(selectedDate, selectedCampaign),
        getMeetingsForDate(selectedDate, selectedCampaign),
      ]);
      setLeadsList(fetchedLeads);
      setMeetingsList(fetchedMeetings);
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

  // Filtered Leads
  const filteredLeads = leadsList.filter((lead) => {
    const matchesSearch =
      lead.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ? true : lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const totalLeadsCount = leadsList.length;
  const partialLeadsCount = leadsList.filter((l) => l.status === "partial").length;
  const surveyCompletedCount = leadsList.filter((l) => l.status === "survey_completed").length;
  const bookedMeetingsCount = leadsList.filter((l) => l.status === "completed").length;
  const todayMeetingsScheduled = meetingsList.length;

  // Funnel Percentages
  const surveyPct = totalLeadsCount > 0 ? Math.round((surveyCompletedCount / totalLeadsCount) * 100) : 0;
  const bookedPct = totalLeadsCount > 0 ? Math.round((bookedMeetingsCount / totalLeadsCount) * 100) : 0;

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

  // -------------------------------------------------------------
  // MAIN CRM DASHBOARD (When authenticated)
  // -------------------------------------------------------------
  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-slate-900 font-sans flex flex-col md:flex-row antialiased">
      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-4 transition-transform duration-200 transform ${
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
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 flex items-center justify-center md:hidden"
            >
              <i className="fa-solid fa-bars"></i>
            </button>

            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900">
                Executive Lead Dashboard
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Real-time tracking of leads, survey qualifications, and booked strategy meetings
              </p>
            </div>
          </div>

          {/* Filters & Control Bar */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Date Selector */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-600"
            />

            {/* Campaign Selector */}
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-600 hidden sm:block"
            >
              <option value="all">All Campaigns</option>
              {Object.keys(CAMPAIGNS).map((key) => (
                <option key={key} value={key}>
                  {CAMPAIGNS[key].title}
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              onClick={fetchData}
              disabled={isDataLoading}
              className="w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-bold hover:bg-indigo-100 flex items-center justify-center space-x-1.5 transition-colors"
            >
              <i className={`fa-solid fa-rotate-right ${isDataLoading ? "fa-spin" : ""}`}></i>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="p-4 sm:p-6 space-y-6 w-full max-w-full">
          {/* 1. KEY METRICS CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Leads */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold">Today&apos;s Total Leads</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-users"></i>
                </div>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{totalLeadsCount}</p>
              <p className="text-[10px] text-slate-400">Filled Step 1 form on {selectedDate}</p>
            </div>

            {/* Partial Leads */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold text-amber-700">Partial (Need Survey)</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-hourglass-half"></i>
                </div>
              </div>
              <p className="text-2xl font-extrabold text-amber-600">{partialLeadsCount}</p>
              <p className="text-[10px] text-slate-400">Requires WhatsApp survey link</p>
            </div>

            {/* Survey Completed */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold text-blue-700">Survey Completed</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-clipboard-check"></i>
                </div>
              </div>
              <p className="text-2xl font-extrabold text-blue-600">{surveyCompletedCount}</p>
              <p className="text-[10px] text-slate-400">Qualified leads waiting to book</p>
            </div>

            {/* Today's Meetings */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold text-emerald-700">Meetings Scheduled</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-calendar-day"></i>
                </div>
              </div>
              <p className="text-2xl font-extrabold text-emerald-600">{todayMeetingsScheduled}</p>
              <p className="text-[10px] text-slate-400">Call appointments on {selectedDate}</p>
            </div>
          </div>

          {/* 2. VISUAL LEAD ACQUISITION FUNNEL */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Lead Acquisition Conversion Funnel
                </h3>
                <p className="text-xs text-slate-500">
                  Customer journey conversion rate from initial popup form to booked meeting
                </p>
              </div>

              <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">
                Conversion Rate: {bookedPct}%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Step 1: Contact Form */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>1. Contact Form Filled</span>
                  <span className="text-indigo-600 font-mono">{totalLeadsCount} Leads</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-indigo-600 h-2 rounded-full w-full" />
                </div>
                <div className="text-[10px] text-slate-400">100% of captured leads</div>
              </div>

              {/* Step 2: Survey Completed */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>2. Survey Completed</span>
                  <span className="text-blue-600 font-mono">{surveyCompletedCount} Leads</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${surveyPct}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400">{surveyPct}% completion rate</div>
              </div>

              {/* Step 3: Booked Meeting */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>3. Growth Call Booked</span>
                  <span className="text-emerald-600 font-mono">{bookedMeetingsCount} Meetings</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${bookedPct}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400">{bookedPct}% final conversion</div>
              </div>
            </div>
          </div>

          {/* 3. TABBED DATA TABLES (Leads & Meetings) */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Table Navigation Header */}
            <div className="px-4 py-3 sm:px-6 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center space-x-2 border-b sm:border-b-0 border-slate-200 pb-2 sm:pb-0">
                <button
                  onClick={() => setActiveTab("leads")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "leads"
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Today&apos;s Generated Leads ({totalLeadsCount})
                </button>

                <button
                  onClick={() => setActiveTab("meetings")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "meetings"
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Scheduled Meetings ({todayMeetingsScheduled})
                </button>
              </div>

              {/* Filters for Leads */}
              {activeTab === "leads" && (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Search name, phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                  />

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="partial">Partial</option>
                    <option value="survey_completed">Survey Done</option>
                    <option value="completed">Meeting Booked</option>
                  </select>
                </div>
              )}
            </div>

            {/* TAB 1: LEADS TABLE */}
            {activeTab === "leads" && (
              <div className="overflow-x-auto">
                {filteredLeads.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <i className="fa-solid fa-inbox text-3xl text-slate-300"></i>
                    <p className="text-xs text-slate-500 font-bold">
                      No leads generated for {selectedDate}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Lead Info</th>
                        <th className="px-4 py-3">Mobile Number</th>
                        <th className="px-4 py-3">Step Progress Pipeline</th>
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
                          lead.status === "survey_completed" || lead.status === "completed";
                        const isMeetingDone = lead.status === "completed";

                        return (
                          <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900">{lead.fullName || "Anonymous"}</div>
                              <div className="text-[11px] text-slate-400">{lead.email}</div>
                            </td>

                            <td className="px-4 py-3 font-mono font-semibold">
                              {lead.countryCode} {lead.phone}
                            </td>

                            {/* 3-Step Progress Pipeline */}
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-1 text-[11px] font-bold">
                                {/* Step 1: Fill Detail (Always Green since user filled popup) */}
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center space-x-1">
                                  <span>✓ Fill Detail</span>
                                </span>

                                <span className="text-slate-300 font-mono">›</span>

                                {/* Step 2: Fill Survey */}
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

                                {/* Step 3: Booked Meeting */}
                                {isMeetingDone ? (
                                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center space-x-1">
                                    <span>✓ Booked Meeting</span>
                                  </span>
                                ) : (
                                  <span className="bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded-md flex items-center space-x-1">
                                    <span>✗ Booked Meeting</span>
                                  </span>
                                )}
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

                            <td className="px-4 py-3 text-right">
                              {lead.status === "partial" ? (
                                <a
                                  href={whatsappSurveyUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shadow-sm"
                                >
                                  <i className="fa-brands fa-whatsapp text-xs"></i>
                                  <span>Send Survey Link</span>
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
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB 2: MEETINGS TABLE */}
            {activeTab === "meetings" && (
              <div className="overflow-x-auto">
                {meetingsList.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <i className="fa-solid fa-calendar-xmark text-3xl text-slate-300"></i>
                    <p className="text-xs text-slate-500 font-bold">
                      No meetings scheduled for {selectedDate}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Time Slot</th>
                        <th className="px-4 py-3">Client Info</th>
                        <th className="px-4 py-3">Mobile Number</th>
                        <th className="px-4 py-3">Campaign</th>
                        <th className="px-4 py-3">Survey Profile</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {meetingsList.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <span className="bg-indigo-100 text-indigo-900 font-black px-2.5 py-1 rounded-lg text-xs border border-indigo-200">
                              {m.meetingTime}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{m.fullName}</div>
                            <div className="text-[11px] text-slate-400">{m.email}</div>
                          </td>

                          <td className="px-4 py-3 font-mono font-semibold">
                            {m.countryCode} {m.phone}
                          </td>

                          <td className="px-4 py-3">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                              {m.campaign}
                            </span>
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

                          <td className="px-4 py-3 text-right">
                            <a
                              href={`https://api.whatsapp.com/send?phone=${m.countryCode ? m.countryCode.replace("+", "") : "91"}${m.phone}&text=${encodeURIComponent(
                                `Hi ${m.fullName}, reminder for our Strategy Call scheduled today at ${m.meetingTime}.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shadow-sm"
                            >
                              <i className="fa-brands fa-whatsapp text-xs"></i>
                              <span>Send Call Reminder</span>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
