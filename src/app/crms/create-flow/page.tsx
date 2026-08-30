"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  syncAndGetUser,
  getRoles,
  getFlowTemplates,
  createFlowTemplate,
  updateFlowTemplate,
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
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState("");
  const [flowDescription, setFlowDescription] = useState("");
  const [rolesList, setRolesList] = useState<RoleData[]>([]);
  const [flowTemplatesList, setFlowTemplatesList] = useState<FlowTemplate[]>([]);
  const [searchTemplateQuery, setSearchTemplateQuery] = useState("");

  // Task Draft State
  const [draftTasks, setDraftTasks] = useState<FlowTaskTemplate[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskRoleId, setTaskRoleId] = useState("");
  const [taskType, setTaskType] = useState<"checkbox" | "text" | "both">("both");

  // Task Step Editing Modal State
  const [editingTaskItem, setEditingTaskItem] = useState<FlowTaskTemplate | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskRoleId, setEditTaskRoleId] = useState("");
  const [editTaskType, setEditTaskType] = useState<"checkbox" | "text" | "both">("both");

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
          router.replace("/crms?tab=pipeline");
        } else {
          setAccessDenied(false);
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

  // Open Edit Task Step Modal
  const handleOpenEditTaskModal = (task: FlowTaskTemplate) => {
    setEditingTaskItem(task);
    setEditTaskTitle(task.title);
    setEditTaskRoleId(task.roleId || rolesList[0]?.id || "");
    setEditTaskType(task.type || "both");
  };

  // Save Edit Task Step
  const handleSaveEditTask = () => {
    if (!editingTaskItem || !editTaskTitle.trim()) return;

    const targetRole =
      rolesList.find((r) => r.id === editTaskRoleId) ||
      rolesList[0] || { id: "role_editor", name: "Editor" };

    setDraftTasks((prev) =>
      prev.map((t) =>
        t.id === editingTaskItem.id
          ? {
              ...t,
              title: editTaskTitle.trim(),
              roleId: targetRole.id,
              roleName: targetRole.name,
              type: editTaskType,
            }
          : t
      )
    );

    setEditingTaskItem(null);
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

  // Start Editing an Existing Flow Template
  const handleStartEditFlow = (flow: FlowTemplate) => {
    setEditingFlowId(flow.id);
    setFlowName(flow.name);
    setFlowDescription(flow.description || "");
    setDraftTasks([...(flow.tasks || [])]);
    setErrorMessage(null);
    setSuccessMessage(`Loaded "${flow.name}" into editor.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Duplicate Existing Flow Template
  const handleDuplicateFlow = (flow: FlowTemplate) => {
    setEditingFlowId(null);
    setFlowName(`${flow.name} (Copy)`);
    setFlowDescription(flow.description || "");
    setDraftTasks(
      (flow.tasks || []).map((t) => ({
        ...t,
        id: "ftask_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      }))
    );
    setErrorMessage(null);
    setSuccessMessage(`Duplicated "${flow.name}". Ready to customize & save as new template.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Cancel Editing Flow Template
  const handleCancelEditFlow = () => {
    setEditingFlowId(null);
    setFlowName("");
    setFlowDescription("");
    setDraftTasks([]);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Submit & Create or Update Flow Template
  const handleCreateOrUpdateFlowSubmit = async (e: React.FormEvent) => {
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

    if (editingFlowId) {
      // Update Existing Flow Template
      const res = await updateFlowTemplate(
        editingFlowId,
        cleanName,
        flowDescription,
        draftTasks,
        creatorEmail
      );
      setIsSubmitting(false);

      if (res.success && res.flow) {
        setFlowTemplatesList((prev) =>
          prev.map((f) => (f.id === editingFlowId ? res.flow! : f))
        );
        setEditingFlowId(null);
        setFlowName("");
        setFlowDescription("");
        setDraftTasks([]);
        setSuccessMessage(`Flow template "${res.flow.name}" updated successfully!`);
      } else {
        setErrorMessage(res.message || "Failed to update Flow Template.");
      }
    } else {
      // Create New Flow Template
      const res = await createFlowTemplate(cleanName, flowDescription, draftTasks, creatorEmail);
      setIsSubmitting(false);

      if (res.success && res.flow) {
        setFlowTemplatesList((prev) => [...prev, res.flow!]);
        setFlowName("");
        setFlowDescription("");
        setDraftTasks([]);
        setSuccessMessage(`Flow template "${res.flow.name}" created successfully!`);
      } else {
        setErrorMessage(res.message || "Failed to create Flow Template.");
      }
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
      if (editingFlowId === deleteModalFlow.id) {
        handleCancelEditFlow();
      }
      setSuccessMessage(`Flow Template "${deleteModalFlow.name}" deleted successfully.`);
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
          <span>Loading Flow Builder...</span>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="w-full min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-center text-xl text-rose-600 mx-auto">
            <i className="fa-solid fa-lock"></i>
          </div>
          <h2 className="text-base font-bold text-slate-900">Admin Access Required</h2>
          <p className="text-xs text-slate-500 font-medium">
            Only administrators have permission to create and modify workflow flow templates.
          </p>
          <button
            onClick={() => router.push("/management")}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            Go to Team Workspace
          </button>
        </div>
      </div>
    );
  }

  const filteredTemplates = flowTemplatesList.filter((flow) => {
    if (!searchTemplateQuery.trim()) return true;
    const q = searchTemplateQuery.toLowerCase();
    return (
      flow.name.toLowerCase().includes(q) ||
      (flow.description && flow.description.toLowerCase().includes(q)) ||
      (flow.tasks && flow.tasks.some((t) => t.title.toLowerCase().includes(q) || t.roleName.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-[#111827] font-sans antialiased">
      {/* Top Bar Header */}
      <header className="bg-white border-b border-[#E5E7EB] px-4 sm:px-8 py-3.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push("/crms?tab=roles")}
              className="w-9 h-9 rounded-xl border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827] hover:bg-slate-50 flex items-center justify-center text-xs transition-colors cursor-pointer"
              title="Back to CRM"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold text-[#111827]">
                  {editingFlowId ? "Edit Flow Template" : "Create Workflow Flow"}
                </h1>
                {editingFlowId && (
                  <span className="text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    ✏️ Editing Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B7280]">
                Design custom task step pipelines for client onboarding & team execution
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {editingFlowId && (
              <button
                onClick={handleCancelEditFlow}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                + New Flow
              </button>
            )}

            <button
              onClick={() => router.push("/crms")}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-sliders text-xs"></i>
              <span>CRM Board</span>
            </button>

            <button
              onClick={() => router.push("/management")}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer hidden sm:inline-flex"
            >
              Workspace
            </button>

            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Messages */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2.5">
              <i className="fa-solid fa-triangle-exclamation text-rose-600 text-sm"></i>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 hover:text-rose-800 font-bold text-xs cursor-pointer ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2.5">
              <i className="fa-solid fa-circle-check text-emerald-600 text-sm"></i>
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Editing Mode Banner */}
        {editingFlowId && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center space-x-2.5">
              <i className="fa-solid fa-pen-to-square text-amber-700 text-base"></i>
              <span>
                Currently editing template: <strong>"{flowName}"</strong>. Saving will update the master template.
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancelEditFlow}
              className="bg-white border border-amber-300 text-amber-900 font-bold px-3 py-1.5 rounded-xl hover:bg-amber-100 text-xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              Cancel Edit & Create New
            </button>
          </div>
        )}

        {/* Grid: Left Editor & Right Templates Library */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Flow Editor (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <form onSubmit={handleCreateOrUpdateFlowSubmit} className="space-y-6">
              {/* Card 1: Flow Basic Details */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="border-b border-[#E5E7EB] pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#111827]">
                      1. Flow Information
                    </h2>
                    <p className="text-xs text-[#6B7280]">
                      Give this workflow flow a recognizable name and summary
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200">
                    Step 1
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#111827]">
                      Workflow Flow Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Client Performance & Creative Flow"
                      value={flowName}
                      onChange={(e) => setFlowName(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#111827] focus:outline-none focus:ring-1 focus:ring-indigo-600 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#111827]">
                      Flow Description (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Complete video shoot, script review, editing & ad live"
                      value={flowDescription}
                      onChange={(e) => setFlowDescription(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-sm font-normal text-[#111827] focus:outline-none focus:ring-1 focus:ring-indigo-600 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Add New Task Step */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="border-b border-[#E5E7EB] pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#111827]">
                      2. Add Task Step
                    </h2>
                    <p className="text-xs text-[#6B7280]">
                      Add individual deliverables or action items to this flow
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200">
                    Step 2
                  </span>
                </div>

                <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#111827]">
                      Task Step Title / Work Instructions <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Record raw shoot clips, review video guidelines and upload to drive..."
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#111827] focus:outline-none focus:ring-1 focus:ring-indigo-600 placeholder:text-slate-400 leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#111827]">
                        Assign Role <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={taskRoleId}
                        onChange={(e) => setTaskRoleId(e.target.value)}
                        className="w-full bg-white border border-[#E5E7EB] focus:border-indigo-600 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#111827] focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                      >
                        {rolesList.map((r) => (
                          <option key={r.id} value={r.id}>
                            👤 {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#111827]">
                        Input Type Required <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={taskType}
                        onChange={(e) => setTaskType(e.target.value as any)}
                        className="w-full bg-white border border-[#E5E7EB] focus:border-indigo-600 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#111827] focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                      >
                        <option value="both">✓ Checkbox + Text Input Note / Link</option>
                        <option value="checkbox">✓ Checkbox Only</option>
                        <option value="text">📝 Text Input / Notes Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-500">
                      💡 Steps can be re-ordered anytime using the arrow buttons below.
                    </span>

                    <button
                      type="button"
                      onClick={handleAddTaskStep}
                      disabled={!taskTitle.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-colors disabled:opacity-40 inline-flex items-center space-x-2 shadow-xs cursor-pointer"
                    >
                      <i className="fa-solid fa-plus text-xs"></i>
                      <span>Add Step to Flow</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 3: Flow Steps Sequence List */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="border-b border-[#E5E7EB] pb-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-bold text-[#111827]">
                      3. Flow Steps Sequence
                    </h2>
                    <span className="text-xs font-extrabold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      {draftTasks.length} {draftTasks.length === 1 ? "Step" : "Steps"}
                    </span>
                  </div>

                  {draftTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDraftTasks([])}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold transition-colors cursor-pointer"
                    >
                      Clear All Steps
                    </button>
                  )}
                </div>

                {draftTasks.length === 0 ? (
                  <div className="text-center py-10 px-4 border border-dashed border-[#E5E7EB] rounded-2xl space-y-2.5 bg-slate-50/50">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg mx-auto">
                      <i className="fa-solid fa-list-check"></i>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">
                      No Task Steps Added Yet
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Use the form above to add deliverables and role assignments to this workflow.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {draftTasks.map((t, idx) => (
                      <div
                        key={t.id}
                        className="bg-white border border-[#E5E7EB] hover:border-indigo-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shadow-2xs"
                      >
                        <div className="flex items-start space-x-3 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                            #{idx + 1}
                          </span>
                          <div className="space-y-1 min-w-0">
                            <p className="text-sm font-bold text-[#111827] leading-snug whitespace-pre-wrap break-words">
                              {t.title}
                            </p>
                            <div className="flex items-center flex-wrap gap-2 text-xs">
                              <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-100">
                                👤 {t.roleName}
                              </span>
                              <span className="bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-md border border-slate-200 text-[11px]">
                                {t.type === "both"
                                  ? "Checkbox + Note"
                                  : t.type === "checkbox"
                                  ? "Checkbox Only"
                                  : "Text Note Only"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 self-end sm:self-center flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTaskModal(t)}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-[#E5E7EB] hover:border-indigo-200 text-slate-700 hover:text-indigo-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                            title="Edit Step"
                          >
                            ✏️ Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveTaskStep(idx, "up")}
                            disabled={idx === 0}
                            className="w-8 h-8 rounded-lg border border-[#E5E7EB] text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center text-xs transition-colors cursor-pointer"
                            title="Move Up"
                          >
                            <i className="fa-solid fa-arrow-up"></i>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveTaskStep(idx, "down")}
                            disabled={idx === draftTasks.length - 1}
                            className="w-8 h-8 rounded-lg border border-[#E5E7EB] text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center text-xs transition-colors cursor-pointer"
                            title="Move Down"
                          >
                            <i className="fa-solid fa-arrow-down"></i>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveTaskStep(t.id)}
                            className="w-8 h-8 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center justify-center text-xs transition-colors cursor-pointer ml-1"
                            title="Delete Step"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Action Bar */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/crms?tab=roles")}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-[#E5E7EB] transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !flowName.trim() || draftTasks.length === 0}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                  ) : (
                    <i className="fa-solid fa-floppy-disk text-xs"></i>
                  )}
                  <span>
                    {editingFlowId ? "Update Workflow Flow Template ✏️" : "Save Workflow Flow Template 🚀"}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Templates Library (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4 sticky top-20">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <div className="flex items-center space-x-2">
                  <i className="fa-solid fa-layer-group text-indigo-600"></i>
                  <h3 className="text-sm font-bold text-[#111827]">
                    Flow Templates ({flowTemplatesList.length})
                  </h3>
                </div>

                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  /flows
                </span>
              </div>

              {/* Search Templates */}
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Search templates or roles..."
                  value={searchTemplateQuery}
                  onChange={(e) => setSearchTemplateQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-[#E5E7EB] rounded-xl pl-8 pr-3 py-2 text-xs font-medium text-[#111827] focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>

              {filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 italic">
                  {flowTemplatesList.length === 0
                    ? "No flow templates created yet."
                    : "No templates match your search."}
                </div>
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                  {filteredTemplates.map((flow) => {
                    const isSelectedForEdit = editingFlowId === flow.id;
                    const stepCount = flow.tasks?.length || 0;

                    return (
                      <div
                        key={flow.id}
                        className={`border rounded-xl p-4 space-y-2.5 transition-all shadow-2xs ${
                          isSelectedForEdit
                            ? "border-amber-400 bg-amber-50/40 ring-2 ring-amber-300"
                            : "border-[#E5E7EB] bg-white hover:border-indigo-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-[#111827] leading-snug">
                              🚀 {flow.name}
                            </h4>
                            <p className="text-[11px] text-[#6B7280] font-normal line-clamp-2 mt-0.5">
                              {flow.description || "No description."}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full flex-shrink-0">
                            {stepCount} {stepCount === 1 ? "Step" : "Steps"}
                          </span>
                        </div>

                        {/* Steps Preview */}
                        <div className="space-y-1 pt-1.5 border-t border-slate-100">
                          {(flow.tasks || []).slice(0, 3).map((t, idx) => (
                            <div
                              key={t.id}
                              className="text-[11px] text-slate-600 flex items-center justify-between font-medium"
                            >
                              <span className="truncate max-w-[160px]">
                                {idx + 1}. {t.title}
                              </span>
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                                {t.roleName}
                              </span>
                            </div>
                          ))}
                          {(flow.tasks || []).length > 3 && (
                            <p className="text-[10px] text-slate-400 italic">
                              + {(flow.tasks || []).length - 3} more steps
                            </p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            By {flow.createdBy?.split("@")[0]}
                          </span>

                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditFlow(flow)}
                              className="text-indigo-700 hover:text-indigo-900 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                              title="Edit Template"
                            >
                              ✏️ Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicateFlow(flow)}
                              className="text-slate-700 hover:text-slate-900 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                              title="Duplicate Template"
                            >
                              📋 Copy
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(flow)}
                              className="text-rose-600 hover:text-rose-800 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                              title="Delete Template"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* EDIT INDIVIDUAL TASK STEP MODAL */}
      {editingTaskItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setEditingTaskItem(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4 border border-[#E5E7EB] z-10 font-sans">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h3 className="text-base font-bold text-[#111827] flex items-center space-x-2">
                <i className="fa-solid fa-pen-to-square text-indigo-600"></i>
                <span>Edit Task Step</span>
              </h3>
              <button
                onClick={() => setEditingTaskItem(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#111827]">
                  Task Step Title / Work Instructions <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={editTaskTitle}
                  onChange={(e) => setEditTaskTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-[#E5E7EB] focus:border-indigo-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#111827] focus:outline-none focus:ring-1 focus:ring-indigo-600 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#111827]">
                    Assign Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editTaskRoleId}
                    onChange={(e) => setEditTaskRoleId(e.target.value)}
                    className="w-full bg-slate-50 border border-[#E5E7EB] focus:border-indigo-600 focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-[#111827] focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                  >
                    {rolesList.map((r) => (
                      <option key={r.id} value={r.id}>
                        👤 {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#111827]">
                    Input Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editTaskType}
                    onChange={(e) => setEditTaskType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-[#E5E7EB] focus:border-indigo-600 focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-[#111827] focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                  >
                    <option value="both">Checkbox + Text Note</option>
                    <option value="checkbox">Checkbox Only</option>
                    <option value="text">Text Note Only</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setEditingTaskItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-[#E5E7EB] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditTask}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
              >
                Save Changes 💾
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOW TEMPLATE DELETION CONFIRMATION MODAL */}
      {deleteModalFlow && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setDeleteModalFlow(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4 border border-rose-200 z-10 font-sans">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-base font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111827]">
                  Delete Flow Template
                </h3>
                <p className="text-xs text-rose-600 font-semibold">
                  {deleteModalFlow.name}
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1.5 text-xs">
              <p className="text-rose-900 font-semibold leading-relaxed">
                Deleting master template <strong>"{deleteModalFlow.name}"</strong> will remove it from the template library.
              </p>
              <p className="text-rose-800 text-[11px]">
                Active client workflows already assigned will remain intact.
              </p>
            </div>

            <label className="flex items-start space-x-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={readTermsChecked}
                onChange={(e) => setReadTermsChecked(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800 leading-snug">
                I understand this template will be permanently removed.
              </span>
            </label>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Type <strong className="text-rose-700 font-mono">CONFIRM</strong> to delete:
              </label>
              <input
                type="text"
                placeholder="Type CONFIRM..."
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalFlow(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-[#E5E7EB] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!readTermsChecked || deleteConfirmInput.trim() !== "CONFIRM" || isDeleting}
                onClick={handleConfirmDeleteFlow}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer"
              >
                {isDeleting ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                ) : (
                  <i className="fa-solid fa-trash-can text-xs"></i>
                )}
                <span>Delete Template</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
