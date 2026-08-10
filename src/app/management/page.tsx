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

  // 20+ Roles Management Controls State
  const [roleSearchQuery, setRoleSearchQuery] = useState<string>("");
  const [roleFilterMode, setRoleFilterMode] = useState<"all" | "my_role" | "pending" | "assigned">("all");
  const [roleLayoutMode, setRoleLayoutMode] = useState<"accordion" | "grid" | "matrix">("accordion");
  const [selectedRoleDropdown, setSelectedRoleDropdown] = useState<string>("all");
  const [collapsedRoleIds, setCollapsedRoleIds] = useState<Record<string, boolean>>({});

  // Support Ticket Modal & State
  const [isRaiseTicketModalOpen, setIsRaiseTicketModalOpen] = useState(false);
  const [ticketLevel, setTicketLevel] = useState<"level1" | "level2" | "level3" | "level4">("level3");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketSuccessMsg, setTicketSuccessMsg] = useState("");
  const [ticketErrorMsg, setTicketErrorMsg] = useState("");
  const [myTicketsList, setMyTicketsList] = useState<SupportTicket[]>([]);

  // Selected Flow Canvas State
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

  // Edit Text Warning Modal State
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

      // Read initial flow ID from URL if explicitly passed in query (?id=... or ?flowId=...)
      if (typeof window !== "undefined" && !activeFlowId) {
        const urlParams = new URLSearchParams(window.location.search);
        const queryFlowId = urlParams.get("id") || urlParams.get("flowId");
        if (queryFlowId && flows.some((f) => f.id === queryFlowId)) {
          setActiveFlowId(queryFlowId);
        }
      }
    } catch (err) {
      console.error("Management Fetch Error:", err);
    } finally {
      setIsDataLoading(false);
    }
  }, [currentUser, activeFlowId]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

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

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  // Helper to check if current logged in user can edit a specific task/role
  const canUserEditRoleTask = (roleId?: string, roleName?: string) => {
    if (!userData) return false;
    const userRoleId = userData.roleId || "";
    const userRoleNameLower = (userData.roleName || "").toLowerCase().trim();
    const taskRoleId = roleId || "";
    const taskRoleNameLower = (roleName || "").toLowerCase().trim();

    return (
      (userRoleId && taskRoleId && userRoleId === taskRoleId) ||
      (userRoleNameLower && taskRoleNameLower && userRoleNameLower === taskRoleNameLower)
    );
  };

  // Toggle Checkbox Status Handler: Strictly restricted to assigned role specialist
  const handleToggleTaskCheckbox = async (
    clientFlowId: string,
    task: ClientFlowTask,
    currentText: string
  ) => {
    if (!canUserEditRoleTask(task.roleId, task.roleName)) {
      alert(`⚠️ Permission Denied: Only staff assigned to the '${task.roleName}' role can edit or complete this task.`);
      return;
    }

    if (task.isCompleted) {
      setUncheckWarningModalData({
        clientFlowId,
        taskId: task.id,
        taskTitle: task.title,
        currentText,
      });
      return;
    }

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

  // Confirm Uncheck Action
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

  // Initiate Text Input Save
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

  // Execute Save Text Value
  const executeSaveTextValue = async (
    clientFlowId: string,
    task: ClientFlowTask,
    newText: string
  ) => {
    if (!canUserEditRoleTask(task.roleId, task.roleName)) {
      alert(`⚠️ Permission Denied: Only staff assigned to the '${task.roleName}' role can update notes for this task.`);
      return;
    }

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

  // Toggle Accordion Role Collapse state
  const toggleRoleCollapse = (roleId: string) => {
    setCollapsedRoleIds((prev) => ({
      ...prev,
      [roleId]: !prev[roleId],
    }));
  };

  const expandAllRoles = (roleIds: string[]) => {
    const updated: Record<string, boolean> = {};
    roleIds.forEach((id) => (updated[id] = false));
    setCollapsedRoleIds(updated);
  };

  const collapseAllRoles = (roleIds: string[]) => {
    const updated: Record<string, boolean> = {};
    roleIds.forEach((id) => (updated[id] = true));
    setCollapsedRoleIds(updated);
  };

  if (authLoading) {
    return (
      <div className="w-full min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-indigo-600 font-bold text-sm bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
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

  const canAccessCRM =
    isAdmin ||
    userData?.roleId === "role_appointment_setter_1" ||
    userData?.roleName === "Appointment_Setter_1" ||
    userData?.roleName?.toLowerCase().includes("appointment_setter");

  // Filter flows by tab status & search & user task assignment
  const filteredFlows = clientFlows.filter((cf) => {
    const isFlowCompleted = cf.status === "completed";

    if (activeTab === "in_progress" && isFlowCompleted) return false;
    if (activeTab === "completed" && !isFlowCompleted) return false;

    // For non-admin staff users (e.g. Sadaam Amir), only show workflows containing tasks assigned to their role
    if (!isAdmin) {
      const userRoleId = userData?.roleId || "";
      const userRoleNameLower = (userData?.roleName || "").toLowerCase();

      const hasMyTask = cf.tasks.some(
        (t) =>
          (userRoleId && t.roleId === userRoleId) ||
          (userRoleNameLower && (t.roleName || "").toLowerCase().includes(userRoleNameLower))
      );
      if (!hasMyTask) return false;
    }

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

  // Active Flow Instance: null by default until user selects a client flow
  const activeFlow = activeFlowId ? clientFlows.find((f) => f.id === activeFlowId) || null : null;

  // Calculate pending tasks assigned to current user's role across all client flows
  const myRoleNameLower = (userData?.roleName || "").toLowerCase();
  const myRoleId = userData?.roleId || "";
  const myAssignedTasksCount = clientFlows.reduce((acc, flow) => {
    const matchingTasks = flow.tasks.filter(
      (t) =>
        !t.isCompleted &&
        (t.roleId === myRoleId || (myRoleNameLower && t.roleName.toLowerCase() === myRoleNameLower))
    );
    return acc + matchingTasks.length;
  }, 0);

  // Distinct roles in active flow
  const activeFlowRoles: Array<{ id: string; name: string }> = [];
  if (activeFlow) {
    activeFlow.tasks.forEach((t) => {
      if (!activeFlowRoles.some((r) => r.name.toLowerCase() === t.roleName.toLowerCase())) {
        activeFlowRoles.push({ id: t.roleId, name: t.roleName });
      }
    });

    rolesList.forEach((r) => {
      if (!activeFlowRoles.some((ar) => ar.name.toLowerCase() === r.name.toLowerCase())) {
        activeFlowRoles.push({ id: r.id, name: r.name });
      }
    });
  }

  const userInitial = (currentUser?.email?.[0] || "U").toUpperCase();

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-slate-900 font-sans antialiased">
      {/* Top Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Brand & User Role */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-xs flex-shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 truncate leading-snug">
                Team Workflow Management
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

          {/* Header Action Buttons */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => setIsRaiseTicketModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-ticket text-xs"></i>
              <span className="hidden sm:inline">Raise Ticket</span>
            </button>

            {canAccessCRM && (
              <button
                onClick={() => router.push("/crms")}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition-colors flex items-center space-x-1 cursor-pointer"
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Workspace Title Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              {activeFlow ? (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setActiveFlowId(null)}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center text-xs transition-colors cursor-pointer"
                    title="Back to All Client Flows"
                  >
                    <i className="fa-solid fa-arrow-left"></i>
                  </button>
                  <div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                      Workflow Board — {activeFlow.clientName}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Managing tasks for <strong className="text-indigo-600">{activeFlow.flowName}</strong> ({activeFlowRoles.length} Roles Active).
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    Client Workflows & Deliverables 👋
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Welcome, <strong className="text-indigo-600">{userData?.roleName || "Staff"}</strong>. Select a client flow below to review deliverables, update task notes, and track progress.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto">
              {activeFlow && (
                <button
                  onClick={() => setActiveFlowId(null)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  <i className="fa-solid fa-layer-group text-xs"></i>
                  <span>All Client Flows</span>
                </button>
              )}
              <button
                onClick={fetchData}
                disabled={isDataLoading}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer"
              >
                <i className={`fa-solid fa-rotate-right ${isDataLoading ? "fa-spin" : ""}`}></i>
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Filter & Selector Toolbar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Status Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold self-start">
              <button
                onClick={() => setActiveTab("in_progress")}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
                  activeTab === "in_progress"
                    ? "bg-white text-indigo-700 shadow-2xs font-extrabold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <i className="fa-solid fa-spinner text-amber-500 text-xs"></i>
                <span>In Progress ({inProgressFlowsCount})</span>
              </button>

              <button
                onClick={() => setActiveTab("completed")}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-2 cursor-pointer ${
                  activeTab === "completed"
                    ? "bg-white text-emerald-700 shadow-2xs font-extrabold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <i className="fa-solid fa-circle-check text-emerald-600 text-xs"></i>
                <span>Completed ({completedFlowsCount})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:max-w-xs">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Search client, email, task..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 shadow-2xs"
              />
            </div>
          </div>

          {/* Primary Select Client Flow Dropdown Control */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 w-full sm:w-auto">
              <label className="text-xs font-bold text-slate-700 flex-shrink-0 flex items-center space-x-1.5">
                <i className="fa-solid fa-user-gear text-indigo-600"></i>
                <span>Select Client Flow:</span>
              </label>

              <select
                value={activeFlowId || ""}
                onChange={(e) => setActiveFlowId(e.target.value || null)}
                className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 shadow-2xs cursor-pointer"
              >
                <option value="">— Choose a Client Flow ({filteredFlows.length} available) —</option>
                {filteredFlows.map((cf) => {
                  const completed = cf.tasks.filter((t) => t.isCompleted).length;
                  return (
                    <option key={cf.id} value={cf.id}>
                      {cf.clientName} — {cf.flowName} ({completed}/{cf.tasks.length} tasks)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quick Pill Chips for Fast 1-Click Navigation */}
            {filteredFlows.length > 0 && (
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 max-w-full sm:max-w-md">
                {filteredFlows.slice(0, 5).map((cf) => {
                  const isActive = activeFlow && activeFlow.id === cf.id;
                  const completedCount = cf.tasks.filter((t) => t.isCompleted).length;

                  return (
                    <button
                      key={cf.id}
                      onClick={() => setActiveFlowId(cf.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center space-x-1.5 border cursor-pointer ${
                        isActive
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                      }`}
                    >
                      <span className="truncate max-w-[120px]">{cf.clientName}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          isActive ? "bg-indigo-800 text-white" : "bg-slate-200 text-slate-700"
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
        </div>

        {/* DEFAULT VIEW: When No Client Flow is Selected -> Render Client Flows Directory */}
        {!activeFlow ? (
          <div className="space-y-6">
            {/* KPI Summary Statistics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-lg flex-shrink-0">
                  <i className="fa-solid fa-folder-tree"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Flows</p>
                  <p className="text-xl font-extrabold text-slate-900">{clientFlows.length}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-lg flex-shrink-0">
                  <i className="fa-solid fa-spinner"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">In Progress</p>
                  <p className="text-xl font-extrabold text-slate-900">{inProgressFlowsCount}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-lg flex-shrink-0">
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed</p>
                  <p className="text-xl font-extrabold text-slate-900">{completedFlowsCount}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center text-lg flex-shrink-0">
                  <i className="fa-solid fa-list-check"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Pending Tasks</p>
                  <p className="text-xl font-extrabold text-purple-700">{myAssignedTasksCount}</p>
                </div>
              </div>
            </div>

            {/* Client Flows Directory Section */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                    <i className="fa-solid fa-layer-group text-indigo-600"></i>
                    <span>Select a Client Workflow</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Click any client card below to open their workflow board and start updating tasks.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  Showing {filteredFlows.length} of {clientFlows.length} Workflows
                </span>
              </div>

              {filteredFlows.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-xl mx-auto">
                    <i className="fa-solid fa-magnifying-glass"></i>
                  </div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    No Client Flows Match Criteria
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Try adjusting your search keywords or switching between "In Progress" and "Completed" filters.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredFlows.map((cf) => {
                    const completedCount = cf.tasks.filter((t) => t.isCompleted).length;
                    const totalTasks = cf.tasks.length;
                    const progressPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
                    const isCompleted = cf.status === "completed" || progressPct === 100;
                    const firstPending = cf.tasks.find((t) => !t.isCompleted);

                    const distinctRoles = Array.from(new Set(cf.tasks.map((t) => t.roleName)));
                    const initials = cf.clientName
                      ? cf.clientName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()
                      : "CL";

                    return (
                      <div
                        key={cf.id}
                        onClick={() => setActiveFlowId(cf.id)}
                        className="bg-white border border-slate-200 hover:border-indigo-500 hover:shadow-md rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between group space-y-4"
                      >
                        {/* Top: Avatar, Client Name, Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-sm flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-2xs">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                                {cf.clientName}
                              </h4>
                              <p className="text-xs text-slate-400 font-mono truncate">{cf.clientEmail}</p>
                            </div>
                          </div>

                          {isCompleted ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md flex-shrink-0 flex items-center space-x-1 uppercase">
                              <i className="fa-solid fa-check text-[10px]"></i>
                              <span>Completed</span>
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md flex-shrink-0 flex items-center space-x-1 uppercase">
                              <i className="fa-solid fa-clock text-[10px]"></i>
                              <span>In Progress</span>
                            </span>
                          )}
                        </div>

                        {/* Flow Info & Campaign */}
                        <div className="space-y-1.5 bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-indigo-700 truncate font-mono">🚀 {cf.flowName}</span>
                            <span className="text-slate-500 text-[11px] uppercase tracking-wider font-mono">{cf.campaign}</span>
                          </div>
                          {firstPending ? (
                            <p className="text-xs text-slate-600 font-medium truncate pt-0.5">
                              <span className="text-slate-400 font-normal">Next:</span> #{cf.tasks.findIndex((t) => t.id === firstPending.id) + 1} {firstPending.title} ({firstPending.roleName})
                            </p>
                          ) : (
                            <p className="text-xs text-emerald-600 font-semibold truncate pt-0.5">
                              ✓ All {totalTasks} deliverables completed!
                            </p>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                            <span>Progress</span>
                            <span className="font-mono text-slate-900 font-extrabold">
                              {completedCount}/{totalTasks} Tasks ({progressPct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCompleted ? "bg-emerald-500" : "bg-indigo-600"
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Card Footer: Roles & Action */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-medium">
                            {distinctRoles.length} {distinctRoles.length === 1 ? "Role" : "Roles"} involved
                          </span>
                          <span className="text-xs font-extrabold text-indigo-600 group-hover:text-indigo-700 flex items-center space-x-1.5">
                            <span>Open Workflow</span>
                            <i className="fa-solid fa-arrow-right text-[11px] group-hover:translate-x-1 transition-transform"></i>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden font-sans p-5 sm:p-6 space-y-6">
            
            {/* Active Canvas Header Metrics Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                    🚀 {activeFlow.flowName}
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded border border-slate-200">
                    Campaign: {activeFlow.campaign}
                  </span>
                  {activeFlow.status === "completed" && (
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded border border-emerald-300">
                      ✓ Flow Completed by Admin
                    </span>
                  )}
                </div>

                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 pt-1">
                  Client: {activeFlow.clientName}
                </h2>
                <p className="text-xs text-slate-500 font-mono">{activeFlow.clientEmail}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setActiveFlowId(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-left text-xs"></i>
                  <span>Change Client</span>
                </button>

                <button
                  onClick={() => router.push(`/crms/view-flow?id=${activeFlow.id}`)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                  <span>Full View Page</span>
                </button>

                {isAdmin && activeFlow.status !== "completed" && (
                  <button
                    onClick={() => handleAdminMarkFlowCompleted(activeFlow.id)}
                    disabled={isUpdatingTask}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-flag-checkered text-xs"></i>
                    <span>Mark Completed 🏁</span>
                  </button>
                )}

                {/* Progress Badge */}
                {(() => {
                  const completedTasksCount = activeFlow.tasks.filter((t) => t.isCompleted).length;
                  const totalTasksCount = activeFlow.tasks.length;
                  const progressPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

                  return (
                    <div className="flex items-center space-x-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase block">Progress</span>
                        <span className="text-xs font-extrabold text-slate-900 font-mono">{completedTasksCount}/{totalTasksCount} Tasks</span>
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white font-mono font-extrabold text-xs flex items-center justify-center shadow-2xs">
                        {progressPct}%
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* 20+ ROLES OPTIMIZED SEARCH & TOOLBAR CONTROLS */}
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

              // Filtered roles list based on user search & filter modes
              const filteredRoles = sortedRoles.filter((role) => {
                const isMyRole =
                  userData?.roleId === role.id ||
                  userData?.roleName?.toLowerCase() === role.name.toLowerCase();

                const roleTasks = activeFlow.tasks.filter(
                  (t) => t.roleId === role.id || t.roleName.toLowerCase() === role.name.toLowerCase()
                );

                const staffForRole = usersList.filter(
                  (u) => u.roleId === role.id || u.roleName?.toLowerCase() === role.name.toLowerCase()
                );

                const completedCount = roleTasks.filter((t) => t.isCompleted).length;
                const hasPending = roleTasks.length > 0 && completedCount < roleTasks.length;

                if (selectedRoleDropdown !== "all" && role.id !== selectedRoleDropdown) return false;

                if (roleFilterMode === "my_role" && !isMyRole) return false;
                if (roleFilterMode === "pending" && !hasPending) return false;
                if (roleFilterMode === "assigned" && staffForRole.length === 0) return false;

                if (roleSearchQuery.trim()) {
                  const q = roleSearchQuery.toLowerCase();
                  const matchRole = role.name.toLowerCase().includes(q);
                  const matchStaff = staffForRole.some((s) => s.email.toLowerCase().includes(q));
                  const matchTasks = roleTasks.some((t) => t.title.toLowerCase().includes(q));
                  if (!matchRole && !matchStaff && !matchTasks) return false;
                }

                return true;
              });

              const allRoleIds = sortedRoles.map((r) => r.id);

              return (
                <div className="space-y-4">
                  
                  {/* TOOLBAR: Search 20+ roles, Dropdown, Filter Pills & View Mode Switcher */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      
                      {/* Left: Role Search & Dropdown Jump */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-2xl">
                        <div className="relative flex-1">
                          <i className="fa-solid fa-filter absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 text-xs"></i>
                          <input
                            type="text"
                            placeholder={`Search among ${sortedRoles.length} roles, staff or tasks...`}
                            value={roleSearchQuery}
                            onChange={(e) => setRoleSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                          />
                        </div>

                        {/* Dropdown Jump */}
                        <select
                          value={selectedRoleDropdown}
                          onChange={(e) => setSelectedRoleDropdown(e.target.value)}
                          className="bg-white border border-slate-300 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-600 max-w-full sm:max-w-[200px]"
                        >
                          <option value="all">🎯 All Roles ({sortedRoles.length})</option>
                          {sortedRoles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Right: View Mode Switcher (Accordion vs Grid vs Table Matrix) */}
                      <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs self-end lg:self-auto">
                        <button
                          type="button"
                          onClick={() => setRoleLayoutMode("accordion")}
                          className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                            roleLayoutMode === "accordion"
                              ? "bg-indigo-600 text-white shadow-2xs font-extrabold"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                          title="Accordion List View (Best for Mobile)"
                        >
                          <i className="fa-solid fa-list-ul"></i>
                          <span>List View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRoleLayoutMode("grid")}
                          className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                            roleLayoutMode === "grid"
                              ? "bg-indigo-600 text-white shadow-2xs font-extrabold"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                          title="Kanban Grid Columns View"
                        >
                          <i className="fa-solid fa-[#table-cells-large] fa-table-cells-large"></i>
                          <span>Grid Columns</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRoleLayoutMode("matrix")}
                          className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                            roleLayoutMode === "matrix"
                              ? "bg-indigo-600 text-white shadow-2xs font-extrabold"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                          title="High-Density Spreadsheet Matrix View"
                        >
                          <i className="fa-solid fa-[#table-list] fa-table-list"></i>
                          <span>Table Matrix</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Filter Badges & Accordion Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
                      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
                        <span className="text-[11px] font-bold text-slate-500 flex-shrink-0">Filter:</span>
                        
                        <button
                          type="button"
                          onClick={() => setRoleFilterMode("all")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            roleFilterMode === "all"
                              ? "bg-indigo-100 text-indigo-800 border border-indigo-300 font-extrabold"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          All ({sortedRoles.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => setRoleFilterMode("my_role")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1 ${
                            roleFilterMode === "my_role"
                              ? "bg-indigo-600 text-white font-extrabold shadow-2xs"
                              : "bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50"
                          }`}
                        >
                          <span>⭐ My Role</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRoleFilterMode("pending")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1 ${
                            roleFilterMode === "pending"
                              ? "bg-amber-500 text-slate-950 font-extrabold shadow-2xs"
                              : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
                          }`}
                        >
                          <span>⏳ Incomplete Tasks</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRoleFilterMode("assigned")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1 ${
                            roleFilterMode === "assigned"
                              ? "bg-slate-800 text-white font-extrabold shadow-2xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <span>👤 Assigned Staff</span>
                        </button>
                      </div>

                      {/* Accordion Expand/Collapse All Buttons */}
                      {roleLayoutMode === "accordion" && (
                        <div className="flex items-center space-x-2 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => expandAllRoles(allRoleIds)}
                            className="text-[11px] font-bold text-indigo-600 hover:underline"
                          >
                            Expand All
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => collapseAllRoles(allRoleIds)}
                            className="text-[11px] font-bold text-slate-500 hover:underline"
                          >
                            Collapse All
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Quick-Jump Horizontal Role Chips */}
                    <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] font-mono text-slate-400 uppercase flex-shrink-0 font-bold">
                        Quick Jump:
                      </span>
                      {sortedRoles.map((r) => {
                        const isMyRole =
                          userData?.roleId === r.id ||
                          userData?.roleName?.toLowerCase() === r.name.toLowerCase();

                        const rTasks = activeFlow.tasks.filter(
                          (t) => t.roleId === r.id || t.roleName.toLowerCase() === r.name.toLowerCase()
                        );
                        const doneCount = rTasks.filter((t) => t.isCompleted).length;

                        return (
                          <button
                            type="button"
                            key={r.id}
                            onClick={() => {
                              setSelectedRoleDropdown(r.id);
                              setCollapsedRoleIds((prev) => ({ ...prev, [r.id]: false }));
                            }}
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap flex items-center space-x-1 border ${
                              selectedRoleDropdown === r.id
                                ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs font-extrabold"
                                : isMyRole
                                ? "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <span>{r.name}</span>
                            <span className="text-[9px] opacity-80 font-mono">({doneCount}/{rTasks.length})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* DISPLAY MODE 1: ACCORDION LIST VIEW (BEST FOR MOBILE & 20+ ROLES) */}
                  {roleLayoutMode === "accordion" && (
                    <div className="space-y-3">
                      {filteredRoles.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 font-medium space-y-1">
                          <p className="font-extrabold text-slate-800">No matching roles found.</p>
                          <p>Try clearing your role search or filter selection.</p>
                        </div>
                      ) : (
                        filteredRoles.map((role) => {
                          const isMyRoleColumn =
                            userData?.roleId === role.id ||
                            userData?.roleName?.toLowerCase() === role.name.toLowerCase();

                          const roleTasks = activeFlow.tasks.filter(
                            (t) =>
                              t.roleId === role.id ||
                              t.roleName.toLowerCase() === role.name.toLowerCase()
                          );

                          const staffForRole = usersList.filter(
                            (u) =>
                              u.roleId === role.id ||
                              u.roleName?.toLowerCase() === role.name.toLowerCase()
                          );

                          const completedCount = roleTasks.filter((t) => t.isCompleted).length;
                          const isCollapsed = Boolean(collapsedRoleIds[role.id]);

                          return (
                            <div
                              key={role.id}
                              className={`bg-white border rounded-2xl overflow-hidden shadow-2xs transition-all ${
                                isMyRoleColumn
                                  ? "border-indigo-300 ring-1 ring-indigo-500/20"
                                  : "border-slate-200"
                              }`}
                            >
                              {/* Accordion Header */}
                              <div
                                onClick={() => toggleRoleCollapse(role.id)}
                                className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                                  isMyRoleColumn ? "bg-indigo-50/50 hover:bg-indigo-50" : "bg-slate-50/60 hover:bg-slate-100/80"
                                }`}
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-indigo-700 font-extrabold text-xs flex items-center justify-center flex-shrink-0 shadow-2xs">
                                    <i className="fa-solid fa-user-gear"></i>
                                  </div>
                                  
                                  <div className="min-w-0">
                                    <div className="flex items-center space-x-2">
                                      <h3 className="text-sm font-extrabold text-slate-900 truncate">
                                        {role.name}
                                      </h3>
                                      {isMyRoleColumn && (
                                        <span className="text-[9px] bg-indigo-600 text-white font-black px-2 py-0.2 rounded-full uppercase flex-shrink-0">
                                          Your Role ✓
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-mono truncate">
                                      {staffForRole.length > 0 ? `✉️ ${staffForRole.map((s) => s.email).join(", ")}` : "👤 Unassigned"}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-3 flex-shrink-0">
                                  <span className="text-xs font-mono font-bold bg-white text-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                                    {completedCount}/{roleTasks.length} Done
                                  </span>

                                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 text-xs">
                                    <i className={`fa-solid ${isCollapsed ? "fa-chevron-down" : "fa-chevron-up"}`}></i>
                                  </div>
                                </div>
                              </div>

                              {/* Accordion Content (Task Cards) */}
                              {!isCollapsed && (
                                <div className="p-4 border-t border-slate-200 bg-white space-y-3">
                                  {roleTasks.length === 0 ? (
                                    <div className="p-4 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 italic">
                                      No tasks assigned to {role.name} in this flow.
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {roleTasks.map((task) => {
                                        const isTaskDone = Boolean(task.isCompleted === true);
                                        const originalStepIdx = activeFlow.tasks.findIndex((t) => t.id === task.id) + 1;
                                        const currentDraftText =
                                          draftTexts[task.id] !== undefined ? draftTexts[task.id] : (task.textValue || "");

                                        return (
                                          <div
                                            key={task.id}
                                            className={`bg-white border rounded-xl p-3.5 space-y-2.5 shadow-2xs transition-all ${
                                              isTaskDone
                                                ? "border-emerald-200 bg-emerald-50/20"
                                                : isMyRoleColumn
                                                ? "border-slate-300 hover:border-indigo-400"
                                                : "border-slate-200 opacity-90"
                                            }`}
                                          >
                                            <div className="flex items-start space-x-2">
                                              <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-extrabold flex items-center justify-center text-[10px] shadow-2xs flex-shrink-0 mt-0.5">
                                                #{originalStepIdx}
                                              </span>
                                              <h4 className="text-xs font-bold text-slate-900 leading-snug">
                                                {task.title}
                                              </h4>
                                            </div>

                                            {(task.type === "checkbox" || task.type === "both") && (
                                              <div>
                                                {isMyRoleColumn ? (
                                                  <label className="flex items-center space-x-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
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
                                                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                    <span
                                                      className={`text-xs font-bold ${
                                                        isTaskDone
                                                          ? "text-emerald-800 line-through"
                                                          : "text-slate-800"
                                                      }`}
                                                    >
                                                      {isTaskDone ? "Completed Step" : "Mark as Done"}
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
                                                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
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
                                                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-2xs flex-shrink-0 flex items-center space-x-1"
                                                    >
                                                      <i className="fa-solid fa-floppy-disk"></i>
                                                      <span>Save</span>
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-mono font-medium truncate">
                                                    {task.textValue || "No notes entered"}
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {task.completedAt ? (
                                              <div className="text-[10px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 p-1.5 rounded-lg font-bold flex items-center justify-between">
                                                <span>✓ {new Date(task.completedAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                                                <span className="truncate max-w-[90px]">{task.completedBy?.split("@")[0]}</span>
                                              </div>
                                            ) : (
                                              <div className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 p-1 rounded-lg font-medium text-center">
                                                ⏳ Status: Pending
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* DISPLAY MODE 2: KANBAN GRID COLUMNS VIEW */}
                  {roleLayoutMode === "grid" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
                      {filteredRoles.map((role) => {
                        const isMyRoleColumn =
                          userData?.roleId === role.id ||
                          userData?.roleName?.toLowerCase() === role.name.toLowerCase();

                        const roleTasks = activeFlow.tasks.filter(
                          (t) =>
                            t.roleId === role.id ||
                            t.roleName.toLowerCase() === role.name.toLowerCase()
                        );

                        const staffForRole = usersList.filter(
                          (u) =>
                            u.roleId === role.id ||
                            u.roleName?.toLowerCase() === role.name.toLowerCase()
                        );

                        const completedRoleTasksCount = roleTasks.filter((t) => t.isCompleted).length;

                        return (
                          <div
                            key={role.id}
                            className={`rounded-2xl border p-4 space-y-4 flex flex-col justify-between transition-all ${
                              isMyRoleColumn
                                ? "bg-indigo-50/40 border-indigo-200 ring-1 ring-indigo-500/20 shadow-2xs"
                                : "bg-slate-50/70 border-slate-200"
                            }`}
                          >
                            <div className="border-b border-slate-200 pb-3 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-1.5">
                                  <span>{role.name}</span>
                                  {isMyRoleColumn && (
                                    <span className="text-[9px] bg-indigo-600 text-white font-extrabold px-1.5 py-0.5 rounded-full">
                                      Your Role ✓
                                    </span>
                                  )}
                                </h3>

                                <span className="text-[10px] font-mono font-bold bg-white text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                                  {completedRoleTasksCount}/{roleTasks.length} Done
                                </span>
                              </div>

                              {staffForRole.length > 0 ? (
                                <div className="text-[10px] font-mono font-semibold text-indigo-700 bg-white border border-indigo-100 px-2 py-0.5 rounded-lg truncate">
                                  ✉️ {staffForRole.map((s) => s.email).join(", ")}
                                </div>
                              ) : (
                                <div className="text-[10px] font-mono text-slate-400 italic">
                                  👤 Unassigned Email
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              {roleTasks.length === 0 ? (
                                <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs italic">
                                  No tasks assigned to {role.name}.
                                </div>
                              ) : (
                                roleTasks.map((task) => {
                                  const isTaskDone = Boolean(task.isCompleted === true);
                                  const originalStepIdx = activeFlow.tasks.findIndex((t) => t.id === task.id) + 1;
                                  const currentDraftText =
                                    draftTexts[task.id] !== undefined ? draftTexts[task.id] : (task.textValue || "");

                                  return (
                                    <div
                                      key={task.id}
                                      className={`bg-white border rounded-xl p-3.5 space-y-2.5 shadow-2xs transition-all ${
                                        isTaskDone
                                          ? "border-emerald-200 bg-emerald-50/20"
                                          : isMyRoleColumn
                                          ? "border-slate-300 hover:border-indigo-400"
                                          : "border-slate-200 opacity-90"
                                      }`}
                                    >
                                      <div className="flex items-start space-x-2">
                                        <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-extrabold flex items-center justify-center text-[10px] shadow-2xs flex-shrink-0 mt-0.5">
                                          #{originalStepIdx}
                                        </span>
                                        <h4 className="text-xs font-bold text-slate-900 leading-snug">
                                          {task.title}
                                        </h4>
                                      </div>

                                      {(task.type === "checkbox" || task.type === "both") && (
                                        <div>
                                          {isMyRoleColumn ? (
                                            <label className="flex items-center space-x-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
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
                                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                              />
                                              <span
                                                className={`text-xs font-bold ${
                                                  isTaskDone
                                                    ? "text-emerald-800 line-through"
                                                    : "text-slate-800"
                                                }`}
                                              >
                                                {isTaskDone ? "Completed Step" : "Mark as Done"}
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
                                                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
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
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-colors shadow-2xs flex-shrink-0 flex items-center space-x-1"
                                              >
                                                <i className="fa-solid fa-floppy-disk"></i>
                                                <span>Save</span>
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-mono font-medium truncate">
                                              {task.textValue || "No notes entered"}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {task.completedAt ? (
                                        <div className="text-[10px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 p-1.5 rounded-lg font-bold flex items-center justify-between">
                                          <span>✓ {new Date(task.completedAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                                          <span className="truncate max-w-[90px]">{task.completedBy?.split("@")[0]}</span>
                                        </div>
                                      ) : (
                                        <div className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 p-1 rounded-lg font-medium text-center">
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
                  )}

                  {/* DISPLAY MODE 3: HIGH-DENSITY TABLE MATRIX VIEW */}
                  {roleLayoutMode === "matrix" && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-700 uppercase tracking-wider">
                            <tr>
                              <th className="p-3.5">Role Name</th>
                              <th className="p-3.5">Assigned Staff Email</th>
                              <th className="p-3.5">Task Progress</th>
                              <th className="p-3.5">Next Pending Task</th>
                              <th className="p-3.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {filteredRoles.map((role) => {
                              const isMyRoleColumn =
                                userData?.roleId === role.id ||
                                userData?.roleName?.toLowerCase() === role.name.toLowerCase();

                              const roleTasks = activeFlow.tasks.filter(
                                (t) =>
                                  t.roleId === role.id ||
                                  t.roleName.toLowerCase() === role.name.toLowerCase()
                              );

                              const staffForRole = usersList.filter(
                                (u) =>
                                  u.roleId === role.id ||
                                  u.roleName?.toLowerCase() === role.name.toLowerCase()
                              );

                              const completedCount = roleTasks.filter((t) => t.isCompleted).length;
                              const firstPendingTask = roleTasks.find((t) => !t.isCompleted);

                              return (
                                <tr
                                  key={role.id}
                                  className={`hover:bg-slate-50/80 transition-colors ${
                                    isMyRoleColumn ? "bg-indigo-50/20" : ""
                                  }`}
                                >
                                  <td className="p-3.5">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-extrabold text-slate-900">{role.name}</span>
                                      {isMyRoleColumn && (
                                        <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                                          Mine
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="p-3.5 font-mono text-slate-600">
                                    {staffForRole.length > 0 ? staffForRole.map((s) => s.email).join(", ") : "Unassigned"}
                                  </td>

                                  <td className="p-3.5">
                                    <span className="font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200">
                                      {completedCount}/{roleTasks.length} Done
                                    </span>
                                  </td>

                                  <td className="p-3.5 max-w-xs truncate">
                                    {firstPendingTask ? (
                                      <span className="text-amber-700 font-semibold truncate block">
                                        ⏳ #{activeFlow.tasks.findIndex((t) => t.id === firstPendingTask.id) + 1} {firstPendingTask.title}
                                      </span>
                                    ) : roleTasks.length > 0 ? (
                                      <span className="text-emerald-700 font-bold">✓ All Tasks Done</span>
                                    ) : (
                                      <span className="text-slate-400 italic">No tasks</span>
                                    )}
                                  </td>

                                  <td className="p-3.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRoleLayoutMode("accordion");
                                        setSelectedRoleDropdown(role.id);
                                        setCollapsedRoleIds((prev) => ({ ...prev, [role.id]: false }));
                                      }}
                                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition-all"
                                    >
                                      View Tasks ➔
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* UNCHECK WARNING MODAL */}
      {uncheckWarningModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setUncheckWarningModalData(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 border border-amber-200 z-10 font-sans">
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
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isUpdatingTask ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                ) : (
                  <i className="fa-solid fa-rotate-left text-xs"></i>
                )}
                <span>Reset & Mark In Progress</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TEXT WARNING MODAL */}
      {editTextWarningModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setEditTextWarningModalData(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 border border-indigo-200 z-10 font-sans">
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
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isUpdatingTask ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                ) : (
                  <i className="fa-solid fa-floppy-disk text-xs"></i>
                )}
                <span>Save & Set New Timestamp</span>
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

            <form onSubmit={handleRaiseTicketSubmit} className="space-y-4 text-xs font-medium text-slate-700">
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
                  placeholder="e.g. Unable to complete task #2 in workflow"
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
                  placeholder="Please write the issue details here..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:border-indigo-600 font-medium"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRaiseTicketModalOpen(false)}
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
                  <span>Submit Ticket 🚀</span>
                </button>
              </div>
            </form>

            {/* Previous Tickets */}
            {myTicketsList.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <i className="fa-solid fa-clock-rotate-left text-slate-500"></i>
                  <span>Submitted Tickets ({myTicketsList.length})</span>
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {myTicketsList.map((t) => (
                    <div key={t.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 font-mono">#{t.ticketNumber}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                      <p className="font-semibold text-slate-800">{t.subject}</p>
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
