"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  syncAndGetUser,
  getRoles,
  getFlowTemplates,
  createFlowTemplate,
  deleteFlowTemplate,
  MASTER_ADMIN_UID,
  RoleData,
  FlowTemplate,
  FlowTaskTemplate,
  UserData,
} from "@/lib/firebase";
import { signOut, onAuthStateChanged, User } from "firebase/auth";

export default function CreateFlowPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Flow Builder Form State
  const [flowName, setFlowName] = useState("");
  const [flowDescription, setFlowDescription] = useState("");
  const [rolesList, setRolesList] = useState<RoleData[]>([]);
  const [flowTemplatesList, setFlowTemplatesList] = useState<FlowTemplate[]>([]);

  // Task Draft State
  const [draftTasks, setDraftTasks] = useState<FlowTaskTemplate[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskRoleId, setTaskRoleId] = useState("");
  const [taskType, setTaskType] = useState<"checkbox" | "text" | "both">("both");

  // Delete Flow Modal State
  const [deleteModalFlow, setDeleteModalFlow] = useState<FlowTemplate | null>(null);
  const [readTermsChecked, setReadTermsChecked] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Authenticate Admin User
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login?redirect=/crms/create-flow");
      } else {
        setCurrentUser(user);
        const profile = await syncAndGetUser(user.uid, user.email || "");
        setUserData(profile);

        const isAdmin =
          user.uid === MASTER_ADMIN_UID ||
          profile.roleId === "role_admin" ||
          profile.roleName?.toLowerCase() === "admin" ||
          user.email?.toLowerCase().startsWith("firstoption");

        if (!isAdmin) {
          setAccessDenied(true);
        } else {
          setAccessDenied(false);
          // Load Roles & Existing Templates
          const [fetchedRoles, fetchedFlows] = await Promise.all([
            getRoles(),
            getFlowTemplates(),
          ]);
          setRolesList(fetchedRoles);
          setFlowTemplatesList(fetchedFlows);
          if (fetchedRoles.length > 0) {
            setTaskRoleId(fetchedRoles[0].id);
          }
        }
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Add Task Step to Draft
  const handleAddTaskStep = () => {
    if (!taskTitle.trim()) return;

    const targetRole =
      rolesList.find((r) => r.id === taskRoleId) ||
      rolesList[0] || { id: "role_editor", name: "Editor" };

    const newTask: FlowTaskTemplate = {
      id: "ftask_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      roleId: targetRole.id,
      roleName: targetRole.name,
      title: taskTitle.trim(),
      type: taskType,
    };

    setDraftTasks((prev) => [...prev, newTask]);
    setTaskTitle("");
  };

  // Remove Task Step from Draft
  const handleRemoveTaskStep = (taskId: string) => {
    setDraftTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // Reorder Task Step Up/Down
  const handleMoveTaskStep = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === draftTasks.length - 1)
    )
      return;

    const updated = [...draftTasks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setDraftTasks(updated);
  };

  // Submit & Create Flow Template
  const handleCreateFlowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = flowName.trim();
    if (!cleanName) {
      setErrorMessage("Please enter a Workflow Flow Name.");
      return;
    }
    if (draftTasks.length === 0) {
      setErrorMessage("Please add at least one task step to the Flow.");
      return;
    }

    setIsSubmitting(true);
    const creatorEmail = currentUser?.email || "Admin";
    const res = await createFlowTemplate(cleanName, flowDescription, draftTasks, creatorEmail);
    setIsSubmitting(false);

    if (res.success && res.flow) {
      setFlowTemplatesList((prev) => [...prev, res.flow!]);
      setFlowName("");
      setFlowDescription("");
      setDraftTasks([]);
      setSuccessMessage(`Workflow Flow '${res.flow.name}' created successfully!`);
    } else {
      setErrorMessage(res.message || "Failed to create Workflow Flow Template.");
    }
  };

  // Trigger Delete Confirmation Modal
  const handleOpenDeleteModal = (flow: FlowTemplate) => {
    setDeleteModalFlow(flow);
    setReadTermsChecked(false);
    setDeleteConfirmInput("");
  };

  // Execute Delete Flow Template after Modal Confirmation
  const handleConfirmDeleteFlow = async () => {
    if (!deleteModalFlow || !readTermsChecked || deleteConfirmInput.trim() !== "CONFIRM") return;
    setIsDeleting(true);

    const res = await deleteFlowTemplate(deleteModalFlow.id);
    if (res.success) {
      setFlowTemplatesList((prev) => prev.filter((f) => f.id !== deleteModalFlow.id));
      setSuccessMessage(`Flow Template '${deleteModalFlow.name}' deleted successfully.`);
    }

    setIsDeleting(false);
    setDeleteModalFlow(null);
    setReadTermsChecked(false);
    setDeleteConfirmInput("");
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  if (authLoading) {
    return (
      <div className="w-full min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-indigo-600 font-bold text-sm">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
          <span>Loading Workflow Flow Builder Studio...</span>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="w-full min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 border border-rose-200 rounded-2xl flex items-center justify-center text-xl text-rose-600 mx-auto">
            <i className="fa-solid fa-lock"></i>
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">Admin Permission Required</h2>
          <p className="text-xs text-slate-500 font-medium">
            Only Admin users can access the Workflow Flow Builder page.
          </p>
          <button
            onClick={() => router.push("/management")}
            className="w-full bg-indigo-600 text-white font-extrabold text-xs py-2.5 rounded-xl"
          >
            Go to Team Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-slate-900 font-sans antialiased">
      {/* Top Bar Navigation */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push("/crms?tab=roles")}
              className="w-9 h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs transition-colors"
              title="Back to CRM"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                Create Workflow Flow Template
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Dedicated Workflow Builder Studio (/crms/create-flow)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push("/crms")}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-extrabold px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-sliders"></i>
              <span>Back to CRM Board</span>
            </button>

            <button
              onClick={() => router.push("/management")}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              Team Workspace
            </button>

            <button
              onClick={handleLogout}
              className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-2 rounded-xl"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Messages */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2">
              <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-600 font-bold">
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2">
              <i className="fa-solid fa-circle-check text-emerald-600"></i>
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* WORKFLOW FLOW BUILDER STUDIO FORM */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Form & Step Creator */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleCreateFlowSubmit} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
                  <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-black">
                    1
                  </span>
                  <span>Flow Template Details</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter flow template name (e.g. <code className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded">Team Danger</code> or <code className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded">20 Jan Performance Flow</code>)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">Workflow Flow Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Team Danger"
                    value={flowName}
                    onChange={(e) => setFlowName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">Flow Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Complete client video shoot & ads verification"
                    value={flowDescription}
                    onChange={(e) => setFlowDescription(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Task Step Builder */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h3 className="text-xs font-extrabold text-slate-900 flex items-center space-x-1.5">
                    <i className="fa-solid fa-tasks text-indigo-600"></i>
                    <span>Step 2: Add Role Task Steps</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    Draft Steps: {draftTasks.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-600">Task Title / Work Description *</label>
                    <input
                      type="text"
                      placeholder="e.g. Verify video with client"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">Assign Role *</label>
                    <select
                      value={taskRoleId}
                      onChange={(e) => setTaskRoleId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                    >
                      {rolesList.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">Input Type *</label>
                    <select
                      value={taskType}
                      onChange={(e) => setTaskType(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                    >
                      <option value="both">Checkbox & Input</option>
                      <option value="checkbox">Checkbox Only</option>
                      <option value="text">Text Input Only</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddTaskStep}
                    disabled={!taskTitle.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold py-2 px-4 rounded-xl transition-colors disabled:opacity-50 inline-flex items-center space-x-1.5 shadow-2xs"
                  >
                    <i className="fa-solid fa-plus text-xs"></i>
                    <span>Add Task Step to Flow</span>
                  </button>
                </div>

                {/* Drafted Tasks List */}
                {draftTasks.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-slate-200">
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                      Sequence of Task Steps ({draftTasks.length}):
                    </label>

                    <div className="space-y-2">
                      {draftTasks.map((t, idx) => (
                        <div
                          key={t.id}
                          className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between text-xs shadow-2xs"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 font-extrabold flex items-center justify-center text-xs">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-extrabold text-slate-900 text-sm">{t.title}</p>
                              <div className="flex items-center space-x-2 mt-0.5">
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2 py-0.5 rounded text-[10px]">
                                  Role: {t.roleName}
                                </span>
                                <span className="bg-slate-100 text-slate-600 border border-slate-200 font-mono text-[10px] px-2 py-0.5 rounded">
                                  Type: {t.type}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleMoveTaskStep(idx, "up")}
                              disabled={idx === 0}
                              className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center text-xs"
                            >
                              <i className="fa-solid fa-chevron-up"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveTaskStep(idx, "down")}
                              disabled={idx === draftTasks.length - 1}
                              className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center text-xs"
                            >
                              <i className="fa-solid fa-chevron-down"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveTaskStep(t.id)}
                              className="text-rose-600 hover:text-rose-800 border border-rose-200 bg-rose-50 px-2.5 py-1 rounded-lg font-bold text-xs ml-1"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Flow Template */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => router.push("/crms?tab=roles")}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !flowName.trim() || draftTasks.length === 0}
                  className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                  ) : (
                    <i className="fa-solid fa-paper-plane text-xs"></i>
                  )}
                  <span>Save Workflow Flow Template 🚀</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Existing Templates Library */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <i className="fa-solid fa-layer-group text-indigo-600"></i>
                  <span>Flow Templates ({flowTemplatesList.length})</span>
                </h3>
                <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                  /flows
                </span>
              </div>

              {flowTemplatesList.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">
                  No Workflow Flow templates created yet.
                </p>
              ) : (
                <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                  {flowTemplatesList.map((flow) => (
                    <div
                      key={flow.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 hover:border-indigo-300 transition-colors shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-slate-900 truncate">
                          🚀 {flow.name}
                        </h4>
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                          {flow.tasks.length} Steps
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 font-medium">
                        {flow.description || "No description."}
                      </p>

                      <div className="space-y-1 pt-1.5 border-t border-slate-200">
                        {flow.tasks.map((t, idx) => (
                          <div
                            key={t.id}
                            className="text-[10px] font-medium text-slate-700 flex items-center justify-between"
                          >
                            <span className="truncate max-w-[140px]">
                              {idx + 1}. {t.title}
                            </span>
                            <span className="text-[9px] font-extrabold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-indigo-700">
                              {t.roleName}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>By: {flow.createdBy?.split("@")[0]}</span>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(flow)}
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-bold bg-white border border-rose-200 px-2 py-0.5 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* FLOW TEMPLATE DELETION CONFIRMATION MODAL WITH TERMS CHECKBOX */}
      {deleteModalFlow && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setDeleteModalFlow(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 border border-rose-200 z-10 font-sans animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-lg font-black shadow-2xs">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Delete Flow Template
                </h3>
                <p className="text-xs text-rose-600 font-bold">
                  {deleteModalFlow.name}
                </p>
              </div>
            </div>

            {/* Terms Warning Box */}
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <p className="text-rose-900 font-semibold leading-relaxed">
                <strong>Important Rule & Terms:</strong> Deleting master Flow Template <span className="font-extrabold underline">{deleteModalFlow.name}</span> removes it from the templates library.
              </p>
              <p className="text-rose-800 font-medium text-[11px] leading-snug">
                Already-assigned client flows will <strong>NOT</strong> be affected because assigned client flows store independent immutable snapshots. To update an onboarded client's workflow, delete their assigned flow instance and re-assign the updated template!
              </p>
            </div>

            {/* Read & Agree Terms Checkbox */}
            <label className="flex items-start space-x-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/80 transition-colors">
              <input
                type="checkbox"
                checked={readTermsChecked}
                onChange={(e) => setReadTermsChecked(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800 leading-snug">
                I have read the terms and understand that assigned client flows require manual deletion & re-assignment to update.
              </span>
            </label>

            {/* Confirmation Text Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Type <strong className="text-rose-700 font-mono tracking-wider">CONFIRM</strong> to delete:
              </label>
              <input
                type="text"
                placeholder="Type CONFIRM here..."
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-rose-600"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalFlow(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!readTermsChecked || deleteConfirmInput.trim() !== "CONFIRM" || isDeleting}
                onClick={handleConfirmDeleteFlow}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                ) : (
                  <i className="fa-solid fa-trash-can text-xs"></i>
                )}
                <span>Confirm & Delete Template 🗑️</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
