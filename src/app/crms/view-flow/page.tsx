"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  auth,
  syncAndGetUser,
  getRoles,
  getAllUsers,
  getAllClientFlows,
  updateClientFlowTaskStatus,
  markClientFlowCompleted,
  UserData,
  RoleData,
  ClientFlowInstance,
  ClientFlowTask,
  MASTER_ADMIN_UID,
} from "@/lib/firebase";
import { signOut, onAuthStateChanged, User } from "firebase/auth";

function ViewFlowCanvasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flowIdParam = searchParams.get("id");

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Client Flows, Roles & Users State
  const [clientFlows, setClientFlows] = useState<ClientFlowInstance[]>([]);
  const [rolesList, setRolesList] = useState<RoleData[]>([]);
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Active Flow Selection
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(flowIdParam);

  // Draft Text Inputs
  const [draftTexts, setDraftTexts] = useState<{ [taskId: string]: string }>({});

  // Canvas Mouse Pan & Zoom State
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);

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

  // Sync search param flowId
  useEffect(() => {
    if (flowIdParam) {
      setSelectedFlowId(flowIdParam);
    }
  }, [flowIdParam]);

  // Authenticate User
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login?redirect=/crms/view-flow");
      } else {
        setCurrentUser(user);
        const profile = await syncAndGetUser(user.uid, user.email || "");
        setUserData(profile);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch Data
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsDataLoading(true);
    try {
      const [flows, roles, users] = await Promise.all([
        getAllClientFlows(),
        getRoles(),
        getAllUsers(),
      ]);
      setClientFlows(flows);
      setRolesList(roles);
      setUsersList(users);

      if (flows.length > 0 && !selectedFlowId) {
        setSelectedFlowId(flows[0].id);
      }
    } catch (err) {
      console.error("View Flow Fetch Error:", err);
    } finally {
      setIsDataLoading(false);
    }
  }, [currentUser, selectedFlowId]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

  // Mouse Drag / Pan Canvas Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "BUTTON" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "LABEL" ||
      target.tagName === "SELECT"
    ) {
      return;
    }
    setIsDragging(true);
    setStartX(e.pageX - canvasRef.current.offsetLeft);
    setStartY(e.pageY - canvasRef.current.offsetTop);
    setScrollLeft(canvasRef.current.scrollLeft);
    setScrollTop(canvasRef.current.scrollTop);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current) return;
    e.preventDefault();
    const x = e.pageX - canvasRef.current.offsetLeft;
    const y = e.pageY - canvasRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    canvasRef.current.scrollLeft = scrollLeft - walkX;
    canvasRef.current.scrollTop = scrollTop - walkY;
  };

  // Toggle Checkbox Status Handler
  const handleToggleTaskCheckbox = async (
    clientFlowId: string,
    task: ClientFlowTask,
    currentText: string
  ) => {
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

  // Confirm Uncheck Task
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

  // Execute Save Text
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

  // Admin Mark Complete
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
      <div className="w-full min-h-screen bg-[#0F172A] flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-indigo-400 font-bold text-sm">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
          <span>Loading Flow Canvas Studio...</span>
        </div>
      </div>
    );
  }

  const isAdmin =
    currentUser?.uid === MASTER_ADMIN_UID ||
    userData?.roleId === "role_admin" ||
    currentUser?.email?.toLowerCase().startsWith("firstoption");

  // Selected Active Flow Instance
  const activeFlow =
    clientFlows.find((f) => f.id === selectedFlowId) || clientFlows[0];

  // Extract distinct roles used in active flow tasks (plus all system roles)
  const activeFlowRoles: Array<{ id: string; name: string }> = [];
  if (activeFlow) {
    activeFlow.tasks.forEach((t) => {
      if (!activeFlowRoles.some((r) => r.name.toLowerCase() === t.roleName.toLowerCase())) {
        activeFlowRoles.push({ id: t.roleId, name: t.roleName });
      }
    });
  }
  rolesList.forEach((r) => {
    if (!activeFlowRoles.some((ar) => ar.name.toLowerCase() === r.name.toLowerCase())) {
      activeFlowRoles.push({ id: r.id, name: r.name });
    }
  });

  return (
    <div className="w-full h-screen bg-[#0F172A] text-slate-100 font-sans antialiased flex flex-col overflow-hidden select-none">
      {/* TOP CANVAS STUDIO HEADER BAR */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex-shrink-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Back Button & Flow Info */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (isAdmin) {
                  router.push("/crms");
                } else {
                  router.push("/management");
                }
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-extrabold px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 shadow-2xs cursor-pointer"
            >
              <i className="fa-solid fa-arrow-left"></i>
              <span>{isAdmin ? "Back to CRM" : "Back to Workspace"}</span>
            </button>

            {activeFlow && (
              <div className="hidden md:block border-l border-slate-700 pl-3">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-extrabold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800 uppercase">
                    🚀 {activeFlow.flowName}
                  </span>
                  <h1 className="text-sm font-extrabold text-white">
                    Client: {activeFlow.clientName}
                  </h1>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">{activeFlow.clientEmail}</p>
              </div>
            )}
          </div>

          {/* Center: Client Flow Selector Dropdown */}
          {clientFlows.length > 0 && (
            <div className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-2xl">
              <span className="text-[11px] font-bold text-slate-400">Flow:</span>
              <select
                value={selectedFlowId || ""}
                onChange={(e) => {
                  setSelectedFlowId(e.target.value);
                  router.replace(`/crms/view-flow?id=${e.target.value}`);
                }}
                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-extrabold text-indigo-300 focus:outline-none cursor-pointer"
              >
                {clientFlows.map((cf) => (
                  <option key={cf.id} value={cf.id}>
                    🚀 {cf.clientName} - {cf.flowName} ({cf.tasks.filter((t) => t.isCompleted).length}/{cf.tasks.length} Done)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Right: Zoom & Mouse Mode Controls & Admin Action */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 bg-slate-800 border border-slate-700 p-1 rounded-xl">
              <button
                onClick={() => setZoomScale((prev) => Math.max(0.6, prev - 0.1))}
                className="w-7 h-7 rounded-lg hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center transition-colors text-xs cursor-pointer"
                title="Zoom Out"
              >
                <i className="fa-solid fa-minus"></i>
              </button>

              <span className="text-[11px] font-mono font-extrabold px-2 text-indigo-400">
                {Math.round(zoomScale * 100)}%
              </span>

              <button
                onClick={() => setZoomScale((prev) => Math.min(1.6, prev + 0.1))}
                className="w-7 h-7 rounded-lg hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center transition-colors text-xs cursor-pointer"
                title="Zoom In"
              >
                <i className="fa-solid fa-plus"></i>
              </button>

              <button
                onClick={() => setZoomScale(1)}
                className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Reset Zoom"
              >
                Reset
              </button>
            </div>

            {isAdmin && activeFlow && activeFlow.status !== "completed" && (
              <button
                onClick={() => handleAdminMarkFlowCompleted(activeFlow.id)}
                disabled={isUpdatingTask}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-flag-checkered"></i>
                <span>Mark Flow Complete 🏁</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* CANVAS HINT INSTRUCTION STRIP */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-2 flex items-center justify-between text-xs text-slate-400 font-medium">
        <div className="flex items-center space-x-2">
          <i className="fa-solid fa-hand-pointer text-indigo-400"></i>
          <span>
            <strong>Mouse Drag Canvas Mode Active:</strong> Click and drag anywhere on the canvas background to move smoothly Left/Right or Up/Down!
          </span>
        </div>
        {activeFlow && (
          <span className="font-mono text-indigo-300">
            Progress: {activeFlow.tasks.filter((t) => t.isCompleted).length} / {activeFlow.tasks.length} Steps Completed
          </span>
        )}
      </div>

      {/* INFINITE DRAGGABLE / PANNING CANVAS BOARD AREA */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className={`flex-1 overflow-auto p-6 sm:p-10 select-none transition-cursor ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      >
        {!activeFlow ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-800 border border-slate-700 text-indigo-400 flex items-center justify-center text-2xl">
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <h2 className="text-lg font-extrabold text-white">No Flow Canvas Selected</h2>
            <p className="text-xs text-slate-400 max-w-sm">
              Please select a client project flow from the top dropdown selector.
            </p>
          </div>
        ) : (
          <div
            className="transition-transform duration-75 origin-top-left min-w-max space-y-6"
            style={{ transform: `scale(${zoomScale})` }}
          >
            {/* Canvas Header Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl max-w-5xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-extrabold text-indigo-400 bg-indigo-950 px-2.5 py-0.5 rounded border border-indigo-800 uppercase">
                      🚀 {activeFlow.flowName}
                    </span>
                    <span className="text-xs bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded border border-slate-700">
                      Campaign: {activeFlow.campaign}
                    </span>
                    {activeFlow.status === "completed" && (
                      <span className="text-xs bg-emerald-950 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded border border-emerald-800">
                        ✓ Flow Completed by Admin
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-extrabold text-white mt-1">
                    Client: {activeFlow.clientName}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">{activeFlow.clientEmail}</p>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 block">
                      Canvas Completion Status
                    </span>
                    <span className="text-sm font-extrabold text-indigo-400 font-mono">
                      {activeFlow.tasks.filter((t) => t.isCompleted).length} / {activeFlow.tasks.length} Tasks Done
                    </span>
                  </div>

                  <div className="w-14 h-14 rounded-2xl bg-indigo-950 border border-indigo-800 flex items-center justify-center font-mono font-black text-indigo-400 text-base shadow-inner">
                    {Math.round(
                      (activeFlow.tasks.filter((t) => t.isCompleted).length / activeFlow.tasks.length) * 100
                    )}%
                  </div>
                </div>
              </div>
            </div>

            {/* SIDE-BY-SIDE ROLE COLUMNS BOARD (PAN LEFT/RIGHT, NO BLANK SPACE) */}
            <div className="flex items-start space-x-6 min-w-max pb-16">
              {activeFlowRoles.map((role) => {
                const isMyRoleColumn =
                  isAdmin ||
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
                    className={`w-[320px] rounded-3xl border p-5 space-y-4 flex flex-col justify-between shadow-2xl flex-shrink-0 transition-all ${
                      isMyRoleColumn
                        ? "bg-slate-900/90 border-indigo-600/60 ring-2 ring-indigo-500/20"
                        : "bg-slate-900/60 border-slate-800"
                    }`}
                  >
                    {/* Role Column Header & Staff Email */}
                    <div className="border-b border-slate-800 pb-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold text-white flex items-center space-x-1.5">
                          <span>{role.name}</span>
                          {isMyRoleColumn && (
                            <span className="text-[9px] bg-indigo-600 text-white font-extrabold px-1.5 py-0.2 rounded-full">
                              Your Role ✓
                            </span>
                          )}
                        </h3>

                        <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                          {completedRoleTasksCount}/{roleTasks.length} Tasks
                        </span>
                      </div>

                      {staffForRole.length > 0 ? (
                        <div className="text-[10px] font-mono font-extrabold text-indigo-300 bg-indigo-950/90 border border-indigo-800 px-2.5 py-1 rounded-xl truncate">
                          ✉️ {staffForRole.map((s) => s.email).join(", ")}
                        </div>
                      ) : (
                        <div className="text-[10px] font-mono text-slate-500 italic">
                          👤 Unassigned Staff Email
                        </div>
                      )}
                    </div>

                    {/* Role Tasks Vertical List */}
                    <div className="space-y-3.5">
                      {roleTasks.length === 0 ? (
                        <div className="p-5 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500 text-xs italic">
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
                              className={`bg-slate-950 border rounded-2xl p-4 space-y-3 shadow-md transition-all ${
                                isTaskDone
                                  ? "border-emerald-900/60 bg-emerald-950/20"
                                  : isMyRoleColumn
                                  ? "border-slate-700 hover:border-indigo-500"
                                  : "border-slate-800 opacity-80"
                              }`}
                            >
                              {/* Task Title */}
                              <div className="flex items-start space-x-2.5">
                                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-extrabold flex items-center justify-center text-[10px] shadow-2xs flex-shrink-0 mt-0.5">
                                  #{originalStepIdx}
                                </span>
                                <h4 className="text-xs font-extrabold text-slate-100 leading-snug">
                                  {task.title}
                                </h4>
                              </div>

                              {/* Interactive Checkbox Control */}
                              {(task.type === "checkbox" || task.type === "both") && (
                                <div>
                                  {isMyRoleColumn ? (
                                    <label className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-900 border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors">
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
                                        className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-400 cursor-pointer"
                                      />
                                      <span
                                        className={`text-xs font-bold ${
                                          isTaskDone
                                            ? "text-emerald-400 line-through"
                                            : "text-slate-200"
                                        }`}
                                      >
                                        {isTaskDone ? "Completed Step" : "Mark Done"}
                                      </span>
                                    </label>
                                  ) : (
                                    <div className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-500">
                                      <input
                                        type="checkbox"
                                        checked={isTaskDone}
                                        disabled
                                        className="w-4 h-4 text-slate-600 rounded cursor-not-allowed"
                                      />
                                      <span className="text-[11px] font-bold text-slate-400">
                                        {isTaskDone ? "Completed" : "🔒 Read-Only"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Work Notes Input with Save Button */}
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
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-100 focus:outline-none focus:border-indigo-500"
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
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold px-2.5 py-1.5 rounded-xl transition-colors shadow-2xs flex-shrink-0 flex items-center space-x-1 cursor-pointer"
                                      >
                                        <i className="fa-solid fa-floppy-disk"></i>
                                        <span>Save</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 font-mono font-bold truncate">
                                      {task.textValue || "No notes entered"}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Timestamp Audit Tag in 12-hour AM/PM format */}
                              {task.completedAt ? (
                                <div className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-800 p-2 rounded-xl font-extrabold flex items-center justify-between">
                                  <span>✓ {new Date(task.completedAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                                  <span className="truncate max-w-[90px]">{task.completedBy?.split("@")[0]}</span>
                                </div>
                              ) : (
                                <div className="text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-900/60 p-1.5 rounded-xl font-bold text-center">
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
          </div>
        )}
      </div>

      {/* UNCHECK WARNING MODAL POPUP */}
      {uncheckWarningModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setUncheckWarningModalData(null)} />
          <div className="relative w-full max-w-md bg-slate-900 rounded-3xl shadow-2xl p-6 space-y-4 border border-amber-900/80 z-10 font-sans text-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="w-10 h-10 rounded-2xl bg-amber-950 border border-amber-800 flex items-center justify-center text-lg font-black shadow-2xs">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Reset Task Completion?
                </h3>
                <p className="text-xs text-amber-400 font-bold">
                  Completion Timestamp Reset Warning
                </p>
              </div>
            </div>

            <div className="bg-amber-950/40 border border-amber-900/60 rounded-2xl p-3.5 space-y-2 text-xs">
              <p className="text-amber-200 font-semibold leading-relaxed">
                Unchecking <strong className="text-white font-extrabold underline">{uncheckWarningModalData.taskTitle}</strong> will remove the current completion date/time stamp and set the status back to <span className="font-extrabold text-amber-400">In Progress</span>.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setUncheckWarningModalData(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 border border-slate-700 transition-colors"
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setEditTextWarningModalData(null)} />
          <div className="relative w-full max-w-md bg-slate-900 rounded-3xl shadow-2xl p-6 space-y-4 border border-indigo-800 z-10 font-sans text-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-indigo-400">
              <div className="w-10 h-10 rounded-2xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-lg font-black shadow-2xs">
                🕒
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Update Note & Timestamp?
                </h3>
                <p className="text-xs text-indigo-300 font-bold">
                  New Current Date/Time Stamp Will Be Added
                </p>
              </div>
            </div>

            <div className="bg-indigo-950/40 border border-indigo-900/60 rounded-2xl p-3.5 space-y-2 text-xs">
              <p className="text-indigo-200 font-semibold leading-relaxed">
                Saving changes to <strong className="text-white font-extrabold underline">{editTextWarningModalData.task.title}</strong> will update the saved note and stamp the <span className="font-extrabold text-indigo-400">NEW current date and time</span>!
              </p>

              <div className="bg-slate-950 border border-indigo-900/60 rounded-xl p-2.5 space-y-1 font-mono text-[11px]">
                <span className="text-slate-400 font-bold block">New Note Content:</span>
                <p className="text-indigo-200 font-extrabold truncate">"{editTextWarningModalData.newText}"</p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setEditTextWarningModalData(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 border border-slate-700 transition-colors"
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
    </div>
  );
}

export default function ViewFlowCanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-[#0F172A] flex items-center justify-center font-sans text-indigo-400 font-bold text-sm">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl mr-3"></i>
          <span>Loading Flow Canvas...</span>
        </div>
      }
    >
      <ViewFlowCanvasContent />
    </Suspense>
  );
}
