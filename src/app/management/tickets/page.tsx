"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  getAllSupportTickets,
  createSupportTicket,
  updateSupportTicketStatus,
  deleteSupportTicket,
  markSupportTicketSeen,
  markAllSupportTicketsSeen,
  getAllUsers,
  syncAndGetUser,
  SupportTicket,
  UserData,
  MASTER_ADMIN_UID,
  sanitizeEmailToId,
} from "@/lib/firebase";
import { signOut, onAuthStateChanged, User } from "firebase/auth";

const SERVER_URL = (
  process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL ||
  process.env.NEXT_PUBLIC_SERVER_URL ||
  "https://first.infiplus.in"
).replace(/\/$/, "");

export default function TicketManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Tickets Data & Loading
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Tabs
  const [scopeTab, setScopeTab] = useState<"assigned_to_me" | "raised_by_me" | "all_tickets">("assigned_to_me");
  const [seenFilter, setSeenFilter] = useState<"all" | "unread" | "seen">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Batch action state
  const [isBatchMarking, setIsBatchMarking] = useState(false);

  // Raise Ticket Modal State
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [ticketLevel, setTicketLevel] = useState<"level1" | "level2" | "level3" | "level4">("level3");
  const [ticketTargetType, setTicketTargetType] = useState<"admin" | "user">("admin");
  const [ticketTargetUserId, setTicketTargetUserId] = useState<string>("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketSuccessMsg, setTicketSuccessMsg] = useState("");
  const [ticketErrorMsg, setTicketErrorMsg] = useState("");

  const isAdmin = Boolean(
    currentUser?.uid === MASTER_ADMIN_UID ||
    userData?.roleId === "role_admin" ||
    userData?.roleName?.toLowerCase() === "admin" ||
    currentUser?.email?.toLowerCase().startsWith("firstoption")
  );

  const canAccessCRM = Boolean(
    isAdmin ||
    userData?.roleId === "role_appointment_setter_1" ||
    userData?.roleName === "Appointment_Setter_1" ||
    userData?.roleName?.toLowerCase().includes("appointment_setter")
  );

  // Authenticate user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login?redirect=/management/tickets");
      } else {
        setCurrentUser(user);
        const profile = await syncAndGetUser(user.uid, user.email || "");
        setUserData(profile);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch Tickets & Users
  const fetchTicketsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ticketsData, usersData] = await Promise.all([
        getAllSupportTickets(),
        getAllUsers(),
      ]);
      setTickets(ticketsData);
      setUsersList(usersData);
    } catch (err) {
      console.error("Fetch Tickets Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchTicketsData();
    }
  }, [currentUser, fetchTicketsData]);

  // Current user sanitized key
  const currentSanitizedKey = useMemo(() => {
    if (!currentUser) return "";
    return sanitizeEmailToId(currentUser.email || currentUser.uid);
  }, [currentUser]);

  // Helper to check if a ticket is received by / assigned to current user
  const isReceivedByMe = useCallback(
    (ticket: SupportTicket): boolean => {
      if (!currentUser) return false;
      const userId = currentUser.uid;
      const userEmailLower = (currentUser.email || "").toLowerCase();

      // If ticket is assigned to a specific user
      if (ticket.assignedToType === "user") {
        return (
          ticket.assignedToId === userId ||
          ticket.assignedToId === currentUser.email ||
          ticket.assignedToEmail?.toLowerCase() === userEmailLower
        );
      }

      // If ticket is assigned to Admin
      if (ticket.assignedToType === "admin" || !ticket.assignedToType) {
        return isAdmin;
      }

      return false;
    },
    [currentUser, isAdmin]
  );

  // Helper to check if a ticket is seen
  const isTicketSeenByMe = useCallback(
    (ticket: SupportTicket): boolean => {
      if (!currentUser) return false;
      if (isReceivedByMe(ticket)) {
        if (ticket.seenByUserIds && ticket.seenByUserIds[currentSanitizedKey]) {
          return true;
        }
        return Boolean(ticket.isSeen);
      }
      return Boolean(ticket.isSeen || ticket.seenAt || (ticket.seenByUserIds && Object.keys(ticket.seenByUserIds).length > 0));
    },
    [currentUser, currentSanitizedKey, isReceivedByMe]
  );

  // Filter tickets by scope, seen status, search, level, and status
  const filteredTickets = useMemo(() => {
    if (!currentUser) return [];
    const userEmailLower = (currentUser.email || "").toLowerCase();
    const userId = currentUser.uid;

    return tickets.filter((t) => {
      // Scope Filter
      if (scopeTab === "assigned_to_me") {
        const isAssigned = isReceivedByMe(t);
        if (!isAssigned) return false;
      } else if (scopeTab === "raised_by_me") {
        const isRaisedByMe =
          t.raisedById === userId ||
          t.raisedByEmail?.toLowerCase() === userEmailLower ||
          t.clientId === userId ||
          t.clientEmail?.toLowerCase() === userEmailLower;
        if (!isRaisedByMe) return false;
      }

      // Seen / Unread Filter
      const seen = isTicketSeenByMe(t);
      if (seenFilter === "unread" && seen) return false;
      if (seenFilter === "seen" && !seen) return false;

      // Status Filter
      if (statusFilter !== "all" && t.status !== statusFilter) return false;

      // Level Filter
      if (levelFilter !== "all" && t.level !== levelFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = t.ticketNumber?.toLowerCase().includes(q);
        const matchesSubject = t.subject?.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const matchesRaiser = (t.raisedByName || t.clientName || "").toLowerCase().includes(q);
        const matchesAssignee = (t.assignedToName || "").toLowerCase().includes(q);
        if (!matchesNumber && !matchesSubject && !matchesDesc && !matchesRaiser && !matchesAssignee) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, currentUser, isReceivedByMe, scopeTab, seenFilter, statusFilter, levelFilter, searchQuery, isTicketSeenByMe]);

  // Counts for KPIs and Badges
  const counts = useMemo(() => {
    if (!currentUser) return { assignedUnread: 0, raisedTotal: 0, allUnread: 0, total: 0 };
    const userEmailLower = (currentUser.email || "").toLowerCase();
    const userId = currentUser.uid;

    const assignedTickets = tickets.filter((t) => isReceivedByMe(t));
    const assignedUnread = assignedTickets.filter((t) => !isTicketSeenByMe(t)).length;

    const raisedTickets = tickets.filter(
      (t) =>
        t.raisedById === userId ||
        t.raisedByEmail?.toLowerCase() === userEmailLower ||
        t.clientId === userId ||
        t.clientEmail?.toLowerCase() === userEmailLower
    );

    const allUnread = tickets.filter((t) => isReceivedByMe(t) && !isTicketSeenByMe(t)).length;

    return {
      assignedUnread,
      assignedTotal: assignedTickets.length,
      raisedTotal: raisedTickets.length,
      allUnread,
      total: tickets.length,
    };
  }, [tickets, currentUser, isReceivedByMe, isTicketSeenByMe]);

  // Unread tickets received by current user in the current filtered view
  const myUnreadReceivedInView = useMemo(() => {
    return filteredTickets.filter((t) => isReceivedByMe(t) && !isTicketSeenByMe(t)).length;
  }, [filteredTickets, isReceivedByMe, isTicketSeenByMe]);

  // Handle Mark Single Ticket as Seen (ONLY for recipient)
  const handleMarkSeen = async (ticketId: string) => {
    if (!currentUser) return;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    if (!isReceivedByMe(ticket)) {
      alert("Permission restricted: You can only mark tickets received by or assigned to you as seen.");
      return;
    }

    const userName = userData?.name || currentUser.displayName || currentUser.email?.split("@")[0] || "User";
    const userKey = currentUser.email || currentUser.uid;

    // Optimistic local state update
    const timestamp = new Date().toISOString();
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              isSeen: true,
              seenAt: timestamp,
              seenBy: userName,
              seenByUserIds: { ...(t.seenByUserIds || {}), [currentSanitizedKey]: timestamp },
            }
          : t
      )
    );

    await markSupportTicketSeen(ticketId, userKey, userName);
  };

  // Handle Mark All Received Unread as Seen
  const handleMarkAllSeen = async () => {
    if (!currentUser) return;
    // Only mark tickets that were RECEIVED BY ME and are UNREAD
    const unreadReceivedTicketIds = filteredTickets
      .filter((t) => isReceivedByMe(t) && !isTicketSeenByMe(t))
      .map((t) => t.id);

    if (unreadReceivedTicketIds.length === 0) return;

    setIsBatchMarking(true);
    const userName = userData?.name || currentUser.displayName || currentUser.email?.split("@")[0] || "User";
    const userKey = currentUser.email || currentUser.uid;
    const timestamp = new Date().toISOString();

    // Optimistic local update
    setTickets((prev) =>
      prev.map((t) => {
        if (unreadReceivedTicketIds.includes(t.id)) {
          return {
            ...t,
            isSeen: true,
            seenAt: timestamp,
            seenBy: userName,
            seenByUserIds: { ...(t.seenByUserIds || {}), [currentSanitizedKey]: timestamp },
          };
        }
        return t;
      })
    );

    await markAllSupportTicketsSeen(unreadReceivedTicketIds, userKey, userName);
    setIsBatchMarking(false);
  };

  // Handle Update Ticket Status
  const handleStatusChange = async (ticketId: string, newStatus: SupportTicket["status"]) => {
    const adminName = userData?.name || currentUser?.displayName || currentUser?.email || "Staff";
    const success = await updateSupportTicketStatus(ticketId, newStatus, adminName);
    if (success) {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, status: newStatus, resolvedBy: adminName, updatedAt: new Date().toISOString() }
            : t
        )
      );
    }
  };

  // Handle Delete Ticket
  const handleDeleteTicketAction = async (ticket: SupportTicket) => {
    if (!confirm(`Are you sure you want to delete ticket #${ticket.ticketNumber} (${ticket.subject})?`)) {
      return;
    }
    const success = await deleteSupportTicket(ticket.id);
    if (success) {
      setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
    }
  };

  // Handle Submit New Ticket
  const handleRaiseTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketDescription.trim()) {
      setTicketErrorMsg("Please enter subject and description for the support ticket.");
      return;
    }

    if (ticketTargetType === "user" && !ticketTargetUserId) {
      setTicketErrorMsg("Please select the team member to assign this ticket to.");
      return;
    }

    setIsSubmittingTicket(true);
    setTicketErrorMsg("");
    setTicketSuccessMsg("");

    const levelLabels = {
      level1: "Critical / Urgent",
      level2: "High Priority",
      level3: "Medium Priority",
      level4: "Low / General Query",
    };

    const targetUser = ticketTargetType === "user"
      ? usersList.find((u) => u.uid === ticketTargetUserId || u.emailId === ticketTargetUserId || u.email === ticketTargetUserId)
      : null;

    const assignedToType: "admin" | "user" = ticketTargetType === "user" && targetUser ? "user" : "admin";
    const assignedToId = targetUser ? (targetUser.uid || targetUser.emailId || targetUser.email || "") : "admin";
    const assignedToName = targetUser ? (targetUser.name || targetUser.email || "Staff Member") : "Admin / Management";
    const assignedToEmail = targetUser ? (targetUser.email || "") : "";
    const assignedToPhone = targetUser ? (targetUser.phone || "") : "";
    const assignedToRole = targetUser ? (targetUser.roleName || "Staff") : "Admin";

    const raisedById = currentUser?.uid || "";
    const raisedByName = userData?.name || currentUser?.displayName || currentUser?.email?.split("@")[0] || "User";
    const raisedByEmail = currentUser?.email || "";
    const raisedByPhone = userData?.phone || "";
    const raisedByRole = userData?.roleName || (isAdmin ? "Admin" : "Staff");

    const res = await createSupportTicket({
      clientId: currentUser?.uid,
      clientName: raisedByName,
      clientEmail: raisedByEmail,
      clientPhone: raisedByPhone,
      raisedById,
      raisedByName,
      raisedByEmail,
      raisedByPhone,
      raisedByRole,
      assignedToType,
      assignedToId,
      assignedToName,
      assignedToEmail,
      assignedToPhone,
      assignedToRole,
      level: ticketLevel,
      levelLabel: levelLabels[ticketLevel],
      subject: ticketSubject.trim(),
      description: ticketDescription.trim(),
    });

    if (res.success && res.data) {
      setTickets((prev) => [res.data!, ...prev]);
      const targetLabel = assignedToType === "user" ? assignedToName : "Admin";
      setTicketSuccessMsg(`Ticket #${res.data.ticketNumber} raised for ${targetLabel}! WhatsApp notification dispatched.`);
      setTicketSubject("");
      setTicketDescription("");
      setTicketTargetType("admin");
      setTicketTargetUserId("");

      const domain = typeof window !== "undefined" ? window.location.host : "firstoptionagency.com";
      fetch(`${SERVER_URL}/api/whatsapp/notify-admin-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: res.data.id,
          ticketNumber: res.data.ticketNumber,
          clientName: raisedByName,
          clientEmail: raisedByEmail,
          clientPhone: raisedByPhone,
          raisedById,
          raisedByName,
          raisedByEmail,
          raisedByPhone,
          raisedByRole,
          assignedToType,
          assignedToId,
          assignedToName,
          assignedToEmail,
          assignedToPhone,
          assignedToRole,
          level: ticketLevel,
          levelLabel: levelLabels[ticketLevel],
          subject: res.data.subject,
          description: res.data.description,
          domain,
        }),
      }).catch((err) => console.error("Error sending ticket WhatsApp notification:", err));

      setTimeout(() => {
        setIsRaiseModalOpen(false);
        setTicketSuccessMsg("");
      }, 2500);
    } else {
      setTicketErrorMsg(res.error || "Failed to create support ticket.");
    }
    setIsSubmittingTicket(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="w-full min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-indigo-600 font-bold text-sm bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
          <span>Loading Support Tickets Center...</span>
        </div>
      </div>
    );
  }

  const unreadInCurrentView = filteredTickets.filter((t) => !isTicketSeenByMe(t)).length;

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-slate-900 font-sans antialiased">
      {/* Top Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Brand & Title */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-xs flex-shrink-0">
              <i className="fa-solid fa-ticket text-base"></i>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 truncate leading-snug">
                Support & Escalation Tickets Center
              </h1>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase">
                  {userData?.roleName || "Staff Specialist"}
                </span>
                <span className="text-xs text-slate-400 font-mono truncate hidden sm:inline">
                  {currentUser?.email}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => setIsRaiseModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer active:scale-95"
            >
              <i className="fa-solid fa-plus text-xs"></i>
              <span>Raise Ticket 🚀</span>
            </button>

            <button
              onClick={() => router.push("/management")}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-diagram-project text-xs text-indigo-600"></i>
              <span className="hidden sm:inline">Workflow Canvas</span>
            </button>

            {canAccessCRM && (
              <button
                onClick={() => router.push("/crms")}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-columns text-xs text-indigo-600"></i>
                <span className="hidden sm:inline">Pipeline Board</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-2 rounded-xl transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* KPI Dashboard Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Assigned to Me */}
          <div
            onClick={() => {
              setScopeTab("assigned_to_me");
              setSeenFilter("all");
            }}
            className={`bg-white border rounded-2xl p-4 shadow-sm transition-all cursor-pointer ${
              scopeTab === "assigned_to_me" ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">📥 Assigned to Me</span>
              {counts.assignedUnread > 0 && (
                <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                  {counts.assignedUnread} Unread
                </span>
              )}
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{counts.assignedTotal}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Tickets requiring your action</p>
          </div>

          {/* Card 2: Raised By Me */}
          <div
            onClick={() => {
              setScopeTab("raised_by_me");
              setSeenFilter("all");
            }}
            className={`bg-white border rounded-2xl p-4 shadow-sm transition-all cursor-pointer ${
              scopeTab === "raised_by_me" ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">📤 Raised By Me</span>
            <p className="text-2xl font-black text-slate-900 mt-2">{counts.raisedTotal}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Tickets you raised to team</p>
          </div>

          {/* Card 3: Unread Filter Quick Action */}
          <div
            onClick={() => setSeenFilter(seenFilter === "unread" ? "all" : "unread")}
            className={`bg-white border rounded-2xl p-4 shadow-sm transition-all cursor-pointer ${
              seenFilter === "unread" ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-solid fa-bell text-rose-500"></i>
                <span>Unread Filter</span>
              </span>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                {seenFilter === "unread" ? "Active" : "Click to view"}
              </span>
            </div>
            <p className="text-2xl font-black text-rose-700 mt-2">{counts.allUnread}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Click to show unread tickets only</p>
          </div>

          {/* Card 4: All Tickets */}
          <div
            onClick={() => {
              setScopeTab("all_tickets");
              setSeenFilter("all");
            }}
            className={`bg-white border rounded-2xl p-4 shadow-sm transition-all cursor-pointer ${
              scopeTab === "all_tickets" ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">🌐 All Team Tickets</span>
            <p className="text-2xl font-black text-slate-900 mt-2">{counts.total}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Global tickets directory</p>
          </div>
        </div>

        {/* Scope Tabs & Quick Batch Actions Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            {/* Primary Scope Switcher Tabs */}
            <div className="flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl text-xs font-extrabold w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setScopeTab("assigned_to_me")}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer flex-shrink-0 ${
                  scopeTab === "assigned_to_me"
                    ? "bg-white text-indigo-700 shadow-2xs font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <i className="fa-solid fa-inbox text-xs"></i>
                <span>Assigned To Me</span>
                {counts.assignedUnread > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    {counts.assignedUnread}
                  </span>
                )}
              </button>

              <button
                onClick={() => setScopeTab("raised_by_me")}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer flex-shrink-0 ${
                  scopeTab === "raised_by_me"
                    ? "bg-white text-indigo-700 shadow-2xs font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <i className="fa-solid fa-paper-plane text-xs"></i>
                <span>Raised By Me</span>
                <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {counts.raisedTotal}
                </span>
              </button>

              <button
                onClick={() => setScopeTab("all_tickets")}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center space-x-2 cursor-pointer flex-shrink-0 ${
                  scopeTab === "all_tickets"
                    ? "bg-white text-indigo-700 shadow-2xs font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <i className="fa-solid fa-globe text-xs"></i>
                <span>All Team Tickets</span>
                <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {counts.total}
                </span>
              </button>
            </div>

            {/* Batch Action: Mark All Seen */}
            <div className="flex items-center space-x-2">
              {myUnreadReceivedInView > 0 && (
                <button
                  onClick={handleMarkAllSeen}
                  disabled={isBatchMarking}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black px-3.5 py-2 rounded-xl transition-all shadow-2xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  title="Mark your unread assigned tickets as seen"
                >
                  <i className={`fa-solid fa-check-double text-indigo-600 ${isBatchMarking ? "fa-spin" : ""}`}></i>
                  <span>Mark My Received as Seen ({myUnreadReceivedInView}) ✓</span>
                </button>
              )}

              <button
                onClick={fetchTicketsData}
                disabled={isLoading}
                className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition-colors flex items-center space-x-1 cursor-pointer"
                title="Refresh tickets"
              >
                <i className={`fa-solid fa-rotate-right ${isLoading ? "fa-spin" : ""}`}></i>
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Secondary Filters Bar */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3 text-xs">
            {/* Search Input */}
            <div className="relative w-full lg:w-80">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket #, subject, person..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-slate-900 text-xs font-bold focus:outline-none focus:border-indigo-600"
              />
            </div>

            {/* Seen Pills, Urgency & Status Selectors */}
            <div className="flex items-center space-x-2 w-full lg:w-auto flex-wrap gap-2">
              {/* Seen / Unread Pill Filter */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setSeenFilter("all")}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    seenFilter === "all" ? "bg-white text-slate-900 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSeenFilter("unread")}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center space-x-1 cursor-pointer ${
                    seenFilter === "unread"
                      ? "bg-rose-600 text-white shadow-2xs font-extrabold"
                      : "text-rose-700 hover:bg-rose-50"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <span>Unread Only</span>
                </button>
                <button
                  onClick={() => setSeenFilter("seen")}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    seenFilter === "seen" ? "bg-white text-emerald-700 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Seen Only
                </button>
              </div>

              {/* Urgency Filter */}
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 text-xs font-bold focus:outline-none focus:border-indigo-600 cursor-pointer flex-1 sm:flex-none"
              >
                <option value="all">All Urgency Levels</option>
                <option value="level1">🚨 Level 1 (Critical)</option>
                <option value="level2">⚡ Level 2 (High)</option>
                <option value="level3">📌 Level 3 (Medium)</option>
                <option value="level4">ℹ️ Level 4 (Low)</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 text-xs font-bold focus:outline-none focus:border-indigo-600 cursor-pointer flex-1 sm:flex-none"
              >
                <option value="all">All Statuses</option>
                <option value="open">🔴 Open</option>
                <option value="in_progress">🟡 In Progress</option>
                <option value="resolved">🟢 Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tickets Grid Display */}
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-sm">
            <i className="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-600"></i>
            <p className="text-xs font-bold text-slate-600">Loading support tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mx-auto shadow-2xs">
              <i className="fa-solid fa-ticket-simple"></i>
            </div>
            <h3 className="text-base font-extrabold text-slate-900">
              {seenFilter === "unread"
                ? "No Unread Tickets in this View 🎉"
                : "No Support Tickets Found"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {seenFilter === "unread"
                ? "You have reviewed all incoming tickets. Switch filter to 'All' or raise a new ticket whenever needed."
                : "No tickets matching your filter criteria. Click 'Raise Ticket' to submit a new ticket to team or Admin."}
            </p>
            {seenFilter === "unread" && (
              <button
                onClick={() => setSeenFilter("all")}
                className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-all cursor-pointer"
              >
                Show All Tickets
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTickets.map((t) => {
              const receivedByMe = isReceivedByMe(t);
              const seen = isTicketSeenByMe(t);
              const levelConfig = {
                level1: { badge: "bg-rose-100 text-rose-800 border-rose-300", icon: "🚨 Level 1 (Critical)" },
                level2: { badge: "bg-amber-100 text-amber-800 border-amber-300", icon: "⚡ Level 2 (High)" },
                level3: { badge: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: "📌 Level 3 (Medium)" },
                level4: { badge: "bg-slate-100 text-slate-800 border-slate-300", icon: "ℹ️ Level 4 (Low)" },
              }[t.level] || { badge: "bg-slate-100 text-slate-800 border-slate-300", icon: t.levelLabel };

              const cleanRaiserPhone = String(t.raisedByPhone || t.clientPhone || "").replace(/\D/g, "");
              const waRaiserNumber = cleanRaiserPhone.length === 10 ? "91" + cleanRaiserPhone : cleanRaiserPhone;

              const cleanAssigneePhone = String(t.assignedToPhone || "").replace(/\D/g, "");
              const waAssigneeNumber = cleanAssigneePhone.length === 10 ? "91" + cleanAssigneePhone : cleanAssigneePhone;

              const raiserDisplayName = t.raisedByName || t.clientName || "User";
              const raiserRoleName = t.raisedByRole || "Client / Staff";
              const assigneeDisplayName = t.assignedToName || "Admin / Management";
              const assigneeRoleName = t.assignedToRole || (t.assignedToType === "user" ? "Staff" : "System Admin");

              return (
                <div
                  key={t.id}
                  className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all space-y-3.5 ${
                    receivedByMe && !seen
                      ? "border-indigo-400 ring-2 ring-indigo-500/20 bg-gradient-to-br from-white via-indigo-50/10 to-purple-50/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Top Bar: Ticket #, Urgency Badge, Seen State & Status */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                          #{t.ticketNumber}
                        </span>

                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${levelConfig.badge}`}>
                          {levelConfig.icon}
                        </span>

                        {receivedByMe ? (
                          !seen ? (
                            <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                              UNSEEN (YOUR ACTION)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <i className="fa-solid fa-check text-[9px]"></i> Seen by You
                            </span>
                          )
                        ) : t.isSeen ? (
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <i className="fa-solid fa-eye text-slate-500 text-[9px]"></i> Seen by {t.seenBy || assigneeDisplayName}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <i className="fa-solid fa-clock text-amber-500 text-[9px]"></i> Awaiting review ({assigneeDisplayName})
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-extrabold text-slate-900 mt-1">{t.subject}</h3>
                    </div>

                    {/* Status Dropdown */}
                    <select
                      value={t.status}
                      onChange={(e) => handleStatusChange(t.id, e.target.value as any)}
                      className={`text-xs font-black rounded-xl px-2.5 py-1 border focus:outline-none cursor-pointer flex-shrink-0 ${
                        t.status === "resolved"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : t.status === "in_progress"
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : "bg-rose-50 text-rose-800 border-rose-300"
                      }`}
                    >
                      <option value="open">🔴 Open</option>
                      <option value="in_progress">🟡 In Progress</option>
                      <option value="resolved">🟢 Resolved</option>
                    </select>
                  </div>

                  {/* Description Box */}
                  <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-normal bg-slate-50/80 border border-slate-100 p-3 rounded-xl">
                    {t.description}
                  </p>

                  {/* Assignment & Raiser Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">👤 Raised By:</span>
                      <p className="font-extrabold text-slate-900 truncate">{raiserDisplayName}</p>
                      <p className="text-[10px] text-slate-500 font-medium truncate">
                        {raiserRoleName} {t.raisedByPhone || t.clientPhone ? `• 📞 ${t.raisedByPhone || t.clientPhone}` : ""}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-extrabold uppercase text-indigo-500">🎯 Assigned To:</span>
                      <p className="font-extrabold text-indigo-900 truncate">{assigneeDisplayName}</p>
                      <p className="text-[10px] text-indigo-600 font-medium truncate">
                        {assigneeRoleName} {t.assignedToPhone ? `• 📞 ${t.assignedToPhone}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Seen Trigger */}
                  <div className="flex items-center justify-between text-xs pt-1 flex-wrap gap-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                      {/* Mark Seen Button: Available ONLY for the assigned recipient */}
                      {receivedByMe ? (
                        !seen ? (
                          <button
                            onClick={() => handleMarkSeen(t.id)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-xl transition-all shadow-2xs flex items-center space-x-1.5 cursor-pointer active:scale-95"
                            title="Mark this received ticket as seen"
                          >
                            <i className="fa-solid fa-check"></i>
                            <span>Mark as Seen</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center space-x-1">
                            <i className="fa-solid fa-check-circle text-emerald-600 text-xs"></i>
                            <span>Seen by you {t.seenAt ? `(${new Date(t.seenAt).toLocaleDateString()})` : "✓"}</span>
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg flex items-center space-x-1">
                          <i className="fa-solid fa-lock text-slate-400 text-xs"></i>
                          <span>Recipient action only ({assigneeDisplayName})</span>
                        </span>
                      )}

                      {/* WhatsApp Buttons */}
                      {waAssigneeNumber && t.assignedToType === "user" && (
                        <a
                          href={`https://wa.me/${waAssigneeNumber}?text=${encodeURIComponent(
                            `Hi ${assigneeDisplayName}, regarding ticket #${t.ticketNumber} (${t.subject}): `
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl transition-colors inline-flex items-center space-x-1 shadow-2xs"
                        >
                          <i className="fa-brands fa-whatsapp text-emerald-600 text-xs"></i>
                          <span>WhatsApp Assignee</span>
                        </a>
                      )}

                      {waRaiserNumber && (
                        <a
                          href={`https://wa.me/${waRaiserNumber}?text=${encodeURIComponent(
                            `Hi ${raiserDisplayName}, regarding your ticket #${t.ticketNumber} (${t.subject}): `
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl transition-colors inline-flex items-center space-x-1 shadow-2xs"
                        >
                          <i className="fa-brands fa-whatsapp text-indigo-600 text-xs"></i>
                          <span>WhatsApp Raiser</span>
                        </a>
                      )}
                    </div>

                    {/* Metadata & Delete */}
                    <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-medium ml-auto">
                      <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteTicketAction(t)}
                          title="Delete Support Ticket"
                          className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg text-[10px] font-extrabold transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <i className="fa-solid fa-trash-can text-[10px]"></i>
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* RAISE SUPPORT TICKET MODAL */}
      {isRaiseModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setIsRaiseModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-5 font-sans border border-slate-200 z-10 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm shadow-2xs font-extrabold">
                  <i className="fa-solid fa-ticket"></i>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Raise Support Ticket / Escalation
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Assign ticket to Admin or a team member with automated WhatsApp alert dispatch.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsRaiseModalOpen(false)}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {ticketSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold p-3 rounded-xl flex items-center space-x-2">
                <i className="fa-solid fa-circle-check text-emerald-600 text-base"></i>
                <span>{ticketSuccessMsg}</span>
              </div>
            )}

            {ticketErrorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold p-3 rounded-xl flex items-center space-x-2">
                <i className="fa-solid fa-circle-exclamation text-rose-600 text-base"></i>
                <span>{ticketErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleRaiseTicketSubmit} className="space-y-4 text-xs font-medium text-slate-700">
              {/* ASSIGN TICKET TO SELECTOR */}
              <div className="space-y-2">
                <label className="block text-slate-900 font-extrabold">Send / Assign Ticket To *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTicketTargetType("admin");
                      setTicketTargetUserId("");
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                      ticketTargetType === "admin"
                        ? "bg-indigo-50 border-indigo-400 text-indigo-900 ring-2 ring-indigo-400/30 font-extrabold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                    }`}
                  >
                    <i className="fa-solid fa-shield-halved text-indigo-600"></i>
                    <span>🛡️ Admin / Management</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTicketTargetType("user")}
                    className={`p-2.5 rounded-xl border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                      ticketTargetType === "user"
                        ? "bg-indigo-50 border-indigo-400 text-indigo-900 ring-2 ring-indigo-400/30 font-extrabold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                    }`}
                  >
                    <i className="fa-solid fa-user-group text-indigo-600"></i>
                    <span>👤 Specific Staff User</span>
                  </button>
                </div>

                {ticketTargetType === "user" && (
                  <div className="pt-1">
                    <label className="block mb-1 text-[11px] font-bold text-slate-600">Select Team Member / Staff *</label>
                    <select
                      value={ticketTargetUserId}
                      onChange={(e) => setTicketTargetUserId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 font-medium cursor-pointer"
                      required
                    >
                      <option value="">-- Choose Staff / User to Assign --</option>
                      {usersList
                        .filter((u) => u.uid !== currentUser?.uid && u.email !== currentUser?.email)
                        .map((u) => {
                          const userKey = u.emailId || u.uid || u.email;
                          return (
                            <option key={userKey} value={userKey}>
                              👤 {u.name || u.email} ({u.roleName || "Staff"}) {u.phone ? `• 📞 ${u.phone}` : ""}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                )}
              </div>

              {/* URGENCY LEVEL */}
              <div>
                <label className="block mb-1.5 text-slate-900 font-extrabold">Select Urgency Level *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTicketLevel("level1")}
                    className={`p-2.5 rounded-xl border text-left flex flex-col space-y-0.5 transition-all cursor-pointer ${
                      ticketLevel === "level1"
                        ? "bg-rose-50 border-rose-400 text-rose-900 ring-2 ring-rose-400/30 font-extrabold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                    }`}
                  >
                    <span className="font-extrabold text-rose-600 flex items-center space-x-1">
                      <span>🚨 Level 1</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">Critical / Urgent Issue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTicketLevel("level2")}
                    className={`p-2.5 rounded-xl border text-left flex flex-col space-y-0.5 transition-all cursor-pointer ${
                      ticketLevel === "level2"
                        ? "bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-400/30 font-extrabold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                    }`}
                  >
                    <span className="font-extrabold text-amber-600 flex items-center space-x-1">
                      <span>⚡ Level 2</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">High Priority Issue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTicketLevel("level3")}
                    className={`p-2.5 rounded-xl border text-left flex flex-col space-y-0.5 transition-all cursor-pointer ${
                      ticketLevel === "level3"
                        ? "bg-indigo-50 border-indigo-400 text-indigo-900 ring-2 ring-indigo-400/30 font-extrabold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                    }`}
                  >
                    <span className="font-extrabold text-indigo-600 flex items-center space-x-1">
                      <span>📌 Level 3</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">Medium Priority</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTicketLevel("level4")}
                    className={`p-2.5 rounded-xl border text-left flex flex-col space-y-0.5 transition-all cursor-pointer ${
                      ticketLevel === "level4"
                        ? "bg-slate-100 border-slate-400 text-slate-900 ring-2 ring-slate-400/30 font-extrabold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                    }`}
                  >
                    <span className="font-extrabold text-slate-700 flex items-center space-x-1">
                      <span>ℹ️ Level 4</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">Low / General Query</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-900 font-bold">Subject / Issue Title *</label>
                <input
                  type="text"
                  required
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="e.g. Need assistance on client onboarding contract"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 font-medium"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-900 font-bold">Detailed Description *</label>
                <textarea
                  required
                  rows={4}
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Provide all context and details..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 font-medium"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRaiseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTicket}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingTicket && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                  <span>Submit & Send WhatsApp Alert 🚀</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
