"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  syncAndGetUser,
  getAllClientFlows,
  updateClientFlowTaskStatus,
  UserData,
  ClientFlowInstance,
  ClientFlowTask,
  MASTER_ADMIN_UID,
} from "@/lib/firebase";
import { signOut, onAuthStateChanged, User } from "firebase/auth";

export default function ManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Client Flows State
  const [clientFlows, setClientFlows] = useState<ClientFlowInstance[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"in_progress" | "completed">("in_progress");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected Flow Detail View Modal
  const [selectedFlowModal, setSelectedFlowModal] = useState<ClientFlowInstance | null>(null);

  // Uncheck Warning Modal State
  const [uncheckWarningModalData, setUncheckWarningModalData] = useState<{
    clientFlowId: string;
    taskId: string;
    taskTitle: string;
    currentText: string;
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

  // Fetch Client Flows
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsDataLoading(true);
    try {
      const flows = await getAllClientFlows();
      setClientFlows(flows);
    } catch (err) {
      console.error("Management Fetch Error:", err);
    } finally {
      setIsDataLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

  // Sync selected flow modal with updated client flows
  useEffect(() => {
    if (selectedFlowModal) {
      const updated = clientFlows.find((f) => f.id === selectedFlowModal.id);
      if (updated) {
        setSelectedFlowModal(updated);
      }
    }
  }, [clientFlows, selectedFlowModal]);

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

  // Update Text Input Value Handler
  const handleSaveTextValue = async (
    clientFlowId: string,
    task: ClientFlowTask,
    newText: string
  ) => {
    const userEmail = currentUser?.email || "Staff";
    await updateClientFlowTaskStatus(
      clientFlowId,
      task.id,
      task.isCompleted,
      newText,
      userEmail
    );

    setClientFlows((prev) =>
      prev.map((cf) => {
        if (cf.id === clientFlowId) {
          return {
            ...cf,
            tasks: cf.tasks.map((t) => (t.id === task.id ? { ...t, textValue: newText } : t)),
          };
        }
        return cf;
      })
    );
  };

  if (authLoading) {
    return (
      <div className="w-full min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-indigo-600 font-bold text-sm">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
          <span>Loading Staff Management Workspace...</span>
        </div>
      </div>
    );
  }

  const isAdmin =
    currentUser?.uid === MASTER_ADMIN_UID ||
    userData?.roleId === "role_admin" ||
    currentUser?.email?.toLowerCase().startsWith("firstoption");

  // Filter client flows where at least one task is assigned to current user's role (or all flows if Admin)
  const myAssignedFlows = clientFlows.filter((cf) => {
    if (isAdmin) return true;
    return cf.tasks.some(
      (t) =>
        t.roleId === userData?.roleId ||
        t.roleName.toLowerCase() === userData?.roleName?.toLowerCase()
    );
  });

  // Filter by active tab (in_progress vs completed) and search query
  const filteredFlows = myAssignedFlows.filter((cf) => {
    const isFlowCompleted =
      cf.status === "completed" || cf.tasks.every((t) => t.isCompleted);

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

  const inProgressFlowsCount = myAssignedFlows.filter(
    (cf) => cf.status !== "completed" && !cf.tasks.every((t) => t.isCompleted)
  ).length;

  const completedFlowsCount = myAssignedFlows.filter(
    (cf) => cf.status === "completed" || cf.tasks.every((t) => t.isCompleted)
  ).length;

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-slate-900 font-sans antialiased">
      {/* Top Header Navigation */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-lg flex items-center justify-center shadow-md">
              FO
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                Team Workflow Workspace
              </h1>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-slate-500">Assigned Role:</span>
                <span className="bg-indigo-100 text-indigo-800 border border-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  {userData?.roleName || "Staff Specialist"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isAdmin && (
              <button
                onClick={() => router.push("/crms")}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-extrabold px-3.5 py-2 rounded-xl transition-colors shadow-2xs flex items-center space-x-1.5"
              >
                <i className="fa-solid fa-sliders"></i>
                <span>Admin CRM Portal</span>
              </button>
            )}

            <div className="hidden sm:block text-right text-xs">
              <p className="font-extrabold text-slate-900">{currentUser?.email}</p>
              <p className="text-[10px] text-slate-400 font-mono">Staff Portal Active</p>
            </div>

            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold px-3 py-2 rounded-xl transition-colors flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
              <span>Logout</span>
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
                <span>Welcome back, {currentUser?.email?.split("@")[0]}! 👋</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Each assigned project is grouped into <strong className="text-indigo-600">1 Flow Card</strong>. Click any flow to expand and view all step-by-step tasks in rows!
              </p>
            </div>

            <button
              onClick={fetchData}
              disabled={isDataLoading}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors self-start sm:self-auto flex items-center space-x-1.5"
            >
              <i className={`fa-solid fa-rotate-right ${isDataLoading ? "fa-spin" : ""}`}></i>
              <span>Refresh Flows</span>
            </button>
          </div>
        </div>

        {/* Tab Controls & Search */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 font-sans">
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

          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Search client, flow, or task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-600"
            />
          </div>
        </div>

        {/* GROUPED FLOW CARDS GRID (1 Card per Flow) */}
        <div className="space-y-4 font-sans">
          {filteredFlows.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-xl mx-auto">
                <i className="fa-solid fa-clipboard-check"></i>
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                No active project flows in {activeTab === "in_progress" ? "In Progress" : "Completed"} tab
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All client project flows for your role (<strong className="text-indigo-600">{userData?.roleName}</strong>) are up to date!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredFlows.map((clientFlow) => {
                const totalTasks = clientFlow.tasks.length;
                const completedTasksCount = clientFlow.tasks.filter((t) => t.isCompleted).length;
                const progressPct = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;
                const isFlowDone = clientFlow.status === "completed" || completedTasksCount === totalTasks;

                return (
                  <div
                    key={clientFlow.id}
                    onClick={() => setSelectedFlowModal(clientFlow)}
                    className={`bg-white border rounded-3xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group ${
                      isFlowDone
                        ? "border-emerald-200 bg-emerald-50/10 hover:border-emerald-300"
                        : "border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Client Header & Campaign */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200 uppercase inline-block mb-1">
                            🚀 {clientFlow.flowName}
                          </span>
                          <h3 className="text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {clientFlow.clientName}
                          </h3>
                          <p className="text-xs text-slate-400 font-mono">{clientFlow.clientEmail}</p>
                        </div>

                        <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
                          {clientFlow.campaign}
                        </span>
                      </div>

                      {/* Progress Bar & Counter */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-700">Workflow Step Progress</span>
                          <span className="text-indigo-600 font-mono">
                            {completedTasksCount} / {totalTasks} Tasks ({progressPct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isFlowDone ? "bg-emerald-600" : "bg-gradient-to-r from-indigo-600 to-violet-600"
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Task Steps Preview List */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Flow Task Steps ({totalTasks}):
                        </span>
                        <div className="space-y-1">
                          {clientFlow.tasks.map((t, idx) => (
                            <div
                              key={t.id}
                              className="text-xs flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <span className="w-4 h-4 rounded-full bg-white text-slate-600 font-extrabold flex items-center justify-center text-[9px] border border-slate-200 flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <span className={`truncate font-bold ${t.isCompleted ? "line-through text-slate-400" : "text-slate-800"}`}>
                                  {t.title}
                                </span>
                              </div>

                              <span
                                className={`text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded border flex-shrink-0 ${
                                  t.isCompleted
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                }`}
                              >
                                {t.isCompleted ? "✓ Done" : t.roleName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Card Action Footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">
                        Assigned: {new Date(clientFlow.assignedAt).toLocaleDateString()}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFlowModal(clientFlow);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-3.5 py-1.5 rounded-xl shadow-2xs transition-colors flex items-center space-x-1.5"
                      >
                        <span>Open Flow Steps</span>
                        <i className="fa-solid fa-arrow-right text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* EXPANDED FLOW DETAIL MODAL (Displays all tasks in rows one after another) */}
      {selectedFlowModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 font-sans">
          <div className="fixed inset-0" onClick={() => setSelectedFlowModal(null)} />
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 z-10 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                  🚀
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                    {selectedFlowModal.flowName}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Client: <strong className="text-slate-900">{selectedFlowModal.clientName}</strong> ({selectedFlowModal.clientEmail})
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl border border-indigo-200">
                  {selectedFlowModal.campaign}
                </span>

                <button
                  onClick={() => setSelectedFlowModal(null)}
                  className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center transition-colors"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body: TASK STEPS IN ROWS ONE AFTER ANOTHER */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <i className="fa-solid fa-list-check text-indigo-600"></i>
                  <span>Workflow Tasks & Work Updates</span>
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Progress: {selectedFlowModal.tasks.filter((t) => t.isCompleted).length} / {selectedFlowModal.tasks.length} Completed
                </span>
              </div>

              <div className="space-y-3.5">
                {selectedFlowModal.tasks.map((task, idx) => {
                  const isTaskDone = task.isCompleted || selectedFlowModal.status === "completed";

                  return (
                    <div
                      key={task.id}
                      className={`border rounded-2xl p-4 space-y-3 transition-all ${
                        isTaskDone
                          ? "bg-emerald-50/20 border-emerald-200"
                          : "bg-slate-50/60 border-slate-200 hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                        <div className="flex items-center space-x-3">
                          <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-xs shadow-2xs">
                            #{idx + 1}
                          </span>
                          <div>
                            <h4 className="text-sm font-extrabold text-slate-900">
                              {task.title}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Assigned Role: <strong className="text-indigo-700">{task.roleName}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-start sm:self-auto">
                          {(task.type === "checkbox" || task.type === "both") && (
                            <label className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white border border-slate-300 cursor-pointer hover:bg-slate-50 transition-colors shadow-2xs">
                              <input
                                type="checkbox"
                                checked={isTaskDone}
                                onChange={() =>
                                  handleToggleTaskCheckbox(
                                    selectedFlowModal.id,
                                    task,
                                    task.textValue || ""
                                  )
                                }
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                              />
                              <span className={`text-xs font-bold ${isTaskDone ? "text-emerald-800 line-through" : "text-slate-800"}`}>
                                {isTaskDone ? "Completed Step" : "Mark as Completed"}
                              </span>
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Work Notes / Text Input Field */}
                      {(task.type === "text" || task.type === "both") && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700">Work Notes / Link Output:</label>
                          <input
                            type="text"
                            placeholder="Type work notes, video link, or verification details..."
                            defaultValue={task.textValue || ""}
                            onBlur={(e) =>
                              handleSaveTextValue(selectedFlowModal.id, task, e.target.value)
                            }
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium"
                          />
                        </div>
                      )}

                      {/* Live Audit Log Tag */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                        {task.completedAt ? (
                          <div className="w-full text-emerald-800 bg-emerald-100/80 border border-emerald-300 p-2 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-extrabold flex items-center space-x-1.5">
                              <i className="fa-solid fa-circle-check text-emerald-600"></i>
                              <span>Done: {new Date(task.completedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                            </span>
                            <span className="font-extrabold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                              By: {task.completedBy}
                            </span>
                          </div>
                        ) : (
                          <div className="w-full text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-xl flex items-center justify-between">
                            <span className="font-bold">⏳ Status: In Progress</span>
                            <span className="text-slate-400">Pending Execution</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between sticky bottom-0">
              <span className="text-xs text-slate-500 font-mono">
                Assigned by: {selectedFlowModal.assignedBy}
              </span>
              <button
                onClick={() => setSelectedFlowModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
