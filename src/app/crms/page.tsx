"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  getLeadsForDate,
  getMeetingsForDate,
  getAllMeetings,
  getAllLeadsAcrossDates,
  updateLeadStaffFields,
  onboardLeadClient,
  getAllOnboardedRecords,
  deleteOnboardRecord,
  updateOnboardRecordDealValue,
  getRoles,
  createRole,
  deleteRole,
  syncAndGetUser,
  getAllUsers,
  setUserRoleByEmail,
  registerUserByEmail,
  getFlowTemplates,
  createFlowTemplate,
  deleteFlowTemplate,
  assignFlowToClient,
  getAllClientFlows,
  markClientFlowCompleted,
  deleteClientFlowInstance,
  MASTER_ADMIN_UID,
  sanitizeEmailToId,
  LeadData,
  StaffNote,
  OnboardRecord,
  RoleData,
  UserData,
  FlowTemplate,
  FlowTaskTemplate,
  ClientFlowInstance,
  db,
} from "@/lib/firebase";
import {
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { ref, onValue, set } from "firebase/database";
import { CAMPAIGNS } from "@/config/campaigns";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export interface PipelineStageConfig {
  id: string;
  name: string;
  color: string;
  bgTag: string;
  isCompulsory?: boolean;
  isDeleted?: boolean;
}

// Pipeline Stages Config
const DEFAULT_PIPELINE_STAGES: PipelineStageConfig[] = [
  { id: "raw", name: "Leads", color: "#6366f1", bgTag: "bg-indigo-50 text-indigo-700 border-indigo-200", isCompulsory: true, isDeleted: false },
  { id: "in_progress", name: "1st Connection", color: "#3b82f6", bgTag: "bg-blue-50 text-blue-700 border-blue-200", isCompulsory: false, isDeleted: false },
  { id: "survey_completed", name: "Survey Completed", color: "#06b6d4", bgTag: "bg-cyan-50 text-cyan-700 border-cyan-200", isCompulsory: false, isDeleted: false },
  { id: "meeting_booked", name: "Meeting Booked", color: "#10b981", bgTag: "bg-emerald-50 text-emerald-700 border-emerald-200", isCompulsory: false, isDeleted: false },
  { id: "proposal_sent", name: "Proposal Sent", color: "#f59e0b", bgTag: "bg-amber-50 text-amber-700 border-amber-200", isCompulsory: false, isDeleted: false },
  { id: "won", name: "Won", color: "#16a34a", bgTag: "bg-green-50 text-green-800 border-green-200", isCompulsory: true, isDeleted: false },
  { id: "not_qualified", name: "Not Qualified", color: "#f43f5e", bgTag: "bg-rose-50 text-rose-700 border-rose-200", isCompulsory: false, isDeleted: false },
];

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

function isMeetingInPast(meetingDateStr?: string, timeStr?: string): boolean {
  if (!meetingDateStr) return false;
  try {
    const cleanDate = meetingDateStr.split("T")[0];
    let hour = 12;
    let minute = 0;

    if (timeStr) {
      const cleanTime = timeStr.trim();
      if (cleanTime.includes("AM") || cleanTime.includes("PM")) {
        const isPm = cleanTime.includes("PM");
        const timePart = cleanTime.replace("AM", "").replace("PM", "").trim();
        const parts = timePart.split(":");
        hour = parseInt(parts[0], 10);
        if (isPm && hour < 12) hour += 12;
        if (!isPm && hour === 12) hour = 0;
        if (parts[1]) minute = parseInt(parts[1], 10);
      } else if (cleanTime.includes(":")) {
        const parts = cleanTime.split(":");
        hour = parseInt(parts[0], 10);
        minute = parseInt(parts[1], 10);
      }
    }

    const meetingDateTime = new Date(`${cleanDate}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`);
    const now = new Date();
    return meetingDateTime < now;
  } catch (err) {
    return false;
  }
}

function getLeadEffectiveStage(lead: LeadData): string {
  return lead.pipelineStage || "raw";
}

export default function CRMPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // CRM Dashboard State
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const sevenDaysAgoObj = new Date(today);
  sevenDaysAgoObj.setDate(sevenDaysAgoObj.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgoObj.toISOString().split("T")[0];

  const sevenDaysAheadObj = new Date(today);
  sevenDaysAheadObj.setDate(sevenDaysAheadObj.getDate() + 7);
  const sevenDaysAheadStr = sevenDaysAheadObj.toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"leads" | "pipeline" | "meetings" | "calendar" | "onboarded" | "roles">("pipeline");

  // Read URL query parameter on initial load to preserve route state on refresh
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as any;
      if (tabParam && ["leads", "pipeline", "meetings", "calendar", "onboarded", "roles"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  // Helper to switch active tab and sync URL query parameter
  const changeTab = useCallback((tab: "leads" | "pipeline" | "meetings" | "calendar" | "onboarded" | "roles") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.pushState({}, "", url.toString());
    }
  }, []);

  // Data State
  const [leadsList, setLeadsList] = useState<LeadData[]>([]);
  const [allLeadsList, setAllLeadsList] = useState<LeadData[]>([]);
  const [meetingsList, setMeetingsList] = useState<any[]>([]);
  const [allMeetingsList, setAllMeetingsList] = useState<any[]>([]);
  const [allOnboardedList, setAllOnboardedList] = useState<OnboardRecord[]>([]);
  const [rolesList, setRolesList] = useState<RoleData[]>([]);
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [flowTemplatesList, setFlowTemplatesList] = useState<FlowTemplate[]>([]);
  const [clientFlowInstancesList, setClientFlowInstancesList] = useState<ClientFlowInstance[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ROLES & USER MANAGEMENT STATE
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [roleErrorMessage, setRoleErrorMessage] = useState<string | null>(null);
  const [roleSuccessMessage, setRoleSuccessMessage] = useState<string | null>(null);

  // MANUAL EMAIL USER REGISTRATION STATE
  const [newRegisterEmail, setNewRegisterEmail] = useState("");
  const [newRegisterRoleId, setNewRegisterRoleId] = useState("role_onboarding");
  const [isRegisteringUser, setIsRegisteringUser] = useState(false);

  // WORKFLOW TEMPLATE BUILDER STATE
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");
  const [flowDraftTasks, setFlowDraftTasks] = useState<FlowTaskTemplate[]>([]);
  const [draftTaskTitle, setDraftTaskTitle] = useState("");
  const [draftTaskRoleId, setDraftTaskRoleId] = useState("");
  const [draftTaskType, setDraftTaskType] = useState<"checkbox" | "text" | "both">("both");
  const [isCreatingFlow, setIsCreatingFlow] = useState(false);

  // ASSIGN FLOW TO CLIENT MODAL STATE
  const [assignFlowModalClient, setAssignFlowModalClient] = useState<OnboardRecord | null>(null);
  const [selectedFlowTemplateId, setSelectedFlowTemplateId] = useState<string>("");
  const [customAssignedFlowName, setCustomAssignedFlowName] = useState<string>("");
  const [isAssigningFlow, setIsAssigningFlow] = useState(false);

  // DELETE ASSIGNED CLIENT FLOW MODAL STATE
  const [deleteClientFlowModal, setDeleteClientFlowModal] = useState<ClientFlowInstance | null>(null);
  const [isDeletingClientFlow, setIsDeletingClientFlow] = useState(false);

  // VIEW LIVE FLOW AUDIT MODAL STATE FOR ADMIN
  const [viewFlowAuditModal, setViewFlowAuditModal] = useState<ClientFlowInstance | null>(null);

  // Pipeline Advanced Date Filter Controls
  const [pipelineTargetField, setPipelineTargetField] = useState<"meeting" | "created" | "followup">("created");
  const [pipelineDatePreset, setPipelineDatePreset] = useState<
    "specific_date" | "today" | "yesterday" | "last_7_days" | "upcoming_7_days" | "all_time" | "custom_range"
  >("specific_date");

  const [pipelineSingleDate, setPipelineSingleDate] = useState<string>(todayStr);
  const [pipelineStartDate, setPipelineStartDate] = useState<string>(sevenDaysAgoStr);
  const [pipelineEndDate, setPipelineEndDate] = useState<string>(todayStr);

  // Dashboard Leads Tab Date Filter State
  const [leadsDatePreset, setLeadsDatePreset] = useState<
    "last_7_days" | "today" | "yesterday" | "specific_date" | "custom_range" | "all_time"
  >("last_7_days");
  const [leadsSingleDate, setLeadsSingleDate] = useState<string>(todayStr);
  const [leadsStartDate, setLeadsStartDate] = useState<string>(sevenDaysAgoStr);
  const [leadsEndDate, setLeadsEndDate] = useState<string>(todayStr);

  // DYNAMIC PIPELINE STAGES MANAGED STATE
  const [pipelineStages, setPipelineStages] = useState<PipelineStageConfig[]>(DEFAULT_PIPELINE_STAGES);
  const [isManagePipelineModalOpen, setIsManagePipelineModalOpen] = useState(false);
  const [managePipelineTab, setManagePipelineTab] = useState<"active" | "bin">("active");

  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6366f1");
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");

  // Realtime Sync Pipeline Stages from Firebase RTDB `pipeline_stages/firstoptionagency`
  useEffect(() => {
    const stagesRef = ref(db, "pipeline_stages/firstoptionagency");
    const unsubscribe = onValue(stagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (Array.isArray(data)) {
          setPipelineStages(data);
        }
      } else {
        setPipelineStages(DEFAULT_PIPELINE_STAGES);
      }
    });

    return () => unsubscribe();
  }, []);

  // Filter Active vs Deleted Pipeline Stages
  const activePipelineStages = pipelineStages.filter((s) => !s.isDeleted);
  const deletedPipelineStages = pipelineStages.filter((s) => s.isDeleted);

  // Save Pipeline Stages Array to Firebase RTDB
  const savePipelineStagesToFirebase = async (updatedStages: PipelineStageConfig[]) => {
    try {
      const stagesRef = ref(db, "pipeline_stages/firstoptionagency");
      await set(stagesRef, updatedStages);
      setPipelineStages(updatedStages);
    } catch (err) {
      console.error("Save Pipeline Stages Error:", err);
    }
  };

  // Add New Custom Stage
  const handleAddCustomStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) return;

    const stageId = `stage_${Date.now()}`;
    const newStage: PipelineStageConfig = {
      id: stageId,
      name: newStageName.trim(),
      color: newStageColor,
      bgTag: "bg-indigo-50 text-indigo-700 border-indigo-200",
      isCompulsory: false,
      isDeleted: false,
    };

    const updated = [...pipelineStages];
    const wonIdx = updated.findIndex((s) => s.id === "won");
    if (wonIdx !== -1) {
      updated.splice(wonIdx, 0, newStage);
    } else {
      updated.push(newStage);
    }

    await savePipelineStagesToFirebase(updated);
    setNewStageName("");
  };

  // Soft Delete Stage (Move to Recycle Bin)
  const handleSoftDeleteStage = async (stageId: string) => {
    const target = pipelineStages.find((s) => s.id === stageId);
    if (target?.isCompulsory || stageId === "raw" || stageId === "won") {
      alert("Compulsory Core Stages ('Leads' & 'Won') cannot be deleted or removed!");
      return;
    }

    const updated = pipelineStages.map((s) => (s.id === stageId ? { ...s, isDeleted: true } : s));
    await savePipelineStagesToFirebase(updated);
  };

  // Restore Soft Deleted Stage from Recycle Bin
  const handleRestoreSoftDeletedStage = async (stageId: string) => {
    const updated = pipelineStages.map((s) => (s.id === stageId ? { ...s, isDeleted: false } : s));
    await savePipelineStagesToFirebase(updated);
  };

  // Save Renamed Stage
  const handleSaveRenameStage = async (stageId: string) => {
    if (!editingStageName.trim()) return;
    const target = pipelineStages.find((s) => s.id === stageId);
    if (target?.isCompulsory || stageId === "raw" || stageId === "won") {
      alert("Compulsory Core Stages ('Leads' & 'Won') cannot be renamed!");
      return;
    }

    const updated = pipelineStages.map((s) => (s.id === stageId ? { ...s, name: editingStageName.trim() } : s));
    await savePipelineStagesToFirebase(updated);
    setEditingStageId(null);
    setEditingStageName("");
  };

  // Scheduled Meetings Tab Date Filter State
  const [meetingsDatePreset, setMeetingsDatePreset] = useState<
    "upcoming_7_days" | "today" | "tomorrow" | "specific_date" | "custom_range" | "all_time"
  >("upcoming_7_days");
  const [meetingsSingleDate, setMeetingsSingleDate] = useState<string>(todayStr);
  const [meetingsStartDate, setMeetingsStartDate] = useState<string>(todayStr);
  const [meetingsEndDate, setMeetingsEndDate] = useState<string>(sevenDaysAheadStr);

  // Mobile Sidebar State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Right Drawer State
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [followUpDateInput, setFollowUpDateInput] = useState("");
  const [dealValueInput, setDealValueInput] = useState<string>("");
  const [isSavingStaffData, setIsSavingStaffData] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // ONBOARD CONFIRMATION MODAL STATE
  const [onboardConfirmModalLead, setOnboardConfirmModalLead] = useState<LeadData | null>(null);
  const [onboardMode, setOnboardMode] = useState<"append" | "replace">("append");

  // DELETE ONBOARD MODAL STATE
  const [deleteOnboardModalRecord, setDeleteOnboardModalRecord] = useState<OnboardRecord | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState<string>("");
  const [isDeletingOnboard, setIsDeletingOnboard] = useState<boolean>(false);

  // Day Meetings Modal Popup State
  const [dayMeetingsModalData, setDayMeetingsModalData] = useState<{
    dateStr: string;
    meetings: any[];
  } | null>(null);

  // Calendar View State
  const [calYear, setCalYear] = useState<number>(today.getFullYear());
  const [calMonthIndex, setCalMonthIndex] = useState<number>(today.getMonth());
  const [calViewMode, setCalViewMode] = useState<"month" | "week">("month");

  // Check Auth State & Access Control (Admin Only Access)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login?redirect=/crms");
      } else {
        setCurrentUser(user);
        const userData = await syncAndGetUser(user.uid, user.email || "");
        setCurrentUserData(userData);

        const isAdmin = user.uid === MASTER_ADMIN_UID || userData.roleId === "role_admin" || userData.roleName.toLowerCase() === "admin" || user.email?.toLowerCase().startsWith("firstoption");
        if (!isAdmin) {
          setAccessDenied(true);
        } else {
          setAccessDenied(false);
        }
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch Dashboard, Pipeline, Calendar, Onboarded Data, Roles, Users, Flows
  const fetchData = useCallback(async () => {
    if (!currentUser || accessDenied) return;
    setIsDataLoading(true);
    try {
      const [
        fetchedLeads,
        fetchedMeetings,
        fetchedAllMeetings,
        fetchedAllLeads,
        fetchedOnboarded,
        fetchedRoles,
        fetchedUsers,
        fetchedFlows,
        fetchedClientFlows,
      ] = await Promise.all([
        getLeadsForDate(selectedDate, selectedCampaign),
        getMeetingsForDate(selectedDate, selectedCampaign),
        getAllMeetings(selectedCampaign),
        getAllLeadsAcrossDates(selectedCampaign),
        getAllOnboardedRecords(selectedCampaign),
        getRoles(),
        getAllUsers(),
        getFlowTemplates(),
        getAllClientFlows(),
      ]);
      setLeadsList(fetchedLeads);
      setMeetingsList(fetchedMeetings);
      setAllMeetingsList(fetchedAllMeetings);
      setAllLeadsList(fetchedAllLeads);
      setAllOnboardedList(fetchedOnboarded);
      setRolesList(fetchedRoles);
      setUsersList(fetchedUsers);
      setFlowTemplatesList(fetchedFlows);
      setClientFlowInstancesList(fetchedClientFlows);
    } catch (err) {
      console.error("CRM Data Fetch Error:", err);
    } finally {
      setIsDataLoading(false);
    }
  }, [currentUser, selectedDate, selectedCampaign, accessDenied]);

  useEffect(() => {
    if (currentUser && !accessDenied) {
      fetchData();
    }
  }, [currentUser, fetchData, accessDenied]);

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
    setDealValueInput(lead.dealValue ? lead.dealValue.toString() : "");
    setNewNoteText("");
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedLead(null);
  };

  // Create Role Action
  const handleCreateNewRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleErrorMessage(null);
    setRoleSuccessMessage(null);

    const cleanName = newRoleName.trim();
    if (!cleanName) {
      setRoleErrorMessage("Please enter a role name.");
      return;
    }

    if (cleanName.toLowerCase() === "admin") {
      setRoleErrorMessage("Cannot create 'Admin' role. Admin is a system default role.");
      return;
    }

    setIsCreatingRole(true);
    const res = await createRole(cleanName, newRoleDescription);
    setIsCreatingRole(false);

    if (res.success && res.role) {
      setRolesList((prev) => [...prev, res.role!]);
      setNewRoleName("");
      setNewRoleDescription("");
      setRoleSuccessMessage(`Role '${cleanName}' created successfully!`);
    } else {
      setRoleErrorMessage(res.message || "Failed to create role.");
    }
  };

  // Soft Delete Role Action
  const handleDeleteRole = async (role: RoleData) => {
    setRoleErrorMessage(null);
    setRoleSuccessMessage(null);

    if (role.name.toLowerCase() === "admin" || role.id === "role_admin") {
      setRoleErrorMessage(`System 'Admin' role cannot be deleted.`);
      return;
    }

    const res = await deleteRole(role.id);
    if (res.success) {
      setRolesList((prev) => prev.filter((r) => r.id !== role.id));
      setRoleSuccessMessage(`Role '${role.name}' soft deleted (isDeleted: true).`);
    } else {
      setRoleErrorMessage(res.message || "Failed to soft delete role.");
    }
  };

  // Manual Email User Registration Handler
  const handleManualRegisterUserByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleErrorMessage(null);
    setRoleSuccessMessage(null);

    const cleanEmail = newRegisterEmail.trim();

    if (!cleanEmail) {
      setRoleErrorMessage("Please enter a valid User Email address.");
      return;
    }

    const targetRoleObj = rolesList.find((r) => r.id === newRegisterRoleId) || { id: "role_onboarding", name: "Onboarding Specialist" };
    const isMaster = cleanEmail.toLowerCase().startsWith("firstoption");

    if (!isMaster && (targetRoleObj.id === "role_admin" || targetRoleObj.name.toLowerCase() === "admin")) {
      setRoleErrorMessage("Cannot assign Admin role to non-Master email accounts.");
      return;
    }

    setIsRegisteringUser(true);
    const res = await registerUserByEmail(cleanEmail, targetRoleObj.id, targetRoleObj.name);
    setIsRegisteringUser(false);

    if (res.success && res.user) {
      setUsersList((prev) => {
        const exists = prev.some((u) => u.email.toLowerCase() === cleanEmail.toLowerCase());
        if (exists) {
          return prev.map((u) => (u.email.toLowerCase() === cleanEmail.toLowerCase() ? res.user! : u));
        }
        return [...prev, res.user!];
      });
      setNewRegisterEmail("");
      setRoleSuccessMessage(`User '${cleanEmail}' added and assigned '${targetRoleObj.name}' role!`);
    } else {
      setRoleErrorMessage(res.message || "Failed to add user email.");
    }
  };

  // Assign / Change User Role Action By Email
  const handleAssignUserRoleByEmail = async (targetEmail: string, targetRoleId: string) => {
    setRoleErrorMessage(null);
    setRoleSuccessMessage(null);

    const targetRoleObj = rolesList.find((r) => r.id === targetRoleId);
    if (!targetRoleObj) return;

    const isMaster = targetEmail.toLowerCase().startsWith("firstoption");

    if (!isMaster && (targetRoleId === "role_admin" || targetRoleObj.name.toLowerCase() === "admin")) {
      setRoleErrorMessage("Admin role is strictly reserved for Master Admin accounts. You cannot assign Admin role to other staff emails.");
      return;
    }

    const res = await setUserRoleByEmail(targetEmail, targetRoleId, targetRoleObj.name);
    if (res.success) {
      setUsersList((prev) =>
        prev.map((u) => (u.email.toLowerCase() === targetEmail.toLowerCase() ? { ...u, roleId: targetRoleId, roleName: targetRoleObj.name } : u))
      );
      setRoleSuccessMessage(`Role for '${targetEmail}' updated to '${targetRoleObj.name}'!`);
    } else {
      setRoleErrorMessage(res.message || "Failed to update user role.");
    }
  };

  // Add Task Step to Flow Template Draft
  const handleAddDraftTaskToFlow = () => {
    if (!draftTaskTitle.trim()) return;
    const targetRole = rolesList.find((r) => r.id === draftTaskRoleId) || rolesList[0] || { id: "role_editor", name: "Editor" };

    const newTask: FlowTaskTemplate = {
      id: "ftask_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      roleId: targetRole.id,
      roleName: targetRole.name,
      title: draftTaskTitle.trim(),
      type: draftTaskType,
    };

    setFlowDraftTasks((prev) => [...prev, newTask]);
    setDraftTaskTitle("");
  };

  // Create Flow Template Handler
  const handleCreateFlowTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleErrorMessage(null);
    setRoleSuccessMessage(null);

    if (!newFlowName.trim()) {
      setRoleErrorMessage("Please enter a Workflow Flow name.");
      return;
    }
    if (flowDraftTasks.length === 0) {
      setRoleErrorMessage("Please add at least one task step to the Flow.");
      return;
    }

    setIsCreatingFlow(true);
    const creatorEmail = currentUser?.email || "Admin";
    const res = await createFlowTemplate(newFlowName, newFlowDescription, flowDraftTasks, creatorEmail);
    setIsCreatingFlow(false);

    if (res.success && res.flow) {
      setFlowTemplatesList((prev) => [...prev, res.flow!]);
      setNewFlowName("");
      setNewFlowDescription("");
      setFlowDraftTasks([]);
      setRoleSuccessMessage(`Workflow Flow '${res.flow.name}' created successfully!`);
    } else {
      setRoleErrorMessage(res.message || "Failed to create Flow Template.");
    }
  };

  // Delete Flow Template Handler
  const handleDeleteFlowTemplate = async (flowId: string) => {
    const res = await deleteFlowTemplate(flowId);
    if (res.success) {
      setFlowTemplatesList((prev) => prev.filter((f) => f.id !== flowId));
      setRoleSuccessMessage("Workflow Flow template deleted.");
    }
  };

  // Open Assign Flow Modal to Client
  const handleOpenAssignFlowModal = (client: OnboardRecord) => {
    setAssignFlowModalClient(client);
    setSelectedFlowTemplateId(flowTemplatesList[0]?.id || "");
    setCustomAssignedFlowName("");
  };

  // Execute Assign Flow to Client
  const handleConfirmAssignFlowToClient = async () => {
    if (!assignFlowModalClient || !selectedFlowTemplateId) return;
    setIsAssigningFlow(true);

    const adminEmail = currentUser?.email || "Admin";
    const res = await assignFlowToClient(
      assignFlowModalClient.id,
      assignFlowModalClient.fullName,
      assignFlowModalClient.email,
      assignFlowModalClient.campaign,
      selectedFlowTemplateId,
      customAssignedFlowName,
      adminEmail
    );

    if (res.success && res.instance) {
      setClientFlowInstancesList((prev) => [...prev, res.instance!]);
      setRoleSuccessMessage(`Flow '${res.instance.flowName}' assigned to client ${assignFlowModalClient.fullName}!`);
    }
    setIsAssigningFlow(false);
    setAssignFlowModalClient(null);
  };

  // Mark Client Flow Instance Completed by Admin
  const handleMarkClientFlowCompleted = async (clientFlowId: string) => {
    const res = await markClientFlowCompleted(clientFlowId);
    if (res.success) {
      setClientFlowInstancesList((prev) =>
        prev.map((cf) => (cf.id === clientFlowId ? { ...cf, status: "completed" } : cf))
      );
    }
  };

  // Delete Assigned Client Flow Instance
  const handleConfirmDeleteClientFlow = async () => {
    if (!deleteClientFlowModal) return;
    setIsDeletingClientFlow(true);

    const res = await deleteClientFlowInstance(deleteClientFlowModal.id);
    if (res.success) {
      setClientFlowInstancesList((prev) => prev.filter((cf) => cf.id !== deleteClientFlowModal.id));
      setRoleSuccessMessage(`Assigned flow '${deleteClientFlowModal.flowName}' removed from ${deleteClientFlowModal.clientName}. You can now re-assign an updated flow.`);
    }

    setIsDeletingClientFlow(false);
    setDeleteClientFlowModal(null);
  };

  // Staff Action: Update Lead Stage
  const handleUpdateStage = async (lead: LeadData, newStage: string) => {
    const targetLeadId = lead.id || (lead.email ? sanitizeEmailToId(lead.email) : "lead_" + Date.now());
    const targetCreatedDate = lead.createdDate || selectedDate;
    const targetCampaign = lead.campaign || "firstoptionagency";

    const updatedLead = { ...lead, pipelineStage: newStage };
    setAllLeadsList((prev) =>
      prev.map((l) => (l.id === targetLeadId || l.email === lead.email ? updatedLead : l))
    );
    setLeadsList((prev) =>
      prev.map((l) => (l.id === targetLeadId || l.email === lead.email ? updatedLead : l))
    );
    if (selectedLead && (selectedLead.id === targetLeadId || selectedLead.email === lead.email)) {
      setSelectedLead(updatedLead);
    }

    await updateLeadStaffFields(
      targetLeadId,
      targetCreatedDate,
      { pipelineStage: newStage },
      targetCampaign
    );
  };

  // Trigger Onboard Confirmation Modal
  const handleOpenOnboardModal = (lead: LeadData) => {
    setOnboardConfirmModalLead(lead);
    setOnboardMode("append");
  };

  // Execute Onboarding after confirmation
  const handleConfirmExecuteOnboard = async () => {
    if (!onboardConfirmModalLead) return;
    const lead = onboardConfirmModalLead;
    const targetLeadId = lead.id || (lead.email ? sanitizeEmailToId(lead.email) : "lead_" + Date.now());
    const staffEmail = currentUser?.email || "Staff";
    const campaignName = lead.campaign || "firstoptionagency";

    setIsOnboarding(true);

    if (onboardMode === "replace" && lead.onboarded) {
      const existingRecords = allOnboardedList.filter((r) => r.leadId === targetLeadId || r.email === lead.email);
      for (const rec of existingRecords) {
        await deleteOnboardRecord(rec.id, campaignName, rec.onboardedDate, targetLeadId, lead.createdDate);
      }
    }

    const newCount = onboardMode === "replace" ? 1 : (lead.onboardCount || 0) + 1;
    const timestamp = new Date().toISOString();

    const updatedLead: LeadData = {
      ...lead,
      onboarded: true,
      onboardedAt: timestamp,
      onboardCount: newCount,
      pipelineStage: "won",
    };

    setAllLeadsList((prev) =>
      prev.map((l) => (l.id === targetLeadId || l.email === lead.email ? updatedLead : l))
    );
    setLeadsList((prev) =>
      prev.map((l) => (l.id === targetLeadId || l.email === lead.email ? updatedLead : l))
    );
    if (selectedLead && (selectedLead.id === targetLeadId || selectedLead.email === lead.email)) {
      setSelectedLead(updatedLead);
    }

    await onboardLeadClient(lead, staffEmail, campaignName);
    const refreshedOnboards = await getAllOnboardedRecords(selectedCampaign);
    setAllOnboardedList(refreshedOnboards);

    setIsOnboarding(false);
    setOnboardConfirmModalLead(null);
  };

  // Trigger Delete Onboard Confirmation Modal
  const handleOpenDeleteOnboardModal = (record: OnboardRecord) => {
    setDeleteOnboardModalRecord(record);
    setDeleteConfirmInput("");
  };

  // Execute Onboard Record Deletion
  const handleConfirmDeleteOnboard = async () => {
    if (!deleteOnboardModalRecord || deleteConfirmInput.trim() !== "CONFIRM") return;
    setIsDeletingOnboard(true);

    const targetLead = allLeadsList.find(
      (l) => l.id === deleteOnboardModalRecord.leadId || l.email === deleteOnboardModalRecord.email
    );

    const success = await deleteOnboardRecord(
      deleteOnboardModalRecord.id,
      deleteOnboardModalRecord.campaign,
      deleteOnboardModalRecord.onboardedDate,
      deleteOnboardModalRecord.leadId,
      targetLead?.createdDate || todayStr
    );

    if (success) {
      setAllOnboardedList((prev) => prev.filter((r) => r.id !== deleteOnboardModalRecord.id));
      await fetchData();
    }

    setIsDeletingOnboard(false);
    setDeleteOnboardModalRecord(null);
    setDeleteConfirmInput("");
  };

  // Staff Action: Update Deal Value (₹)
  const handleSaveDealValue = async (valStr: string) => {
    if (!selectedLead) return;
    const valNum = parseFloat(valStr) || 0;
    setDealValueInput(valStr);
    setIsSavingStaffData(true);

    const targetLeadId = selectedLead.id || (selectedLead.email ? sanitizeEmailToId(selectedLead.email) : "lead_" + Date.now());
    const targetCreatedDate = selectedLead.createdDate || selectedDate;
    const targetCampaign = selectedLead.campaign || "firstoptionagency";

    const success = await updateLeadStaffFields(
      targetLeadId,
      targetCreatedDate,
      { dealValue: valNum },
      targetCampaign
    );

    if (success) {
      const updatedLead = { ...selectedLead, dealValue: valNum };
      setSelectedLead(updatedLead);
      setAllLeadsList((prev) =>
        prev.map((l) => (l.id === targetLeadId || l.email === selectedLead.email ? updatedLead : l))
      );
      setLeadsList((prev) =>
        prev.map((l) => (l.id === targetLeadId || l.email === selectedLead.email ? updatedLead : l))
      );
      setAllOnboardedList((prev) =>
        prev.map((ob) => (ob.leadId === targetLeadId || ob.email === selectedLead.email ? { ...ob, dealValue: valNum } : ob))
      );
    }
    setIsSavingStaffData(false);
  };

  // Update Deal Value directly on Onboard Record
  const handleUpdateOnboardRecordDealValue = async (obRecord: OnboardRecord, newVal: number) => {
    const targetLead = allLeadsList.find(
      (l) => l.id === obRecord.leadId || l.email === obRecord.email
    );

    setAllOnboardedList((prev) =>
      prev.map((r) => (r.id === obRecord.id ? { ...r, dealValue: newVal } : r))
    );
    if (targetLead) {
      const updatedLead = { ...targetLead, dealValue: newVal };
      setAllLeadsList((prev) =>
        prev.map((l) => (l.id === targetLead.id || l.email === targetLead.email ? updatedLead : l))
      );
    }

    await updateOnboardRecordDealValue(
      obRecord.id,
      obRecord.campaign,
      obRecord.onboardedDate,
      newVal,
      obRecord.leadId,
      targetLead?.createdDate || todayStr
    );
  };

  // Staff Action: Add note
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
      setAllLeadsList((prev) =>
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

  // Staff Action: Save Follow-up Date
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
      setAllLeadsList((prev) =>
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
  const filteredLeads = allLeadsList.filter((lead) => {
    if (selectedCampaign !== "all" && lead.campaign !== selectedCampaign) return false;

    const createdDateStr = lead.createdDate;
    if (leadsDatePreset !== "all_time") {
      if (!createdDateStr) return false;
      const cleanDate = createdDateStr.split("T")[0];

      if (leadsDatePreset === "specific_date") {
        if (cleanDate !== leadsSingleDate) return false;
      } else if (leadsDatePreset === "custom_range") {
        if (leadsStartDate && cleanDate < leadsStartDate) return false;
        if (leadsEndDate && cleanDate > leadsEndDate) return false;
      } else if (leadsDatePreset === "today") {
        if (cleanDate !== todayStr) return false;
      } else if (leadsDatePreset === "yesterday") {
        const yestObj = new Date(today);
        yestObj.setDate(yestObj.getDate() - 1);
        const yestStr = yestObj.toISOString().split("T")[0];
        if (cleanDate !== yestStr) return false;
      } else if (leadsDatePreset === "last_7_days") {
        const d7AgoObj = new Date(today);
        d7AgoObj.setDate(d7AgoObj.getDate() - 7);
        const d7AgoStr = d7AgoObj.toISOString().split("T")[0];
        if (cleanDate < d7AgoStr || cleanDate > todayStr) return false;
      }
    }

    const matchesSearch =
      (lead.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.phone || "").includes(searchQuery) ||
      (lead.email || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" ? true : lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filtered Meetings
  const filteredMeetings = allMeetingsList.filter((m) => {
    if (selectedCampaign !== "all" && m.campaign !== selectedCampaign) return false;

    const meetingDateStr = m.meetingDate;
    if (meetingsDatePreset !== "all_time") {
      if (!meetingDateStr) return false;
      const cleanDate = meetingDateStr.split("T")[0];

      if (meetingsDatePreset === "specific_date") {
        if (cleanDate !== meetingsSingleDate) return false;
      } else if (meetingsDatePreset === "custom_range") {
        if (meetingsStartDate && cleanDate < meetingsStartDate) return false;
        if (meetingsEndDate && cleanDate > meetingsEndDate) return false;
      } else if (meetingsDatePreset === "today") {
        if (cleanDate !== todayStr) return false;
      } else if (meetingsDatePreset === "tomorrow") {
        const tomObj = new Date(today);
        tomObj.setDate(tomObj.getDate() + 1);
        const tomStr = tomObj.toISOString().split("T")[0];
        if (cleanDate !== tomStr) return false;
      } else if (meetingsDatePreset === "upcoming_7_days") {
        const d7AheadObj = new Date(today);
        d7AheadObj.setDate(d7AheadObj.getDate() + 7);
        const d7AheadStr = d7AheadObj.toISOString().split("T")[0];
        if (cleanDate < todayStr || cleanDate > d7AheadStr) return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (m.fullName || "").toLowerCase().includes(q) ||
        (m.phone || "").includes(q) ||
        (m.email || "").toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    return true;
  });

  // Filtered Pipeline Leads
  const filteredPipelineLeads = allLeadsList.filter((lead) => {
    if (selectedCampaign !== "all" && lead.campaign !== selectedCampaign) return false;

    let targetDateStr: string | undefined = undefined;
    if (pipelineTargetField === "meeting") {
      targetDateStr = lead.meeting?.meetingDate || lead.createdDate;
    } else if (pipelineTargetField === "created") {
      targetDateStr = lead.createdDate;
    } else if (pipelineTargetField === "followup") {
      targetDateStr = lead.followUpDate;
    }

    if (pipelineDatePreset !== "all_time") {
      if (!targetDateStr) return false;
      const cleanTargetDate = targetDateStr.split("T")[0];

      if (pipelineDatePreset === "specific_date") {
        if (cleanTargetDate !== pipelineSingleDate) return false;
      } else if (pipelineDatePreset === "custom_range") {
        if (pipelineStartDate && cleanTargetDate < pipelineStartDate) return false;
        if (pipelineEndDate && cleanTargetDate > pipelineEndDate) return false;
      } else if (pipelineDatePreset === "today") {
        if (cleanTargetDate !== todayStr) return false;
      } else if (pipelineDatePreset === "yesterday") {
        const yestObj = new Date(today);
        yestObj.setDate(yestObj.getDate() - 1);
        const yestStr = yestObj.toISOString().split("T")[0];
        if (cleanTargetDate !== yestStr) return false;
      } else if (pipelineDatePreset === "last_7_days") {
        const d7AgoObj = new Date(today);
        d7AgoObj.setDate(d7AgoObj.getDate() - 7);
        const d7AgoStr = d7AgoObj.toISOString().split("T")[0];
        if (cleanTargetDate < d7AgoStr || cleanTargetDate > todayStr) return false;
      } else if (pipelineDatePreset === "upcoming_7_days") {
        const d7AheadObj = new Date(today);
        d7AheadObj.setDate(d7AheadObj.getDate() + 7);
        const d7AheadStr = d7AheadObj.toISOString().split("T")[0];
        if (cleanTargetDate < todayStr || cleanTargetDate > d7AheadStr) return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (lead.fullName || "").toLowerCase().includes(q);
      const emailMatch = (lead.email || "").toLowerCase().includes(q);
      const phoneMatch = (lead.phone || "").includes(q);
      if (!nameMatch && !emailMatch && !phoneMatch) return false;
    }

    return true;
  });

  // Filtered Onboarded List
  const filteredOnboardedList = allOnboardedList.filter((ob) => {
    if (selectedCampaign !== "all" && ob.campaign !== selectedCampaign) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (ob.fullName || "").toLowerCase().includes(q) ||
        (ob.phone || "").includes(q) ||
        (ob.email || "").toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    return true;
  });

  // Calculate Metrics
  const totalLeadsCount = filteredLeads.length;
  const partialLeadsCount = filteredLeads.filter((l) => l.status === "partial").length;
  const surveyCompletedCount = filteredLeads.filter(
    (l) => l.status === "survey_completed" || l.status === "completed" || (l.survey && Object.keys(l.survey).length > 0)
  ).length;
  const bookedMeetingsCount = filteredLeads.filter(
    (l) => l.status === "completed" || !!l.meeting?.meetingDate
  ).length;
  const todayMeetingsScheduled = filteredMeetings.length;

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

  // Build Calendar Matrix
  const daysInCalMonth = new Date(calYear, calMonthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonthIndex, 1).getDay();
  const prevMonthLastDay = new Date(calYear, calMonthIndex, 0).getDate();

  const calGridCells: Array<{
    dayNum: number;
    monthOffset: -1 | 0 | 1;
    dateStr: string;
    isToday: boolean;
  }> = [];

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

  const meetingsByDateMap: Record<string, any[]> = {};
  allMeetingsList.forEach((m) => {
    if (m.meetingDate) {
      if (!meetingsByDateMap[m.meetingDate]) {
        meetingsByDateMap[m.meetingDate] = [];
      }
      meetingsByDateMap[m.meetingDate].push(m);
    }
  });

  if (authLoading) {
    return (
      <div className="w-full min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-indigo-600 font-bold text-sm">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
          <span>Authenticating Admin Credentials...</span>
        </div>
      </div>
    );
  }

  // ACCESS DENIED SCREEN FOR NON-ADMIN USERS
  if (accessDenied) {
    return (
      <div className="w-full min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 border border-rose-200 rounded-2xl flex items-center justify-center text-2xl text-rose-600 mx-auto shadow-2xs">
            <i className="fa-solid fa-lock"></i>
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Access Denied: Admin Required
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
              Only users with the <strong className="text-indigo-600">Admin Role</strong> or Master Admin ID (<code className="font-mono bg-slate-100 px-1 rounded">{MASTER_ADMIN_UID}</code>) have permission to manage CRM pages.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left text-xs space-y-1 font-mono">
            <p className="text-slate-400">Your Email: <span className="text-slate-800 font-bold">{currentUser?.email}</span></p>
            <p className="text-slate-400">Assigned Role: <span className="text-rose-600 font-bold">{currentUserData?.roleName || "Standard Staff"}</span></p>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <button
              onClick={() => router.push("/management")}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5"
            >
              <i className="fa-solid fa-users-gear text-xs"></i>
              <span>Go to Team Workspace</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 rounded-xl transition-all border border-slate-200"
            >
              <span>Logout</span>
            </button>
          </div>
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

          {/* Navigation Items (Syncs Route Query ?tab=...) */}
          <nav className="space-y-1">
            <button
              onClick={() => {
                changeTab("pipeline");
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                activeTab === "pipeline"
                  ? "bg-indigo-50 text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <i className="fa-solid fa-[#4F46E5] fa-columns text-sm text-indigo-600"></i>
              <span>Pipeline Stage Board</span>
            </button>

            <button
              onClick={() => {
                changeTab("onboarded");
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                activeTab === "onboarded"
                  ? "bg-emerald-50 text-emerald-700 shadow-sm font-extrabold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <i className="fa-solid fa-award text-sm text-emerald-600"></i>
              <div className="flex items-center justify-between w-full">
                <span>Onboarded Clients</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                  {allOnboardedList.length}
                </span>
              </div>
            </button>

            <button
              onClick={() => {
                changeTab("roles");
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                activeTab === "roles"
                  ? "bg-indigo-50 text-indigo-700 shadow-sm font-extrabold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <i className="fa-solid fa-user-gear text-sm text-indigo-600"></i>
              <span>Roles & Workflow Flows</span>
            </button>

            <button
              onClick={() => {
                router.push("/crms/whatsapp");
                setIsMobileSidebarOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs"
            >
              <i className="fa-brands fa-whatsapp text-sm text-emerald-600"></i>
              <span>WhatsApp API Manager 💬</span>
            </button>

            <button
              onClick={() => {
                changeTab("leads");
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
                changeTab("meetings");
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
                changeTab("calendar");
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

            <button
              onClick={() => router.push("/management")}
              className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors shadow-2xs mt-2"
            >
              <i className="fa-solid fa-list-check text-sm text-violet-600"></i>
              <span>Team Workspace (/management)</span>
            </button>
          </nav>
        </div>

        {/* User Footer & Logout */}
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <div className="flex items-center space-x-2.5 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
              {currentUser?.email?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="truncate text-left">
              <p className="text-xs font-bold text-slate-900 truncate flex items-center space-x-1">
                <span>{currentUserData?.roleName || "Admin"}</span>
                {(currentUser?.uid === MASTER_ADMIN_UID || currentUser?.email?.toLowerCase().startsWith("firstoption")) && (
                  <span className="text-[9px] bg-indigo-100 text-indigo-800 font-extrabold px-1 rounded">
                    👑 Master
                  </span>
                )}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {currentUser?.email}
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
                  {activeTab === "pipeline"
                    ? "Kanban Pipeline Board"
                    : activeTab === "roles"
                    ? "Roles & Workflow Flow Builder"
                    : activeTab === "onboarded"
                    ? "Onboarded Clients Directory"
                    : activeTab === "calendar"
                    ? "Meetings Calendar"
                    : "Executive CRM"}
                </h1>
                <p className="text-[10px] sm:text-[11px] text-slate-500 hidden sm:block">
                  {activeTab === "pipeline"
                    ? "Drag-and-drop lead stage management with deal value tracking & date filters"
                    : activeTab === "roles"
                    ? "Create custom staff roles & build Workflow Flow templates for team assignments"
                    : activeTab === "onboarded"
                    ? "Onboarded clients directory, assign custom workflow flows & editable deal values"
                    : activeTab === "calendar"
                    ? "Interactive visual calendar dashboard for managing all client appointments"
                    : "Real-time tracking of leads, survey qualifications, and booked strategy meetings"}
                </p>
              </div>
            </div>

            <button
              onClick={fetchData}
              disabled={isDataLoading}
              className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-bold hover:bg-indigo-100 flex items-center justify-center sm:hidden"
            >
              <i className={`fa-solid fa-rotate-right ${isDataLoading ? "fa-spin" : ""}`}></i>
            </button>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
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
          {/* DEDICATED TAB: ROLES & WORKFLOW FLOW TEMPLATES BUILDER */}
          {activeTab === "roles" ? (
            <div className="space-y-5 font-sans">
              {/* Header Info Card */}
              <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-5 shadow-sm space-y-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-lg text-indigo-600 shadow-2xs flex-shrink-0">
                    <i className="fa-solid fa-diagram-project"></i>
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                      Roles, Staff Directory & Workflow Flow Templates
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Create Flow templates (e.g., <code className="font-mono text-indigo-700 bg-indigo-50 px-1 rounded">Team Danger</code>, <code className="font-mono text-indigo-700 bg-indigo-50 px-1 rounded">20 Jan Performance Flow</code>) and assign role tasks for team management.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => router.push("/crms/create-flow")}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all self-start sm:self-auto flex items-center space-x-2 flex-shrink-0"
                >
                  <i className="fa-solid fa-plus text-xs"></i>
                  <span>Open Create Flow Page 🚀</span>
                </button>
              </div>

              {/* Toast Feedback Messages */}
              {roleErrorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs">
                  <div className="flex items-center space-x-2">
                    <i className="fa-solid fa-triangle-exclamation text-rose-600 text-sm"></i>
                    <span>{roleErrorMessage}</span>
                  </div>
                  <button
                    onClick={() => setRoleErrorMessage(null)}
                    className="text-rose-500 hover:text-rose-800 text-xs font-bold"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {roleSuccessMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs">
                  <div className="flex items-center space-x-2">
                    <i className="fa-solid fa-circle-check text-emerald-600 text-sm"></i>
                    <span>{roleSuccessMessage}</span>
                  </div>
                  <button
                    onClick={() => setRoleSuccessMessage(null)}
                    className="text-emerald-600 hover:text-emerald-800 text-xs font-bold"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* 1. AUTH USER MANAGEMENT & STAFF ROLES */}
              <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                      <i className="fa-solid fa-user-shield text-indigo-600"></i>
                      <span>Staff Directory & Assigned Roles ({usersList.length})</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Enter user email address to assign them a role in <code className="font-mono">/users</code> node
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-xl border border-indigo-200">
                    /users
                  </span>
                </div>

                {/* Form to add User Email */}
                <form onSubmit={handleManualRegisterUserByEmail} className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">User Email Address *</label>
                    <input
                      type="email"
                      placeholder="e.g. staff@firstoptionagency.com"
                      value={newRegisterEmail}
                      onChange={(e) => setNewRegisterEmail(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Assign Staff Role</label>
                    <select
                      value={newRegisterRoleId}
                      onChange={(e) => setNewRegisterRoleId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                    >
                      {rolesList
                        .filter((r) => r.id !== "role_admin" && r.name.toLowerCase() !== "admin")
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isRegisteringUser || !newRegisterEmail.trim()}
                      className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-extrabold py-2 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {isRegisteringUser ? (
                        <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                      ) : (
                        <i className="fa-solid fa-user-check text-xs"></i>
                      )}
                      <span>Add User & Assign Role 👤</span>
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3">User Email Address</th>
                        <th className="px-4 py-3">Current Assigned Role</th>
                        <th className="px-4 py-3">Last Updated</th>
                        <th className="px-4 py-3 text-right">Change Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {usersList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                            No registered staff users found in Firebase /users node.
                          </td>
                        </tr>
                      ) : (
                        usersList.map((usr) => {
                          const isMaster = usr.email?.toLowerCase().startsWith("firstoption") || usr.uid === MASTER_ADMIN_UID;

                          return (
                            <tr key={usr.emailId || usr.email} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                                  <span>{usr.email}</span>
                                  {isMaster && (
                                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-indigo-300">
                                      👑 Master Admin
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className={`text-xs font-extrabold px-3 py-1 rounded-xl border ${
                                    usr.roleId === "role_admin" || usr.roleName?.toLowerCase() === "admin"
                                      ? "bg-indigo-100 text-indigo-900 border-indigo-300"
                                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  }`}
                                >
                                  {usr.roleName || "Onboarding Specialist"}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-[11px] font-mono text-slate-400">
                                {usr.updatedAt ? new Date(usr.updatedAt).toLocaleString() : "Initial"}
                              </td>

                              <td className="px-4 py-3 text-right">
                                {isMaster ? (
                                  <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl">
                                    Permanent Admin
                                  </span>
                                ) : (
                                  <select
                                    value={usr.roleId || "role_onboarding"}
                                    onChange={(e) => handleAssignUserRoleByEmail(usr.email, e.target.value)}
                                    className="bg-white border border-slate-300 rounded-xl px-3 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                                  >
                                    {rolesList
                                      .filter((r) => r.id !== "role_admin" && r.name.toLowerCase() !== "admin")
                                      .map((r) => (
                                        <option key={r.id} value={r.id}>
                                          {r.name}
                                        </option>
                                      ))}
                                  </select>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. ROLES MANAGEMENT DIRECTORY */}
              <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                    <i className="fa-solid fa-shield-halved text-emerald-600"></i>
                    <span>Active Firebase Roles ({rolesList.length})</span>
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    Firebase Node: /roles
                  </span>
                </div>

                {/* Form to Create Role */}
                <form onSubmit={handleCreateNewRole} className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Role Name *</label>
                    <input
                      type="text"
                      placeholder="Enter role name (e.g. Designer, Editor...)"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Role Description</label>
                    <input
                      type="text"
                      placeholder="Enter role description..."
                      value={newRoleDescription}
                      onChange={(e) => setNewRoleDescription(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isCreatingRole || !newRoleName.trim()}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold py-2 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {isCreatingRole ? (
                        <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                      ) : (
                        <i className="fa-solid fa-plus text-xs"></i>
                      )}
                      <span>Save Role ➕</span>
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {rolesList.map((role) => {
                    const isAdmin = role.name.toLowerCase() === "admin" || role.id === "role_admin";

                    return (
                      <div
                        key={role.id}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between hover:border-indigo-300 transition-colors shadow-2xs"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-extrabold text-slate-900">
                              {role.name}
                            </h4>

                            {isAdmin && (
                              <span className="text-[9px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300 px-2 py-0.5 rounded-full uppercase">
                                System Admin
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            {role.description || "No description provided."}
                          </p>
                        </div>

                        {!isAdmin && (
                          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>Soft Delete Protected</span>
                            <button
                              onClick={() => handleDeleteRole(role)}
                              className="text-rose-600 hover:text-rose-800 text-xs font-bold bg-white border border-rose-200 px-2.5 py-1 rounded-xl transition-colors inline-flex items-center space-x-1"
                            >
                              <i className="fa-solid fa-trash-can text-[10px]"></i>
                              <span>Delete Role</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : activeTab === "onboarded" ? (
            <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-sm p-4 sm:p-6 space-y-5 font-sans">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base sm:text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                    <i className="fa-solid fa-award text-emerald-600"></i>
                    <span>Onboarded Clients Directory</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Assign custom Workflow Flows (<code className="font-mono text-indigo-700 bg-indigo-50 px-1 rounded">Team Danger</code>, <code className="font-mono text-indigo-700 bg-indigo-50 px-1 rounded">20 Jan Performance Flow</code>) & manage deal values
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    placeholder="Search onboarded name, phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none w-48 sm:w-64"
                  />
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-xl border border-emerald-300">
                    {filteredOnboardedList.length} Total Onboards
                  </span>
                </div>
              </div>

              {/* Onboarded List Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Client Info</th>
                      <th className="px-4 py-3">Onboarded Date & Time</th>
                      <th className="px-4 py-3">Assigned Workflow Flows</th>
                      <th className="px-4 py-3">Editable Deal Value (₹)</th>
                      <th className="px-4 py-3">Campaign & Staff</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredOnboardedList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                          No onboarded client records found.
                        </td>
                      </tr>
                    ) : (
                      filteredOnboardedList.map((obRecord) => {
                        const clientFlows = clientFlowInstancesList.filter((cf) => cf.clientOnboardId === obRecord.id || cf.clientEmail === obRecord.email);

                        return (
                          <tr key={obRecord.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-extrabold text-slate-900 text-sm">
                                {obRecord.fullName || "Anonymous Client"}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">{obRecord.email}</div>
                              <div className="text-[11px] font-bold text-slate-600 font-mono pt-0.5">
                                📞 {obRecord.countryCode} {obRecord.phone}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="space-y-0.5">
                                <span className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200 text-[11px] block w-fit">
                                  📅 {obRecord.onboardedDate}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  {new Date(obRecord.onboardedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-3 space-y-1.5">
                              {clientFlows.length === 0 ? (
                                <button
                                  onClick={() => handleOpenAssignFlowModal(obRecord)}
                                  className="text-[10px] font-extrabold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-1 rounded-xl transition-all inline-flex items-center space-x-1 shadow-2xs"
                                >
                                  <i className="fa-solid fa-triangle-exclamation text-amber-600"></i>
                                  <span>⚠️ No Flow Assigned — Click to Assign 🚀</span>
                                </button>
                              ) : (
                                clientFlows.map((cf) => {
                                  const doneCount = cf.tasks.filter((t) => t.isCompleted).length;
                                  const isDone = cf.status === "completed";

                                  return (
                                    <div key={cf.id} className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-[10px] space-y-1 shadow-2xs">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-extrabold text-indigo-700 truncate max-w-[120px]">
                                          🚀 {cf.flowName}
                                        </span>

                                        <div className="flex items-center space-x-1">
                                          {isDone ? (
                                            <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                                              ✓ Done
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => handleMarkClientFlowCompleted(cf.id)}
                                              className="text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-1.5 py-0.2 rounded transition-colors"
                                            >
                                              Mark Complete
                                            </button>
                                          )}

                                          <button
                                            onClick={() => setDeleteClientFlowModal(cf)}
                                            className="text-rose-600 hover:text-rose-800 hover:bg-rose-100 p-0.5 rounded transition-colors font-bold"
                                            title="Delete assigned flow to re-assign updated template"
                                          >
                                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                                          </button>
                                        </div>
                                      </div>

                                      <div className="text-slate-500 flex items-center justify-between font-mono">
                                        <span>Progress: {doneCount}/{cf.tasks.length} tasks</span>
                                        <button
                                          onClick={() => router.push(`/crms/view-flow?id=${cf.id}`)}
                                          className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 transition-colors shadow-2xs"
                                        >
                                          🚀 Open Flow Canvas Page
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}

                              {clientFlows.length > 0 && (
                                <button
                                  onClick={() => handleOpenAssignFlowModal(obRecord)}
                                  className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg transition-colors inline-flex items-center space-x-1"
                                >
                                  <i className="fa-solid fa-plus text-[9px]"></i>
                                  <span>Assign Additional Flow</span>
                                </button>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-1">
                                <span className="font-bold text-emerald-700 text-xs">₹</span>
                                <input
                                  type="number"
                                  defaultValue={obRecord.dealValue || 0}
                                  onBlur={(e) => {
                                    const newVal = parseFloat(e.target.value) || 0;
                                    if (newVal !== obRecord.dealValue) {
                                      handleUpdateOnboardRecordDealValue(obRecord, newVal);
                                    }
                                  }}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  className="w-28 bg-emerald-50/60 border border-emerald-300 rounded-lg px-2 py-1 text-xs font-mono font-extrabold text-emerald-900 focus:outline-none focus:bg-white focus:border-indigo-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  title="Click to edit deal value"
                                />
                              </div>
                            </td>

                            <td className="px-4 py-3 space-y-1">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold block w-fit">
                                {obRecord.campaign || "firstoptionagency"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold block">
                                By: {obRecord.onboardedBy || "Staff"}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right space-y-1">
                              <button
                                onClick={() => handleOpenDeleteOnboardModal(obRecord)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors inline-flex items-center space-x-1.5 shadow-2xs"
                              >
                                <i className="fa-solid fa-trash-can text-xs"></i>
                                <span>Delete 🗑️</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === "pipeline" ? (
            <div className="space-y-4 font-sans">
              {/* Pipeline Top Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Lead Pipeline Stage Board
                    </h3>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      {filteredPipelineLeads.length} leads matching filter
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 flex-wrap gap-2">
                    <select
                      value={pipelineTargetField}
                      onChange={(e) => setPipelineTargetField(e.target.value as "meeting" | "created" | "followup")}
                      className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-indigo-700 focus:outline-none"
                    >
                      <option value="created">📝 Created Wise</option>
                      <option value="meeting">📅 Meeting Wise</option>
                      <option value="followup">📌 Follow-up Wise</option>
                    </select>

                    <select
                      value={pipelineDatePreset}
                      onChange={(e) => setPipelineDatePreset(e.target.value as any)}
                      className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="specific_date">🎯 Specific Day (Default)</option>
                      <option value="today">☀️ Today</option>
                      <option value="yesterday">⏪ Yesterday</option>
                      <option value="last_7_days">⚡ Last 7 Days</option>
                      <option value="upcoming_7_days">🔮 Upcoming 7 Days</option>
                      <option value="custom_range">📆 Custom Date Range</option>
                      <option value="all_time">🌐 All Time (Entire Pipeline)</option>
                    </select>

                    {pipelineDatePreset === "specific_date" && (
                      <input
                        type="date"
                        value={pipelineSingleDate}
                        onChange={(e) => setPipelineSingleDate(e.target.value)}
                        className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    )}

                    {pipelineDatePreset === "custom_range" && (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] text-slate-500 font-bold">Start:</span>
                        <input
                          type="date"
                          value={pipelineStartDate}
                          onChange={(e) => setPipelineStartDate(e.target.value)}
                          className="bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500 font-bold">End:</span>
                        <input
                          type="date"
                          value={pipelineEndDate}
                          onChange={(e) => setPipelineEndDate(e.target.value)}
                          className="bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none"
                        />
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="Search name, phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-36 sm:w-44"
                    />

                    <button
                      onClick={() => setIsManagePipelineModalOpen(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-gear"></i>
                      <span>Manage Stages ⚙️</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 overflow-x-auto pt-1">
                  <button
                    onClick={() => changeTab("leads")}
                    className="px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    All Leads List
                  </button>
                  <button
                    onClick={() => changeTab("pipeline")}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-2xs"
                  >
                    Pipeline Board
                  </button>
                  <button
                    onClick={() => changeTab("onboarded")}
                    className="px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors text-emerald-700 font-extrabold"
                  >
                    Onboarded Directory ({allOnboardedList.length})
                  </button>
                  <button
                    onClick={() => changeTab("roles")}
                    className="px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors text-indigo-700 font-extrabold"
                  >
                    Roles & Flows ({flowTemplatesList.length})
                  </button>
                  <button
                    onClick={() => changeTab("meetings")}
                    className="px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    Scheduled Meetings
                  </button>
                  <button
                    onClick={() => changeTab("calendar")}
                    className="px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    Meetings Calendar
                  </button>
                </div>
              </div>

              {/* DRAG-AND-DROP KANBAN PIPELINE COLUMNS */}
              <div className="flex items-start space-x-3.5 overflow-x-auto pb-6 pt-1 min-h-[620px] scrollbar-thin">
                {activePipelineStages.map((stage) => {
                  const stageLeads = filteredPipelineLeads.filter((l) => getLeadEffectiveStage(l) === stage.id);
                  const totalStageValue = stageLeads.reduce((acc, l) => acc + (l.dealValue || 0), 0);

                  return (
                    <div
                      key={stage.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const leadDataStr = e.dataTransfer.getData("text/plain");
                        if (leadDataStr) {
                          try {
                            const draggedLead: LeadData = JSON.parse(leadDataStr);
                            handleUpdateStage(draggedLead, stage.id);
                          } catch (err) {
                            console.error("Drop parse error:", err);
                          }
                        }
                      }}
                      className="w-72 sm:w-80 flex-shrink-0 bg-[#f8fafc] border border-slate-200/90 rounded-2xl p-3 flex flex-col space-y-3 shadow-2xs min-h-[580px]"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 px-1">
                        <div className="flex items-center space-x-2 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                          <h4 className="text-xs font-extrabold text-slate-900 truncate">
                            {stage.name}
                          </h4>
                          <span className="text-[11px] font-bold text-slate-400 font-mono">
                            ({stageLeads.length})
                          </span>
                        </div>

                        <span className="text-[11px] font-mono font-extrabold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          ₹{totalStageValue.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[720px] pr-0.5">
                        {stageLeads.length === 0 ? (
                          <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xs">
                            No leads
                          </div>
                        ) : (
                          stageLeads.map((lead) => {
                            const leadIdKey = lead.id || (lead.email ? sanitizeEmailToId(lead.email) : "l_" + Math.random());

                            return (
                              <div
                                key={leadIdKey}
                                draggable={true}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("text/plain", JSON.stringify(lead));
                                }}
                                onClick={() => handleOpenDrawer(lead)}
                                className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group hover:border-indigo-300"
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="truncate">
                                    <h5 className="text-xs font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                      {lead.fullName || "Anonymous Lead"}
                                    </h5>
                                    <p className="text-[10px] text-slate-400 truncate">{lead.email}</p>
                                  </div>

                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${stage.bgTag}`}>
                                    {stage.name}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[11px] font-mono pt-0.5">
                                  <span className="text-slate-600 font-semibold">
                                    📞 {lead.countryCode} {lead.phone}
                                  </span>

                                  <a
                                    href={`https://api.whatsapp.com/send?phone=${lead.countryCode ? lead.countryCode.replace("+", "") : "91"}${lead.phone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-emerald-600 hover:text-emerald-700 font-bold text-xs"
                                  >
                                    <i className="fa-brands fa-whatsapp text-sm"></i>
                                  </a>
                                </div>

                                <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                  <span>📅 {lead.meeting?.meetingDate || lead.createdDate || "N/A"}</span>
                                  {lead.meeting?.meetingTime && (
                                    <span className="font-bold text-indigo-600">🕒 {lead.meeting.meetingTime}</span>
                                  )}
                                </div>

                                {(lead.followUpDate || (lead.notes && lead.notes.length > 0) || lead.dealValue || lead.onboarded) && (
                                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 pt-0.5">
                                    {lead.onboarded ? (
                                      <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                                        ✓ Onboarded Done {lead.onboardCount && lead.onboardCount > 1 ? `(${lead.onboardCount}x)` : ""}
                                      </span>
                                    ) : null}

                                    {lead.dealValue ? (
                                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                        ₹{lead.dealValue.toLocaleString("en-IN")}
                                      </span>
                                    ) : null}

                                    {lead.followUpDate && (
                                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                        Follow: {lead.followUpDate}
                                      </span>
                                    )}

                                    {lead.notes && lead.notes.length > 0 && (
                                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                        📝 {lead.notes.length}
                                      </span>
                                    )}
                                  </div>
                                )}

                                <div className="pt-2 border-t border-slate-100 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                                  {lead.onboarded ? (
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                                        ✓ Onboarded Done
                                      </span>

                                      <button
                                        onClick={() => handleOpenOnboardModal(lead)}
                                        className="font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md transition-colors"
                                      >
                                        + Re-onboard
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleOpenOnboardModal(lead)}
                                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-extrabold py-1 px-2.5 rounded-lg shadow-2xs transition-all flex items-center justify-center space-x-1"
                                    >
                                      <i className="fa-solid fa-user-check text-[10px]"></i>
                                      <span>Onboard Client</span>
                                    </button>
                                  )}

                                  <div className="flex items-center justify-between pt-0.5">
                                    <span className="text-[10px] text-slate-400 font-bold">Move Stage:</span>
                                    <select
                                       value={getLeadEffectiveStage(lead)}
                                       onChange={(e) => handleUpdateStage(lead, e.target.value)}
                                       className="bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-800 px-1.5 py-0.5 focus:outline-none focus:border-indigo-600 cursor-pointer"
                                     >
                                       {activePipelineStages.map((st) => (
                                         <option key={st.id} value={st.id}>
                                           {st.name}
                                         </option>
                                       ))}
                                     </select>
                                  </div>
                                </div>
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
          ) : activeTab === "calendar" ? (
            <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-sm p-4 sm:p-6 space-y-4 font-sans">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
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

              {calViewMode === "month" && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-7 border-b border-slate-200 text-center py-2 text-[10px] sm:text-xs font-extrabold text-slate-400 tracking-wider bg-slate-50 rounded-xl">
                    <span>SUN</span>
                    <span>MON</span>
                    <span>TUE</span>
                    <span>WED</span>
                    <span>THU</span>
                    <span>FRI</span>
                    <span>SAT</span>
                  </div>

                  <div className="grid grid-cols-7 border-l border-t border-slate-200 bg-slate-100 rounded-xl overflow-hidden gap-[1px]">
                    {calGridCells.map((cell, idx) => {
                      const dayMeetings = meetingsByDateMap[cell.dateStr] || [];
                      const isCurrentMonth = cell.monthOffset === 0;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (dayMeetings.length > 0) {
                              setDayMeetingsModalData({
                                dateStr: cell.dateStr,
                                meetings: dayMeetings,
                              });
                            }
                          }}
                          className={`bg-white min-h-[95px] sm:min-h-[125px] p-1.5 flex flex-col justify-between transition-colors relative cursor-pointer ${
                            !isCurrentMonth ? "bg-slate-50/60" : "hover:bg-indigo-50/20"
                          }`}
                        >
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

                          <div className="space-y-1 my-auto">
                            {dayMeetings.slice(0, 2).map((m, mIdx) => {
                              const isPast = isMeetingInPast(m.meetingDate, m.meetingTime);
                              const shortTime = formatShortTime(m.meetingTime);

                              return (
                                <div
                                  key={mIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDrawer(m);
                                  }}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-between shadow-2xs border ${
                                    isPast
                                      ? "bg-rose-100 text-rose-800 border-rose-300"
                                      : "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  }`}
                                  title={`${m.fullName} - ${m.meetingTime} (${isPast ? "Time Passed" : "Upcoming"})`}
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
                                  setDayMeetingsModalData({
                                    dateStr: cell.dateStr,
                                    meetings: dayMeetings,
                                  });
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
                  <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Leads matching filter</p>
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
                  <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Upcoming / Filtered</p>
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
                <div className="px-3 py-2.5 sm:px-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-50/50">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => changeTab("leads")}
                      className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-center ${
                        activeTab === "leads"
                          ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Leads ({totalLeadsCount})
                    </button>

                    <button
                      onClick={() => changeTab("meetings")}
                      className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-center ${
                        activeTab === "meetings"
                          ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Meetings ({todayMeetingsScheduled})
                    </button>
                  </div>

                  {activeTab === "leads" && (
                    <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                      <select
                        value={leadsDatePreset}
                        onChange={(e) => setLeadsDatePreset(e.target.value as any)}
                        className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                      >
                        <option value="last_7_days">⚡ Last 7 Days (Default)</option>
                        <option value="today">☀️ Today</option>
                        <option value="yesterday">⏪ Yesterday</option>
                        <option value="specific_date">🎯 Specific Day</option>
                        <option value="custom_range">📆 Custom Date Range</option>
                        <option value="all_time">🌐 All Time</option>
                      </select>

                      {leadsDatePreset === "specific_date" && (
                        <input
                          type="date"
                          value={leadsSingleDate}
                          onChange={(e) => setLeadsSingleDate(e.target.value)}
                          className="bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                        />
                      )}

                      {leadsDatePreset === "custom_range" && (
                        <div className="flex items-center space-x-1 text-[10px] font-bold text-slate-500">
                          <span>Start:</span>
                          <input
                            type="date"
                            value={leadsStartDate}
                            onChange={(e) => setLeadsStartDate(e.target.value)}
                            className="bg-white border border-slate-300 rounded-xl px-1.5 py-1 text-xs font-bold text-slate-900 focus:outline-none"
                          />
                          <span>End:</span>
                          <input
                            type="date"
                            value={leadsEndDate}
                            onChange={(e) => setLeadsEndDate(e.target.value)}
                            className="bg-white border border-slate-300 rounded-xl px-1.5 py-1 text-xs font-bold text-slate-900 focus:outline-none"
                          />
                        </div>
                      )}

                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-800 font-semibold focus:outline-none"
                      >
                        <option value="all">All Status</option>
                        <option value="partial">Partial</option>
                        <option value="survey_completed">Survey</option>
                        <option value="completed">Booked</option>
                      </select>

                      <input
                        type="text"
                        placeholder="Search name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-white border border-slate-300 rounded-xl px-3 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 flex-1 sm:w-44"
                      />
                    </div>
                  )}

                  {activeTab === "meetings" && (
                    <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                      <select
                        value={meetingsDatePreset}
                        onChange={(e) => setMeetingsDatePreset(e.target.value as any)}
                        className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                      >
                        <option value="upcoming_7_days">🔮 Upcoming 7 Days (Default)</option>
                        <option value="today">☀️ Today</option>
                        <option value="tomorrow">⏩ Tomorrow</option>
                        <option value="specific_date">🎯 Specific Day</option>
                        <option value="custom_range">📆 Custom Date Range</option>
                        <option value="all_time">🌐 All Time</option>
                      </select>

                      {meetingsDatePreset === "specific_date" && (
                        <input
                          type="date"
                          value={meetingsSingleDate}
                          onChange={(e) => setMeetingsSingleDate(e.target.value)}
                          className="bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                        />
                      )}

                      {meetingsDatePreset === "custom_range" && (
                        <div className="flex items-center space-x-1 text-[10px] font-bold text-slate-500">
                          <span>Start:</span>
                          <input
                            type="date"
                            value={meetingsStartDate}
                            onChange={(e) => setMeetingsStartDate(e.target.value)}
                            className="bg-white border border-slate-300 rounded-xl px-1.5 py-1 text-xs font-bold text-slate-900 focus:outline-none"
                          />
                          <span>End:</span>
                          <input
                            type="date"
                            value={meetingsEndDate}
                            onChange={(e) => setMeetingsEndDate(e.target.value)}
                            className="bg-white border border-slate-300 rounded-xl px-1.5 py-1 text-xs font-bold text-slate-900 focus:outline-none"
                          />
                        </div>
                      )}

                      <input
                        type="text"
                        placeholder="Search name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-white border border-slate-300 rounded-xl px-3 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 flex-1 sm:w-44"
                      />
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
                          No leads found matching selected date filter
                        </p>
                      </div>
                    ) : (
                      <>
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

                                  <div className="flex flex-col items-end space-y-1">
                                    {lead.onboarded && (
                                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-[9px] px-2 py-0.5 rounded-full">
                                        ✓ Onboarded Done
                                      </span>
                                    )}

                                    <span
                                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
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
                                        {lead.onboarded && (
                                          <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold px-1.5 py-0.5 rounded">
                                            ✓ Onboarded Done
                                          </span>
                                        )}
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
                    {filteredMeetings.length === 0 ? (
                      <div className="p-8 text-center space-y-2">
                        <i className="fa-solid fa-calendar-xmark text-3xl text-slate-300"></i>
                        <p className="text-xs text-slate-500 font-bold">
                          No scheduled meetings found matching selected date filter
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="block md:hidden divide-y divide-slate-100">
                          {filteredMeetings.map((m, idx) => (
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
                              {filteredMeetings.map((m, idx) => (
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
                                            <span className="text-slate-400 capitalize font-medium">{key}:</span>{" "}
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

      {/* ASSIGN FLOW TO CLIENT MODAL */}
      {assignFlowModalClient && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setAssignFlowModalClient(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 border border-slate-200 z-10 font-sans animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-indigo-700">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-lg font-black shadow-2xs">
                🚀
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Assign Workflow Flow to Client
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {assignFlowModalClient.fullName} ({assignFlowModalClient.email})
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Select Flow Template *</label>
                <select
                  value={selectedFlowTemplateId}
                  onChange={(e) => setSelectedFlowTemplateId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  {flowTemplatesList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.tasks.length} Steps)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Custom Flow Instance Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 20 Jan Performance Shoot & Ads"
                  value={customAssignedFlowName}
                  onChange={(e) => setCustomAssignedFlowName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                />
                <p className="text-[10px] text-slate-400">
                  You can assign multiple flows over time with custom shoot/campaign names.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setAssignFlowModalClient(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isAssigningFlow || !selectedFlowTemplateId}
                onClick={handleConfirmAssignFlowToClient}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isAssigningFlow ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                ) : (
                  <i className="fa-solid fa-plus text-xs"></i>
                )}
                <span>Assign Flow Now 🚀</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARD CONFIRMATION MODAL POPUP */}
      {onboardConfirmModalLead && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setOnboardConfirmModalLead(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 border border-slate-200 z-10 font-sans animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-emerald-700">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-lg font-black shadow-2xs">
                🚀
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Onboard Client Confirmation
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {onboardConfirmModalLead.fullName || "Client"}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <p className="text-slate-800 font-bold">
                Are you sure you want to onboard <span className="text-indigo-600 font-extrabold">{onboardConfirmModalLead.fullName}</span>?
              </p>
              <div className="flex items-center justify-between text-slate-600 font-mono pt-1 border-t border-slate-200">
                <span>Deal Value:</span>
                <span className="font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                  ₹{(onboardConfirmModalLead.dealValue || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {onboardConfirmModalLead.onboarded && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-2 text-xs">
                <p className="font-extrabold text-amber-900 flex items-center space-x-1">
                  <i className="fa-solid fa-triangle-exclamation text-amber-600"></i>
                  <span>Client is already onboarded ({onboardConfirmModalLead.onboardCount || 1}x)</span>
                </p>

                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="onboardMode"
                      value="append"
                      checked={onboardMode === "append"}
                      onChange={() => setOnboardMode("append")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-slate-800">
                      Create Additional Onboard Snapshot (2nd Contract / Package)
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="onboardMode"
                      value="replace"
                      checked={onboardMode === "replace"}
                      onChange={() => setOnboardMode("replace")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-slate-800">
                      Replace / Update Existing Onboard Snapshot
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setOnboardConfirmModalLead(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isOnboarding}
                onClick={handleConfirmExecuteOnboard}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isOnboarding ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                ) : (
                  <i className="fa-solid fa-check text-xs"></i>
                )}
                <span>Confirm & Onboard Now 🚀</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROFESSIONAL DELETE ONBOARD CONFIRMATION MODAL */}
      {deleteOnboardModalRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setDeleteOnboardModalRecord(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 border border-rose-200 z-10 font-sans animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-lg font-black shadow-2xs">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Delete Onboard Snapshot
                </h3>
                <p className="text-xs text-rose-600 font-bold">
                  Permanent Data Removal Warning
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <p className="text-rose-900 font-semibold leading-relaxed">
                This action will permanently delete the onboarding record snapshot for{" "}
                <strong className="text-slate-900 font-extrabold underline">{deleteOnboardModalRecord.fullName}</strong>{" "}
                (₹{deleteOnboardModalRecord.dealValue?.toLocaleString("en-IN")}) from the <code className="font-mono bg-rose-100 px-1 rounded">/onboards</code> database.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                To confirm deletion, type <strong className="text-rose-700 font-mono tracking-wider">CONFIRM</strong> in the box below:
              </label>
              <input
                type="text"
                placeholder="Type CONFIRM here..."
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteOnboardModalRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleteConfirmInput.trim() !== "CONFIRM" || isDeletingOnboard}
                onClick={handleConfirmDeleteOnboard}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                {isDeletingOnboard ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                ) : (
                  <i className="fa-solid fa-trash-can text-xs"></i>
                )}
                <span>Delete Snapshot 🗑️</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DAY MEETINGS LIST MODAL POPUP */}
      {dayMeetingsModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="fixed inset-0"
            onClick={() => setDayMeetingsModalData(null)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden font-sans border border-slate-200 z-10 animate-in fade-in zoom-in duration-150">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <i className="fa-solid fa-calendar-day text-indigo-600"></i>
                  <span>Appointments for {dayMeetingsModalData.dateStr}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {dayMeetingsModalData.meetings.length} strategy call appointment{dayMeetingsModalData.meetings.length > 1 ? "s" : ""}
                </p>
              </div>

              <button
                onClick={() => setDayMeetingsModalData(null)}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {dayMeetingsModalData.meetings.map((m, idx) => {
                const isPast = isMeetingInPast(m.meetingDate, m.meetingTime);

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setDayMeetingsModalData(null);
                      handleOpenDrawer(m);
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${
                      isPast
                        ? "bg-rose-50/50 border-rose-200 hover:border-rose-300"
                        : "bg-emerald-50/50 border-emerald-200 hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-xs font-mono font-extrabold px-2.5 py-1 rounded-lg border ${
                            isPast
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          }`}
                        >
                          🕒 {m.meetingTime}
                        </span>

                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                            isPast
                              ? "bg-rose-100 text-rose-700 border-rose-200"
                              : "bg-emerald-100 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {isPast ? "🔴 Time Passed" : "🟢 Upcoming"}
                        </span>
                      </div>

                      <span className="text-[11px] font-bold text-indigo-600 hover:underline">
                        View Profile ➔
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900">
                          {m.fullName || "Anonymous Client"}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-mono">{m.email}</p>
                      </div>

                      <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`tel:${m.countryCode || "+91"}${m.phone}`}
                          className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 flex items-center justify-center text-xs transition-colors"
                          title="Call Client"
                        >
                          <i className="fa-solid fa-phone text-indigo-600"></i>
                        </a>

                        <a
                          href={`https://api.whatsapp.com/send?phone=${
                            m.countryCode ? m.countryCode.replace("+", "") : "91"
                          }${m.phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center text-xs transition-colors shadow-2xs"
                          title="WhatsApp"
                        >
                          <i className="fa-brands fa-whatsapp text-sm"></i>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* FULLY RESPONSIVE SLIDE-OVER DRAWER */}
      {isDrawerOpen && selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div
            className="absolute inset-0 hidden sm:block"
            onClick={handleCloseDrawer}
          />

          <div className="relative w-full sm:max-w-lg bg-white h-full shadow-2xl flex flex-col font-sans border-l border-slate-200 z-10 overflow-hidden">
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

            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 sm:space-y-5">
              {/* ONBOARD CLIENT CARD & BUTTON IN DRAWER */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-3.5 sm:p-4 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                      🚀
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">
                        Client Onboarding Status
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Pushes an immutable snapshot into <code className="font-mono text-emerald-700">/onboards</code> node
                      </p>
                    </div>
                  </div>

                  {selectedLead.onboarded && (
                    <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                      ✓ Onboarded Done ({selectedLead.onboardCount || 1}x)
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleOpenOnboardModal(selectedLead)}
                  disabled={isOnboarding}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold py-2 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isOnboarding ? (
                    <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                  ) : (
                    <i className="fa-solid fa-user-check text-xs"></i>
                  )}
                  <span>{selectedLead.onboarded ? "Re-Onboard Client (+ Snapshot)" : "Onboard Client (+ Save Snapshot)"}</span>
                </button>
              </div>

              {/* Pipeline Stage Selector & Deal Value (₹) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Pipeline Stage
                  </span>
                  <select
                    value={getLeadEffectiveStage(selectedLead)}
                    onChange={(e) => handleUpdateStage(selectedLead, e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 font-bold text-xs text-indigo-600 focus:outline-none cursor-pointer"
                  >
                    {activePipelineStages.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">Deal Value (₹):</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      placeholder="e.g. 50000"
                      value={dealValueInput}
                      onChange={(e) => setDealValueInput(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-28 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {dealValueInput !== (selectedLead.dealValue ? selectedLead.dealValue.toString() : "") && (
                      <button
                        type="button"
                        disabled={isSavingStaffData}
                        onClick={() => handleSaveDealValue(dealValueInput)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1 rounded-xl transition-colors disabled:opacity-50"
                      >
                        Save ₹
                      </button>
                    )}
                  </div>
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

                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    rows={3}
                    placeholder="Type notes after speaking with client..."
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

      {/* DELETE ASSIGNED CLIENT FLOW CONFIRMATION MODAL */}
      {deleteClientFlowModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setDeleteClientFlowModal(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 border border-rose-200 z-10 font-sans animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-lg font-black shadow-2xs">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Remove Assigned Flow
                </h3>
                <p className="text-xs text-rose-600 font-bold">
                  {deleteClientFlowModal.flowName}
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <p className="text-rose-900 font-semibold leading-relaxed">
                Are you sure you want to remove assigned workflow flow <strong className="text-slate-900 font-extrabold underline">{deleteClientFlowModal.flowName}</strong> from client <strong className="text-slate-900 font-extrabold">{deleteClientFlowModal.clientName}</strong>?
              </p>
              <p className="text-rose-800 font-medium text-[11px]">
                Deleting this instance will clear current task progress for this flow. You can re-assign an updated flow template to this client anytime!
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteClientFlowModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingClientFlow}
                onClick={handleConfirmDeleteClientFlow}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isDeletingClientFlow ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                ) : (
                  <i className="fa-solid fa-trash-can text-xs"></i>
                )}
                <span>Confirm & Remove Flow 🗑️</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN LIVE FLOW AUDIT MODAL (Canvas Table Matrix Format) */}
      {viewFlowAuditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 font-sans">
          <div className="fixed inset-0" onClick={() => setViewFlowAuditModal(null)} />
          <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 z-10 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                  👁️
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                    Live Flow Progress & Staff Audit Matrix
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Client: <strong className="text-slate-900">{viewFlowAuditModal.clientName}</strong> ({viewFlowAuditModal.clientEmail}) | Flow: <strong className="text-indigo-600">{viewFlowAuditModal.flowName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl border border-indigo-200">
                  {viewFlowAuditModal.campaign}
                </span>

                <button
                  onClick={() => setViewFlowAuditModal(null)}
                  className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center transition-colors"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <i className="fa-solid fa-table-cells text-indigo-600"></i>
                  <span>Staff Work Audit Matrix Table</span>
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  {viewFlowAuditModal.tasks.filter((t) => t.isCompleted).length} / {viewFlowAuditModal.tasks.length} Steps Completed
                </span>
              </div>

              {/* ROLE COLUMNS CANVAS FOR ADMIN (ZERO BLANK/EMPTY SPACE) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                {rolesList.map((role) => {
                  const roleTasks = viewFlowAuditModal.tasks.filter(
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
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5 flex flex-col justify-between"
                    >
                      <div className="border-b border-slate-200/80 pb-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-extrabold text-slate-900">
                            {role.name}
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

                      <div className="space-y-3">
                        {roleTasks.length === 0 ? (
                          <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs italic">
                            No tasks assigned to {role.name}.
                          </div>
                        ) : (
                          roleTasks.map((task) => {
                            const isTaskDone = task.isCompleted || viewFlowAuditModal.status === "completed";
                            const originalStepIdx = viewFlowAuditModal.tasks.findIndex((t) => t.id === task.id) + 1;

                            return (
                              <div
                                key={task.id}
                                className={`bg-white border rounded-xl p-3 space-y-2.5 shadow-2xs ${
                                  isTaskDone ? "border-emerald-200 bg-emerald-50/10" : "border-slate-200"
                                }`}
                              >
                                <div className="flex items-start space-x-2">
                                  <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-extrabold flex items-center justify-center text-[10px] shadow-2xs flex-shrink-0 mt-0.5">
                                    #{originalStepIdx}
                                  </span>
                                  <h4 className="text-xs font-extrabold text-slate-900 leading-snug">
                                    {task.title}
                                  </h4>
                                </div>

                                <div className="flex items-center space-x-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
                                  <input
                                    type="checkbox"
                                    checked={isTaskDone}
                                    onChange={() =>
                                      handleMarkClientFlowCompleted(viewFlowAuditModal.id)
                                    }
                                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                                  />
                                  <span className={`text-xs font-bold ${isTaskDone ? "text-emerald-800 line-through" : "text-slate-800"}`}>
                                    {isTaskDone ? "Completed Step" : "Pending Check"}
                                  </span>
                                </div>

                                {task.textValue && (
                                  <div className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-mono font-bold break-all">
                                    {task.textValue}
                                  </div>
                                )}

                                {task.completedAt ? (
                                  <div className="text-[10px] font-mono text-emerald-800 bg-emerald-100/90 border border-emerald-300 p-1.5 rounded-lg font-extrabold flex items-center justify-between">
                                    <span>✓ {new Date(task.completedAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                                    <span className="truncate max-w-[90px]">{task.completedBy?.split("@")[0]}</span>
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 p-1 rounded-lg font-bold text-center">
                                    ⏳ Pending
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

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between sticky bottom-0">
              <span className="text-xs text-slate-500 font-mono">
                Assigned by: {viewFlowAuditModal.assignedBy} on {new Date(viewFlowAuditModal.assignedAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => setViewFlowAuditModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE PIPELINE STAGES & RECYCLE BIN MODAL */}
      {isManagePipelineModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setIsManagePipelineModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 border border-slate-200 z-10 font-sans animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
                  <span>Manage Pipeline Stages ⚙️</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  <strong className="text-indigo-600 font-extrabold">Leads</strong> and <strong className="text-emerald-600 font-extrabold">Won</strong> are compulsory core stages that cannot be deleted or renamed. Create new stages, rename intermediate headers, or restore deleted stages from the Recycle Bin.
                </p>
              </div>

              <button
                onClick={() => setIsManagePipelineModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs: Active Stages vs Recycle Bin */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setManagePipelineTab("active")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    managePipelineTab === "active"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Active Pipeline Stages ({activePipelineStages.length})
                </button>

                <button
                  onClick={() => setManagePipelineTab("bin")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    managePipelineTab === "bin"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <i className="fa-solid fa-trash-can text-xs"></i>
                  <span>Recycle Bin ({deletedPipelineStages.length})</span>
                </button>
              </div>
            </div>

            {/* Active Stages Content */}
            {managePipelineTab === "active" ? (
              <div className="space-y-5">
                {/* Add New Custom Stage Form */}
                <form onSubmit={handleAddCustomStage} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider block">
                    Create New Pipeline Stage
                  </span>
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="text"
                      placeholder="Stage Name (e.g. Proposal Under Review)"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 flex-1 w-full"
                      required
                    />

                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-600">Color:</span>
                      <input
                        type="color"
                        value={newStageColor}
                        onChange={(e) => setNewStageColor(e.target.value)}
                        className="w-8 h-8 rounded-xl border border-slate-300 cursor-pointer p-0.5 bg-white"
                      />
                    </div>

                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-md transition-all flex-shrink-0 flex items-center space-x-1 cursor-pointer"
                    >
                      <i className="fa-solid fa-plus text-xs"></i>
                      <span>Add Stage</span>
                    </button>
                  </div>
                </form>

                {/* Active Stages List */}
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {activePipelineStages.map((st) => (
                    <div
                      key={st.id}
                      className={`border rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs ${
                        st.isCompulsory
                          ? "bg-slate-50 border-indigo-200"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <span
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: st.color || "#6366f1" }}
                        ></span>

                        {editingStageId === st.id ? (
                          <div className="flex items-center space-x-2 flex-1">
                            <input
                              type="text"
                              value={editingStageName}
                              onChange={(e) => setEditingStageName(e.target.value)}
                              className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none w-full"
                            />
                            <button
                              onClick={() => handleSaveRenameStage(st.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-xl shadow-2xs cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingStageId(null)}
                              className="text-slate-500 hover:text-slate-700 text-[10px] font-bold px-2 py-1 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 truncate">
                            <span className="text-xs font-extrabold text-slate-900 truncate">
                              {st.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 font-bold">
                              ({st.id})
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {st.isCompulsory || st.id === "raw" || st.id === "won" ? (
                          <span className="text-[10px] font-mono font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl">
                            🔒 Compulsory Core Stage
                          </span>
                        ) : (
                          <>
                            {editingStageId !== st.id && (
                              <button
                                onClick={() => {
                                  setEditingStageId(st.id);
                                  setEditingStageName(st.name);
                                }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-extrabold px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
                              >
                                Edit ✏️
                              </button>
                            )}

                            <button
                              onClick={() => handleSoftDeleteStage(st.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-extrabold px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
                              title="Soft delete (move to Recycle Bin)"
                            >
                              Move to Bin 🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Recycle Bin Tab */
              <div className="space-y-4 font-sans">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 font-semibold">
                  ℹ️ Stages deleted from the pipeline are safely kept in the Recycle Bin with status <code className="font-bold">isDeleted: true</code>. You can restore them anytime to bring them back to your live Kanban pipeline board!
                </div>

                {deletedPipelineStages.length === 0 ? (
                  <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center space-y-1">
                    <span className="text-xl block">🗑️</span>
                    <span className="text-xs font-bold text-slate-500">Recycle Bin is Empty</span>
                    <p className="text-[11px] text-slate-400">No soft-deleted pipeline stages found.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {deletedPipelineStages.map((st) => (
                      <div
                        key={st.id}
                        className="bg-rose-50/40 border border-rose-200 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <span
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: st.color || "#f43f5e" }}
                          ></span>
                          <div className="truncate">
                            <span className="text-xs font-extrabold text-slate-900 block truncate">
                              {st.name}
                            </span>
                            <span className="text-[10px] font-mono text-rose-700 font-bold">
                              Status: isDeleted = true
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRestoreSoftDeletedStage(st.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3.5 py-1.5 rounded-xl shadow-2xs transition-colors flex items-center space-x-1.5 flex-shrink-0 cursor-pointer"
                        >
                          <i className="fa-solid fa-rotate-left text-xs"></i>
                          <span>Restore Stage 🔄</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setIsManagePipelineModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold px-5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
