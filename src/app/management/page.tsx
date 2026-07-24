"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  syncAndGetUser,
  getRoles,
  getAllUsers,
  getAllClientFlows,
  updateClientFlowTaskStatus,
  markClientFlowCompleted,
  createSupportTicket,
  getAllSupportTickets,
  SupportTicket,
  UserData,
  RoleData,
  ClientFlowInstance,
  ClientFlowTask,
  MASTER_ADMIN_UID,
} from "@/lib/firebase";
import { signOut, onAuthStateChanged, User } from "firebase/auth";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:5001` : "http://localhost:5001");

export default function ManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Client Flows & Users State
  const [clientFlows, setClientFlows] = useState<ClientFlowInstance[]>([]);
  const [rolesList, setRolesList] = useState<RoleData[]>([]);
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"in_progress" | "completed">("in_progress");
  const [searchQuery, setSearchQuery] = useState("");

  // Support Ticket Modal & State
  const [isRaiseTicketModalOpen, setIsRaiseTicketModalOpen] = useState(false);
  const [ticketLevel, setTicketLevel] = useState<"level1" | "level2" | "level3" | "level4">("level3");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketSuccessMsg, setTicketSuccessMsg] = useState("");
  const [ticketErrorMsg, setTicketErrorMsg] = useState("");
  const [myTicketsList, setMyTicketsList] = useState<SupportTicket[]>([]);

  // Selected Flow Canvas State (Default to 1st flow if available)
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);

  // Draft text inputs state
  const [draftTexts, setDraftTexts] = useState<{ [taskId: string]: string }>({});

  // Uncheck Warning Modal State
  const [uncheckWarningModalData, setUncheckWarningModalData] = useState<{
    clientFlowId: string;
    taskId: string;
    taskTitle: string;
    currentText: string;
  } | null>(null);

  // Edit Text Warning Modal State (New Timestamp Warning)
  const [editTextWarningModalData, setEditTextWarningModalData] = useState<{
    clientFlowId: string;
    task: ClientFlowTask;
    newText: string;
  } | null>(null);

  const [isUpdatingTask, setIsUpdatingTask] = useState(false);

  // Authenticate & Fetch User Role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login?redirect=/management");
      } else {
        setCurrentUser(user);
        const profile = await syncAndGetUser(user.uid, user.email || "");
        setUserData(profile);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch Client Flows, Roles, Users & Support Tickets
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsDataLoading(true);
    try {
      const [flows, roles, users, tickets] = await Promise.all([
        getAllClientFlows(),
        getRoles(),
        getAllUsers(),
        getAllSupportTickets(),
      ]);
      setClientFlows(flows);
      setRolesList(roles);
      setUsersList(users);

      const userEmailLower = currentUser.email?.toLowerCase();
      const filteredTickets = tickets.filter(
        (t) => t.clientId === currentUser.uid || t.clientEmail?.toLowerCase() === userEmailLower
      );
      setMyTicketsList(filteredTickets);

      if (flows.length > 0 && !activeFlowId) {
        setActiveFlowId(flows[0].id);
      }
    } catch (err) {
      console.error("Management Fetch Error:", err);
    } finally {
      setIsDataLoading(false);
    }
  }, [currentUser, activeFlowId]);

  // Handle Support Ticket Submit
  const handleRaiseTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketDescription.trim()) {
      setTicketErrorMsg("Please enter subject and description for your support ticket.");
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

    const clientName = userData?.name || currentUser?.displayName || currentUser?.email?.split("@")[0] || "Client";
    const clientEmail = currentUser?.email || "";
    const clientPhone = userData?.phone || "";

    const res = await createSupportTicket({
      clientId: currentUser?.uid,
      clientName,
      clientEmail,
      clientPhone,
      level: ticketLevel,
      levelLabel: levelLabels[ticketLevel],
      subject: ticketSubject.trim(),
      description: ticketDescription.trim(),
    });

    if (res.success && res.data) {
      setMyTicketsList((prev) => [res.data!, ...prev]);
      setTicketSuccessMsg(`Ticket #${res.data.ticketNumber} raised successfully! Admin has been notified via WhatsApp.`);
      setTicketSubject("");
      setTicketDescription("");

      // Trigger Admin WhatsApp alert
      const domain = typeof window !== "undefined" ? window.location.host : "firstoptionagency.com";
      fetch(`${SERVER_URL}/api/whatsapp/notify-admin-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: res.data.id,
          ticketNumber: res.data.ticketNumber,
          clientName,
          clientEmail,
          clientPhone,
          level: ticketLevel,
          levelLabel: levelLabels[ticketLevel],
          subject: res.data.subject,
          description: res.data.description,
          domain,
        }),
      }).catch((err) => console.error("Error sending admin ticket WhatsApp notification:", err));

      setTimeout(() => {
        setIsRaiseTicketModalOpen(false);
        setTicketSuccessMsg("");
      }, 2500);
    } else {
      setTicketErrorMsg(res.error || "Failed to submit support ticket.");
    }
    setIsSubmittingTicket(false);
  };

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

  // Toggle Checkbox Status Handler
  const handleToggleTaskCheckbox = async (
    clientFlowId: string,
    task: ClientFlowTask,
    currentText: string
  ) => {
    if (task.isCompleted) {
      // Show warning modal before unchecking
      setUncheckWarningModalData({
        clientFlowId,
        taskId: task.id,
        taskTitle: task.title,
        currentText,
      });
      return;
    }

    // Checking task directly
    setIsUpdatingTask(true);
    const userEmail = currentUser?.email || "Staff";
    const res = await updateClientFlowTaskStatus(
      clientFlowId,
      task.id,
      true,
      currentText,
      userEmail
    );

    if (res.success) {
      setClientFlows((prev) =>
        prev.map((cf) => {
          if (cf.id === clientFlowId) {
            return {
              ...cf,
              tasks: cf.tasks.map((t) =>
                t.id === task.id
                  ? {
                      ...t,
                      isCompleted: true,
                      textValue: currentText,
                      completedAt: new Date().toISOString(),
                      completedBy: userEmail,
                    }
                  : t
              ),
            };
          }
          return cf;
        })
      );
    }
    setIsUpdatingTask(false);
  };

  // Confirm Uncheck Action from Warning Modal
  const handleConfirmUncheckTask = async () => {
    if (!uncheckWarningModalData) return;
    const { clientFlowId, taskId, currentText } = uncheckWarningModalData;

    setIsUpdatingTask(true);
    const userEmail = currentUser?.email || "Staff";
    const res = await updateClientFlowTaskStatus(
      clientFlowId,
      taskId,
      false,
      currentText,
      userEmail
    );

    if (res.success) {
      setClientFlows((prev) =>
        prev.map((cf) => {
          if (cf.id === clientFlowId) {
            return {
              ...cf,
              tasks: cf.tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      isCompleted: false,
                      textValue: currentText,
                      completedAt: undefined,
                      completedBy: undefined,
                    }
                  : t
              ),
            };
          }
          return cf;
        })
      );
    }
    setIsUpdatingTask(false);
    setUncheckWarningModalData(null);
  };

  // Initiate Text Input Save (Check if warning modal is needed)
  const handleInitiateSaveText = (
    clientFlowId: string,
    task: ClientFlowTask,
    newText: string
  ) => {
    if (task.completedAt || (task.textValue && task.textValue !== newText)) {
      setEditTextWarningModalData({
        clientFlowId,
        task,
        newText,
      });
    } else {
      executeSaveTextValue(clientFlowId, task, newText);
    }
  };

  // Execute Text Input Value Save
  const executeSaveTextValue = async (
    clientFlowId: string,
    task: ClientFlowTask,
    newText: string
  ) => {
    setIsUpdatingTask(true);
    const userEmail = currentUser?.email || "Staff";
    const nowIso = new Date().toISOString();

    const res = await updateClientFlowTaskStatus(
      clientFlowId,
      task.id,
      task.isCompleted,
      newText,
      userEmail
    );

    if (res.success) {
      setClientFlows((prev) =>
        prev.map((cf) => {
          if (cf.id === clientFlowId) {
            return {
              ...cf,
              tasks: cf.tasks.map((t) =>
                t.id === task.id
                  ? {
                      ...t,
                      textValue: newText,
                      completedAt: nowIso,
                      completedBy: userEmail,
                    }
                  : t
              ),
            };
          }
          return cf;
        })
      );
    }

    setIsUpdatingTask(false);
    setEditTextWarningModalData(null);
  };

  // Admin explicit Mark Flow Completed action
  const handleAdminMarkFlowCompleted = async (flowId: string) => {
    setIsUpdatingTask(true);
    const res = await markClientFlowCompleted(flowId);
    if (res.success) {
      setClientFlows((prev) =>
        prev.map((cf) => (cf.id === flowId ? { ...cf, status: "completed" } : cf))
      );
    }
    setIsUpdatingTask(false);
  };

  if (authLoading) {
    return (
      <div className="w-full min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-indigo-600 font-bold text-sm">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
          <span>Loading Staff Canvas Workspace...</span>
        </div>
      </div>
    );
  }

  const isAdmin =
    currentUser?.uid === MASTER_ADMIN_UID ||
    userData?.roleId === "role_admin" ||
    currentUser?.email?.toLowerCase().startsWith("firstoption");

  // Flow Completion is ONLY true when status === "completed" (Admin explicitly marked complete)
  const filteredFlows = clientFlows.filter((cf) => {
    const isFlowCompleted = cf.status === "completed";

    if (activeTab === "in_progress" && isFlowCompleted) return false;
    if (activeTab === "completed" && !isFlowCompleted) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchClient = cf.clientName.toLowerCase().includes(q);
      const matchEmail = cf.clientEmail.toLowerCase().includes(q);
      const matchFlow = cf.flowName.toLowerCase().includes(q);
      const matchTask = cf.tasks.some((t) => t.title.toLowerCase().includes(q));
      if (!matchClient && !matchEmail && !matchFlow && !matchTask) return false;
    }

    return true;
  });

  const inProgressFlowsCount = clientFlows.filter((cf) => cf.status !== "completed").length;
  const completedFlowsCount = clientFlows.filter((cf) => cf.status === "completed").length;

  // Selected Active Flow Instance
  const activeFlow =
    filteredFlows.find((f) => f.id === activeFlowId) ||
    filteredFlows[0] ||
    clientFlows[0];

  // Extract distinct roles used in active flow tasks (plus all system roles)
  const activeFlowRoles: Array<{ id: string; name: string }> = [];
  if (activeFlow) {
    activeFlow.tasks.forEach((t) => {
      if (!activeFlowRoles.some((r) => r.name.toLowerCase() === t.roleName.toLowerCase())) {
        activeFlowRoles.push({ id: t.roleId, name: t.roleName });
      }
    });
  }
  // Ensure default roles are included
  rolesList.forEach((r) => {
    if (!activeFlowRoles.some((ar) => ar.name.toLowerCase() === r.name.toLowerCase())) {
      activeFlowRoles.push({ id: r.id, name: r.name });
    }
  });

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-slate-900 font-sans antialiased overflow-x-hidden">
      {/* Top Header Navigation */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-8 py-2.5 sm:py-3.5 sticky top-0 z-30 shadow-xs w-full max-w-full overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-sm sm:text-lg flex items-center justify-center shadow-md flex-shrink-0">
              FO
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-lg font-extrabold text-slate-900 truncate leading-tight">
                Team Workflow Canvas
              </h1>
              <div className="flex items-center space-x-1.5 sm:space-x-2 mt-0.5">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 hidden sm:inline">Your Role:</span>
                <span className="bg-indigo-100 text-indigo-800 border border-indigo-300 text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.2 rounded-full uppercase flex-shrink-0">
                  {userData?.roleName || "Staff Specialist"}
                </span>
                <span className="text-[9px] sm:text-[11px] text-slate-400 font-mono truncate max-w-[90px] sm:max-w-none">
                  ({currentUser?.email})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-3 flex-shrink-0">
            <button
              onClick={() => setIsRaiseTicketModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] sm:text-xs font-extrabold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl transition-all shadow-xs flex items-center space-x-1 sm:space-x-1.5 cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-ticket text-xs"></i>
              <span className="hidden sm:inline">Raise Ticket 🎫</span>
              <span className="sm:hidden">Raise Ticket</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => router.push("/crms")}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] sm:text-xs font-extrabold px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-xl transition-colors shadow-2xs flex items-center space-x-1 whitespace-nowrap"
              >
                <i className="fa-solid fa-sliders text-xs"></i>
                <span className="hidden sm:inline">Admin CRM Portal</span>
                <span className="sm:hidden">CRM</span>
              </button>
            )}

            <div className="hidden lg:block text-right text-xs">
              <p className="font-extrabold text-slate-900">{currentUser?.email}</p>
              <p className="text-[10px] text-slate-400 font-mono">Staff Canvas Active</p>
            </div>

            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] sm:text-xs font-extrabold px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-colors flex items-center space-x-1 whitespace-nowrap cursor-pointer"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Workspace Greeting Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <span>Team Role Canvas Board 👋</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Flows remain in <strong>In Progress</strong> until explicitly marked <strong>Completed</strong> by Admin! You can edit tasks under your role (<strong className="text-indigo-600">{userData?.roleName}</strong>).
              </p>
            </div>

            <button
              onClick={fetchData}
              disabled={isDataLoading}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors self-start sm:self-auto flex items-center space-x-1.5"
            >
              <i className={`fa-solid fa-rotate-right ${isDataLoading ? "fa-spin" : ""}`}></i>
              <span>Refresh Canvas</span>
            </button>
          </div>
        </div>

        {/* Tab Controls, Search & Active Flow Selector */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 font-sans">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab("in_progress")}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                  activeTab === "in_progress"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <i className="fa-solid fa-spinner text-amber-500"></i>
                <span>In Progress ({inProgressFlowsCount})</span>
              </button>

              <button
                onClick={() => setActiveTab("completed")}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                  activeTab === "completed"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <i className="fa-solid fa-circle-check text-emerald-600"></i>
                <span>Completed ({completedFlowsCount})</span>
              </button>
            </div>

            <div className="flex items-center space-x-3 flex-1 md:max-w-md">
              <input
                type="text"
                placeholder="Search client or task..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          {/* ACTIVE CLIENT FLOW SELECTOR TABS */}
          {filteredFlows.length > 0 && (
            <div className="pt-2 border-t border-slate-100 flex items-center space-x-2 overflow-x-auto pb-1">
              <span className="text-[11px] font-bold text-slate-500 flex-shrink-0">
                Select Client Flow Canvas:
              </span>
              {filteredFlows.map((cf) => {
                const isActive = activeFlow && activeFlow.id === cf.id;
                const completedCount = cf.tasks.filter((t) => t.isCompleted).length;

                return (
                  <button
                    key={cf.id}
                    onClick={() => setActiveFlowId(cf.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex-shrink-0 flex items-center space-x-1.5 border ${
                      isActive
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                    }`}
                  >
                    <span>🚀 {cf.clientName} ({cf.flowName})</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        isActive ? "bg-indigo-800 text-white" : "bg-slate-200 text-slate-800"
                      }`}
                    >
                      {completedCount}/{cf.tasks.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* SIDE-BY-SIDE ROLE COLUMNS CANVAS BOARD */}
        {!activeFlow ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-sm font-sans">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-xl mx-auto">
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <h3 className="text-base font-extrabold text-slate-900">
              No Client Flow Selected
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No project flows found matching the selected filter criteria.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden font-sans space-y-5 p-5 sm:p-6">
            {/* Canvas Header Summary & Admin Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-[11px] sm:text-xs font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200 uppercase">
                    🚀 {activeFlow.flowName}
                  </span>
                  <span className="text-[11px] sm:text-xs bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
                    Campaign: {activeFlow.campaign}
                  </span>
                  {activeFlow.status === "completed" && (
                    <span className="text-[11px] sm:text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded border border-emerald-300">
                      ✓ Flow Completed by Admin
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-xl font-extrabold text-slate-900 mt-1">
                  Client: {activeFlow.clientName}
                </h2>
                <p className="text-xs text-slate-400 font-mono truncate">{activeFlow.clientEmail}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  onClick={() => router.push(`/crms/view-flow?id=${activeFlow.id}`)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-md transition-all flex items-center space-x-1.5"
                >
                  <i className="fa-solid fa-[#up-right-and-arrow-up-right-from-square] fa-up-right-from-square"></i>
                  <span>Open Full Canvas Page 🚀</span>
                </button>

                {/* Admin Mark Complete Action Button */}
                {isAdmin && activeFlow.status !== "completed" && (
                  <button
                    onClick={() => handleAdminMarkFlowCompleted(activeFlow.id)}
                    disabled={isUpdatingTask}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-md transition-all flex items-center space-x-1.5"
                  >
                    <i className="fa-solid fa-flag-checkered"></i>
                    <span>Mark Flow Completed 🏁</span>
                  </button>
                )}

                <div className="text-right">
                  <span className="text-xs font-bold text-slate-700 block">
                    Task Progress
                  </span>
                  <span className="text-xs font-extrabold text-indigo-600 font-mono">
                    {activeFlow.tasks.filter((t) => t.isCompleted).length} / {activeFlow.tasks.length} Tasks Done
                  </span>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-mono font-black text-indigo-700 text-sm">
                  {Math.round(
                    (activeFlow.tasks.filter((t) => t.isCompleted).length / activeFlow.tasks.length) * 100
                  )}%
                </div>
              </div>
            </div>

            {/* SIDE-BY-SIDE ROLE COLUMNS CANVAS (Prioritizes Logged-in User's Assigned Role FIRST) */}
            {(() => {
              const sortedRoles = [...activeFlowRoles].sort((a, b) => {
                const isAMyRole =
                  userData?.roleId === a.id ||
                  (userData?.roleName && userData.roleName.toLowerCase() === a.name.toLowerCase());
                const isBMyRole =
                  userData?.roleId === b.id ||
                  (userData?.roleName && userData.roleName.toLowerCase() === b.name.toLowerCase());

                if (isAMyRole && !isBMyRole) return -1;
                if (!isAMyRole && isBMyRole) return 1;
                return 0;
              });

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
                  {sortedRoles.map((role) => {
                    const isMyRoleColumn =
                      isAdmin ||
                      userData?.roleId === role.id ||
                      userData?.roleName?.toLowerCase() === role.name.toLowerCase();

                // Get tasks assigned specifically to this role
                const roleTasks = activeFlow.tasks.filter(
                  (t) =>
                    t.roleId === role.id ||
                    t.roleName.toLowerCase() === role.name.toLowerCase()
                );

                // Get staff emails for this role
                const staffForRole = usersList.filter(
                  (u) =>
                    u.roleId === role.id ||
                    u.roleName?.toLowerCase() === role.name.toLowerCase()
                );

                const completedRoleTasksCount = roleTasks.filter((t) => t.isCompleted).length;

                return (
                  <div
                    key={role.id}
                    className={`rounded-2xl border p-4 space-y-3.5 flex flex-col justify-between transition-all ${
                      isMyRoleColumn
                        ? "bg-indigo-50/30 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm"
                        : "bg-slate-50/70 border-slate-200"
                    }`}
                  >
                    {/* Role Header & Staff Email */}
                    <div className="border-b border-slate-200/80 pb-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-1.5">
                          <span>{role.name}</span>
                          {isMyRoleColumn && (
                            <span className="text-[9px] bg-indigo-600 text-white font-extrabold px-1.5 py-0.2 rounded-full">
                              Your Role ✓
                            </span>
                          )}
                        </h3>

                        <span className="text-[10px] font-mono font-bold bg-white text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                          {completedRoleTasksCount}/{roleTasks.length} Tasks
                        </span>
                      </div>

                      {staffForRole.length > 0 ? (
                        <div className="text-[10px] font-mono font-extrabold text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded-lg truncate">
                          ✉️ {staffForRole.map((s) => s.email).join(", ")}
                        </div>
                      ) : (
                        <div className="text-[9px] font-mono text-slate-400 italic">
                          👤 Unassigned Email
                        </div>
                      )}
                    </div>

                    {/* Role Task Cards (Compact Vertical List) */}
                    <div className="space-y-3">
                      {roleTasks.length === 0 ? (
                        <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs italic">
                          No tasks assigned to {role.name} in this flow.
                        </div>
                      ) : (
                        roleTasks.map((task) => {
                          const isTaskDone = task.isCompleted || activeFlow.status === "completed";
                          const originalStepIdx = activeFlow.tasks.findIndex((t) => t.id === task.id) + 1;
                          const currentDraftText =
                            draftTexts[task.id] !== undefined ? draftTexts[task.id] : (task.textValue || "");

                          return (
                            <div
                              key={task.id}
                              className={`bg-white border rounded-xl p-3 space-y-2.5 shadow-2xs transition-all ${
                                isTaskDone
                                  ? "border-emerald-200 bg-emerald-50/10"
                                  : isMyRoleColumn
                                  ? "border-slate-300 hover:border-indigo-400"
                                  : "border-slate-200 opacity-90"
                              }`}
                            >
                              {/* Task Title & Step Badge */}
                              <div className="flex items-start space-x-2">
                                <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-extrabold flex items-center justify-center text-[10px] shadow-2xs flex-shrink-0 mt-0.5">
                                  #{originalStepIdx}
                                </span>
                                <h4 className="text-xs font-extrabold text-slate-900 leading-snug">
                                  {task.title}
                                </h4>
                              </div>

                              {/* Interactive Checkbox Control */}
                              {(task.type === "checkbox" || task.type === "both") && (
                                <div>
                                  {isMyRoleColumn ? (
                                    <label className="flex items-center space-x-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={isTaskDone}
                                        onChange={() =>
                                          handleToggleTaskCheckbox(
                                            activeFlow.id,
                                            task,
                                            currentDraftText
                                          )
                                        }
                                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                                      />
                                      <span
                                        className={`text-xs font-bold ${
                                          isTaskDone
                                            ? "text-emerald-800 line-through"
                                            : "text-slate-800"
                                        }`}
                                      >
                                        {isTaskDone ? "Completed Step" : "Mark Done"}
                                      </span>
                                    </label>
                                  ) : (
                                    <div className="flex items-center space-x-2 p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-400">
                                      <input
                                        type="checkbox"
                                        checked={isTaskDone}
                                        disabled
                                        className="w-4 h-4 text-slate-400 rounded cursor-not-allowed"
                                      />
                                      <span className="text-[11px] font-bold text-slate-500">
                                        {isTaskDone ? "Completed" : "🔒 Read-Only"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Work Notes / Text Input with Save Button */}
                              {(task.type === "text" || task.type === "both") && (
                                <div className="space-y-1">
                                  {isMyRoleColumn ? (
                                    <div className="flex items-center space-x-1.5">
                                      <input
                                        type="text"
                                        placeholder="Type work notes / link..."
                                        value={currentDraftText}
                                        onChange={(e) =>
                                          setDraftTexts((prev) => ({
                                            ...prev,
                                            [task.id]: e.target.value,
                                          }))
                                        }
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleInitiateSaveText(
                                            activeFlow.id,
                                            task,
                                            currentDraftText
                                          )
                                        }
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-xl transition-colors shadow-2xs flex-shrink-0 flex items-center space-x-1"
                                      >
                                        <i className="fa-solid fa-floppy-disk"></i>
                                        <span>Save</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-mono font-bold truncate">
                                      {task.textValue || "No notes entered"}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Completion Timestamp Tag */}
                              {task.completedAt ? (
                                <div className="text-[10px] font-mono text-emerald-800 bg-emerald-100/90 border border-emerald-300 p-1.5 rounded-lg font-extrabold flex items-center justify-between">
                                  <span>✓ {new Date(task.completedAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                                  <span className="truncate max-w-[90px]">{task.completedBy?.split("@")[0]}</span>
                                </div>
                              ) : (
                                <div className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 p-1 rounded-lg font-bold text-center">
                                  ⏳ Status: Pending
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    )}
      </main>

      {/* UNCHECK WARNING MODAL POPUP */}
      {uncheckWarningModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setUncheckWarningModalData(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 border border-amber-200 z-10 font-sans animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-lg font-black shadow-2xs">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Reset Task Completion?
                </h3>
                <p className="text-xs text-amber-700 font-bold">
                  Completion Timestamp Reset Warning
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <p className="text-amber-900 font-semibold leading-relaxed">
                Unchecking <strong className="text-slate-900 font-extrabold underline">{uncheckWarningModalData.taskTitle}</strong> will remove the current completion date/time stamp and set the status back to <span className="font-extrabold">In Progress</span>.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setUncheckWarningModalData(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isUpdatingTask}
                onClick={handleConfirmUncheckTask}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isUpdatingTask ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                ) : (
                  <i className="fa-solid fa-rotate-left text-xs"></i>
                )}
                <span>Reset & Mark In Progress ⏳</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TEXT WARNING MODAL POPUP (NEW TIMESTAMP WARNING) */}
      {editTextWarningModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setEditTextWarningModalData(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 border border-indigo-200 z-10 font-sans animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-indigo-600">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-lg font-black shadow-2xs">
                🕒
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Update Note & Timestamp?
                </h3>
                <p className="text-xs text-indigo-700 font-bold">
                  New Current Date/Time Stamp Will Be Added
                </p>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <p className="text-indigo-950 font-semibold leading-relaxed">
                Saving changes to <strong className="text-slate-900 font-extrabold underline">{editTextWarningModalData.task.title}</strong> will update the saved note and stamp the <span className="font-extrabold text-indigo-700">NEW current date and time</span>!
              </p>

              <div className="bg-white border border-indigo-200 rounded-xl p-2.5 space-y-1 font-mono text-[11px]">
                <span className="text-slate-500 font-bold block">New Note Content:</span>
                <p className="text-slate-900 font-extrabold truncate">"{editTextWarningModalData.newText}"</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setEditTextWarningModalData(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isUpdatingTask}
                onClick={() =>
                  executeSaveTextValue(
                    editTextWarningModalData.clientFlowId,
                    editTextWarningModalData.task,
                    editTextWarningModalData.newText
                  )
                }
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isUpdatingTask ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                ) : (
                  <i className="fa-solid fa-floppy-disk text-xs"></i>
                )}
                <span>Save & Set New Date/Time 🕒</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RAISE SUPPORT TICKET MODAL */}
      {isRaiseTicketModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <i className="fa-solid fa-ticket text-indigo-600"></i>
                <span>Raise Support Ticket</span>
              </h3>
              <button
                onClick={() => setIsRaiseTicketModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
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

            <form onSubmit={handleRaiseTicketSubmit} className="space-y-4 text-xs font-bold text-slate-700">
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
                <label className="block mb-1 text-slate-900 font-extrabold">Subject / Issue Title *</label>
                <input
                  type="text"
                  required
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="e.g. Unable to complete task #2 in workflow"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 font-bold"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-900 font-extrabold">Detailed Description *</label>
                <textarea
                  required
                  rows={4}
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Please write the issue details here..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 font-bold"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRaiseTicketModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTicket}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingTicket && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                  <span>Submit Ticket & Alert Admin 🚀</span>
                </button>
              </div>
            </form>

            {/* MY PREVIOUSLY RAISED TICKETS */}
            {myTicketsList.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-black text-slate-900 flex items-center space-x-1.5">
                  <i className="fa-solid fa-clock-rotate-left text-slate-500"></i>
                  <span>My Submitted Tickets ({myTicketsList.length})</span>
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {myTicketsList.map((t) => (
                    <div key={t.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 font-mono">#{t.ticketNumber}</span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            t.status === "resolved"
                              ? "bg-emerald-100 text-emerald-800"
                              : t.status === "in_progress"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {t.status === "resolved" ? "✅ Resolved" : t.status === "in_progress" ? "🟡 In Progress" : "🔴 Open"}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800">{t.subject}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{t.levelLabel}</span>
                        <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
