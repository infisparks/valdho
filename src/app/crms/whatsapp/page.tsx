"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  auth,
  syncAndGetUser,
  UserData,
  MASTER_ADMIN_UID,
  db,
} from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { onAuthStateChanged, User } from "firebase/auth";

interface WhatsappInstance {
  instanceId: string;
  instanceName: string;
  token?: string;
  status: "open" | "connected" | "connecting" | "close" | "disconnected" | "created";
  qrCode?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface MessageLog {
  id: string;
  type: "text" | "media" | "auto_welcome" | "auto_survey" | "auto_meeting";
  number: string;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  status: string;
  timestamp: string;
}

interface StepConfig {
  isEnabled: boolean;
  template: string;
}

interface GoogleMeetAccount {
  id: string;
  name: string;
  email: string;
  meetingUrl: string;
  status: "active" | "inactive";
  createdAt: string;
}

interface WhatsappWorkflowConfig {
  selectedInstanceName: string;
  defaultMeetingUrl: string;
  step1Welcome: StepConfig;
  step2Survey: StepConfig;
  step3Meeting: StepConfig;
}

const SERVER_URL = (process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL || "https://first.infiplus.in").replace(/\/$/, "");

export default function WhatsappManagerPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // WhatsApp Instances & State
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  const [isSyncingStatus, setIsSyncingStatus] = useState(false);

  // Auto-Workflow Config State for 3 Steps
  const [config, setConfig] = useState<WhatsappWorkflowConfig>({
    selectedInstanceName: "",
    defaultMeetingUrl: "https://meet.google.com/firstoption-strategy-call",
    step1Welcome: {
      isEnabled: true,
      template:
        "Hello {{name}}, thank you for contacting First Option Agency! We have received your contact details (Email: {{email}}, Phone: {{phone}}). Our team will get back to you shortly.",
    },
    step2Survey: {
      isEnabled: true,
      template:
        "Hello {{name}}, thank you for completing our qualification survey! Your answers have been recorded. Proceed to select a meeting time slot to complete your booking.",
    },
    step3Meeting: {
      isEnabled: true,
      template:
        "🎉 Meeting Confirmed! Hello {{name}}, your strategy session with First Option Agency is booked for {{date}} at {{time}}. Click here to join your video call: {{meeting_url}}",
    },
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configStatus, setConfigStatus] = useState<string | null>(null);

  // Send Message State
  const [selectedInstanceName, setSelectedInstanceName] = useState<string>("");
  const [targetNumber, setTargetNumber] = useState<string>("");
  const [messageType, setMessageType] = useState<"text" | "image" | "pdf">("text");
  const [messageText, setMessageText] = useState<string>("");
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [mediaCaption, setMediaCaption] = useState<string>("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [sendMessageStatus, setSendMessageStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  // Logs State
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);

  // Google Meet Integration State
  const [meetAccounts, setMeetAccounts] = useState<GoogleMeetAccount[]>([]);
  const [isConnectMeetModalOpen, setIsConnectMeetModalOpen] = useState(false);
  const [newMeetName, setNewMeetName] = useState("");
  const [newMeetEmail, setNewMeetEmail] = useState("");
  const [newMeetUrl, setNewMeetUrl] = useState("");
  const [newMeetRefreshToken, setNewMeetRefreshToken] = useState("");
  const [newMeetClientId, setNewMeetClientId] = useState("");
  const [newMeetClientSecret, setNewMeetClientSecret] = useState("");
  const [isConnectingMeet, setIsConnectingMeet] = useState(false);

  // Sync Google Meet Connected Accounts from Firebase RTDB `/google_meet_integrations/firstoptionagency`
  useEffect(() => {
    const meetRef = ref(db, "google_meet_integrations/firstoptionagency");
    const unsubscribe = onValue(meetRef, (snapshot) => {
      if (snapshot.exists()) {
        const list = Object.values(snapshot.val()) as GoogleMeetAccount[];
        setMeetAccounts(list);
      } else {
        setMeetAccounts([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Authenticate Admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login?redirect=/crms/whatsapp");
      } else {
        setCurrentUser(user);
        const profile = await syncAndGetUser(user.uid, user.email || "");
        setUserData(profile);

        const isAdmin =
          user.uid === MASTER_ADMIN_UID ||
          profile?.roleId === "role_admin" ||
          user.email?.toLowerCase().startsWith("firstoption");

        if (!isAdmin) {
          router.replace("/management");
        } else {
          setAuthLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Realtime Sync from Firebase RTDB `/whatsapp_unofficial_instances`
  useEffect(() => {
    const instancesRef = ref(db, "whatsapp_unofficial_instances");
    const unsubscribe = onValue(instancesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list: WhatsappInstance[] = Object.values(data);
        setInstances(list);

        if (list.length > 0 && !selectedInstanceName) {
          setSelectedInstanceName(list[0].instanceName);
        }
      } else {
        setInstances([]);
      }
    });

    return () => unsubscribe();
  }, [selectedInstanceName]);

  // Realtime Sync for WhatsApp Workflow Config from Firebase RTDB `/whatsapp_configuration/firstoptionagency`
  useEffect(() => {
    const configRef = ref(db, "whatsapp_configuration/firstoptionagency");
    const unsubscribe = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setConfig({
          selectedInstanceName: data.selectedInstanceName || "",
          defaultMeetingUrl: data.defaultMeetingUrl || "https://meet.google.com/firstoption-strategy-call",
          step1Welcome: {
            isEnabled: data.step1Welcome?.isEnabled !== false,
            template:
              data.step1Welcome?.template ||
              "Hello {{name}}, thank you for contacting First Option Agency! We have received your contact details (Email: {{email}}, Phone: {{phone}}). Our team will get back to you shortly.",
          },
          step2Survey: {
            isEnabled: data.step2Survey?.isEnabled !== false,
            template:
              data.step2Survey?.template ||
              "Hello {{name}}, thank you for completing our qualification survey! Your answers have been recorded. Proceed to select a meeting time slot to complete your booking.",
          },
          step3Meeting: {
            isEnabled: data.step3Meeting?.isEnabled !== false,
            template:
              data.step3Meeting?.template ||
              "🎉 Meeting Confirmed! Hello {{name}}, your strategy session with First Option Agency is booked for {{date}} at {{time}}. Click here to join your video call: {{meeting_url}}",
          },
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Realtime Sync Message Logs for Selected Instance
  useEffect(() => {
    if (!selectedInstanceName) return;
    const logsRef = ref(db, `whatsapp_logs/${selectedInstanceName}`);
    const unsubscribe = onValue(logsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list: MessageLog[] = Object.values(data);
        list.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setMessageLogs(list);
      } else {
        setMessageLogs([]);
      }
    });

    return () => unsubscribe();
  }, [selectedInstanceName]);

  // Trigger Live Sync with Evolution API
  const fetchLiveStatusList = useCallback(async () => {
    setIsSyncingStatus(true);
    try {
      await fetch(`${SERVER_URL}/api/whatsapp/instance/list`);
    } catch (err) {
      console.error("Sync Status List Error:", err);
    } finally {
      setIsSyncingStatus(false);
    }
  }, []);

  // Sync on Mount
  useEffect(() => {
    fetchLiveStatusList();
  }, [fetchLiveStatusList]);

  // Handle Save Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigStatus(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/whatsapp/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setConfigStatus("All 3 Step WhatsApp Configurations saved successfully!");
        setTimeout(() => setConfigStatus(null), 3000);
      } else {
        alert(`Error saving config: ${data.error}`);
      }
    } catch (err: any) {
      console.error("Save Config Error:", err);
      alert(`Server Connection Error: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Handle Create Instance
  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName.trim()) return;

    setIsCreatingInstance(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/whatsapp/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName: newInstanceName.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setNewInstanceName("");
        const targetName = data.data?.instanceName || newInstanceName.trim();
        const targetId = data.data?.instanceId || targetName;
        setSelectedInstanceName(targetName);

        if (data.isAlreadyConfigured) {
          alert(`Instance "${targetName}" is already created & configured! Connecting to fetch status/QR...`);
        }
        await handleConnectInstance(targetName, targetId);
      } else {
        alert(`Instance Status Notice: ${data.error || "Unable to create instance"}`);
      }
    } catch (err: any) {
      console.error("Create Instance Frontend Error:", err);
      alert(`Server Connection Error: ${err.message}. Make sure server is running on port 5001.`);
    } finally {
      setIsCreatingInstance(false);
    }
  };

  // Handle Connect / Generate QR Code
  const handleConnectInstance = async (instanceName: string, instanceId: string) => {
    try {
      const res = await fetch(`${SERVER_URL}/api/whatsapp/instance/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName, instanceId }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Connect Error: ${data.error}`);
      } else {
        await fetchLiveStatusList();
      }
    } catch (err: any) {
      console.error("Connect Instance Error:", err);
    }
  };

  // Handle Disconnect / Logout
  const handleDisconnectInstance = async (inst: WhatsappInstance) => {
    if (!confirm(`Are you sure you want to disconnect instance "${inst.instanceName}"?`)) {
      return;
    }

    try {
      const res = await fetch(
        `${SERVER_URL}/api/whatsapp/instance/logout/${inst.instanceId}?instanceName=${inst.instanceName}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!data.success) {
        alert(`Logout Error: ${data.error}`);
      } else {
        await fetchLiveStatusList();
      }
    } catch (err: any) {
      console.error("Logout Error:", err);
    }
  };

  // Handle Delete Instance
  const handleDeleteInstance = async (inst: WhatsappInstance) => {
    if (
      !confirm(
        `Are you sure you want to PERMANENTLY DELETE instance "${inst.instanceName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `${SERVER_URL}/api/whatsapp/instance/delete/${inst.instanceId}?instanceName=${inst.instanceName}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        if (selectedInstanceName === inst.instanceName) {
          setSelectedInstanceName("");
        }
        await fetchLiveStatusList();
      } else {
        alert(`Delete Error: ${data.error}`);
      }
    } catch (err: any) {
      console.error("Delete Error:", err);
    }
  };

  // Handle Connect Google Meet Account
  const handleConnectMeetAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeetName.trim() || !newMeetEmail.trim()) {
      alert("Please enter both Account Name and Email.");
      return;
    }

    setIsConnectingMeet(true);
    try {
      const accId = `meet_${Date.now()}`;
      const url = newMeetUrl.trim() || "https://meet.google.com/firstoption-strategy-call";

      const payload: any = {
        id: accId,
        name: newMeetName.trim(),
        email: newMeetEmail.trim(),
        meetingUrl: url,
        refreshToken: newMeetRefreshToken.trim() || "",
        clientId: newMeetClientId.trim() || "",
        clientSecret: newMeetClientSecret.trim() || "",
        status: "active",
        createdAt: new Date().toISOString(),
      };

      const dbUrl = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://firstoption-8da25-default-rtdb.firebaseio.com").replace(/\/$/, "");

      // Save to Firebase RTDB
      await fetch(`${dbUrl}/google_meet_integrations/firstoptionagency/${accId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Also update default meeting URL in config
      setConfig((prev) => ({ ...prev, defaultMeetingUrl: url }));
      await fetch(`${dbUrl}/whatsapp_configuration/firstoptionagency/defaultMeetingUrl.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(url),
      });

      setIsConnectMeetModalOpen(false);
      setNewMeetName("");
      setNewMeetEmail("");
      setNewMeetUrl("");
      setNewMeetRefreshToken("");
      setNewMeetClientId("");
      setNewMeetClientSecret("");
    } catch (err: any) {
      alert(`Failed to connect Google Meet account: ${err.message}`);
    } finally {
      setIsConnectingMeet(false);
    }
  };

  // Handle Delete Google Meet Account
  const handleDeleteMeetAccount = async (accId: string) => {
    if (!confirm("Are you sure you want to remove this Google Meet account integration?")) return;
    try {
      const dbUrl = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://firstoption-8da25-default-rtdb.firebaseio.com").replace(/\/$/, "");
      await fetch(`${dbUrl}/google_meet_integrations/firstoptionagency/${accId}.json`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Delete Meet error:", err);
    }
  };

  // Handle Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendMessageStatus(null);

    if (!selectedInstanceName) {
      alert("Please select or create an active WhatsApp instance first.");
      return;
    }
    if (!targetNumber.trim()) {
      alert("Please enter a valid phone number.");
      return;
    }

    setIsSendingMessage(true);
    try {
      let endpoint = `${SERVER_URL}/api/whatsapp/message/send-text`;
      let payload: any = {
        instanceName: selectedInstanceName,
        number: targetNumber.trim(),
        text: messageText,
      };

      if (messageType === "image" || messageType === "pdf") {
        if (!mediaUrl.trim()) {
          alert("Please enter a valid media URL (image/PDF link).");
          setIsSendingMessage(false);
          return;
        }
        endpoint = `${SERVER_URL}/api/whatsapp/message/send-media`;
        payload = {
          instanceName: selectedInstanceName,
          number: targetNumber.trim(),
          media: mediaUrl.trim(),
          caption: mediaCaption || messageText || "",
        };
      } else {
        if (!messageText.trim()) {
          alert("Please enter message text.");
          setIsSendingMessage(false);
          return;
        }
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSendMessageStatus({
          type: "success",
          msg: `Message sent successfully to ${targetNumber}! Status updated to 🟢 Connected!`,
        });
        setMessageText("");
        setMediaUrl("");
        setMediaCaption("");
        await fetchLiveStatusList();
      } else {
        setSendMessageStatus({
          type: "error",
          msg: `Send Failed: ${data.error || "Unknown server error"}`,
        });
      }
    } catch (err: any) {
      setSendMessageStatus({
        type: "error",
        msg: `Connection Error: ${err.message}`,
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (authLoading) {
    return (
      <div className="w-full min-h-screen bg-[#F5F6F8] flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-indigo-600 font-bold text-sm">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
          <span>Loading WhatsApp Evolution Manager...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-slate-900 font-sans antialiased">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push("/crms")}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-arrow-left"></i>
              <span>Back to Admin CRM</span>
            </button>
            <div className="h-5 w-px bg-slate-300"></div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center space-x-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm">
                💬
              </span>
              <span>WhatsApp Evolution API Manager</span>
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchLiveStatusList}
              disabled={isSyncingStatus}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <i className={`fa-solid fa-rotate ${isSyncingStatus ? "fa-spin" : ""}`}></i>
              <span>Refresh Status 🔄</span>
            </button>

            <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200">
              🟢 API Status: Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* AUTOMATED LEAD WORKFLOW CONFIGURATION CARDS (STEP 1, STEP 2, STEP 3) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center space-x-2">
                <span>Automated Lead Funnel WhatsApp Notifications 🤖</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Configure instant WhatsApp messages sent automatically at each step of the booking funnel (Contact Info, Survey, & Calendar Booking).
              </p>
            </div>

            {/* Global Instance Selector for Auto-Notifications */}
            <div className="space-y-1 w-full sm:w-auto">
              <label className="text-[11px] font-bold text-slate-700 block">Sender Instance:</label>
              <select
                value={config.selectedInstanceName}
                onChange={(e) => setConfig((prev) => ({ ...prev, selectedInstanceName: e.target.value }))}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-indigo-700 focus:outline-none focus:border-indigo-600 cursor-pointer w-full"
              >
                <option value="">-- Use First Active Instance --</option>
                {instances.map((inst) => (
                  <option key={inst.instanceId} value={inst.instanceName}>
                    🚀 {inst.instanceName} ({inst.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-6 font-sans">
            {/* DEFAULT MEETING LINK / VIDEO CALL URL CARD */}
            <div className="border border-indigo-200 rounded-2xl p-5 space-y-3 bg-indigo-50/40">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-800 flex items-center space-x-1.5">
                  <i className="fa-solid fa-video text-indigo-600"></i>
                  <span>Default Meeting Link / Video Call URL (Google Meet / Zoom)</span>
                </h3>
                <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                  Tag: {"{{meeting_url}}"}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700">Enter Google Meet / Zoom / Custom Strategy Call Link:</label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/firstoption-strategy-call"
                  value={config.defaultMeetingUrl}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      defaultMeetingUrl: e.target.value,
                    }))
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 font-mono"
                  required
                />
                <p className="text-[11px] text-slate-500">
                  💡 This URL will automatically replace <code className="font-bold text-indigo-700">{"{{meeting_url}}"}</code> tag in all WhatsApp booking confirmations & automated stage reminders!
                </p>
              </div>
            </div>
            {/* STEP 1 CONFIGURATION CARD */}
            <div className="border border-slate-200 rounded-2xl p-5 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Step 1: Contact Form Submitted (Name, Email, Phone)</span>
                </h3>

                <label className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl cursor-pointer hover:bg-emerald-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={config.step1Welcome.isEnabled}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        step1Welcome: { ...prev.step1Welcome, isEnabled: e.target.checked },
                      }))
                    }
                    className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-emerald-800">
                    {config.step1Welcome.isEnabled ? "Step 1 Active ✓" : "Step 1 Off ❌"}
                  </span>
                </label>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>Message Template:</span>
                  <span>Tags: {"{{name}}"}, {"{{email}}"}, {"{{phone}}"}</span>
                </div>
                <textarea
                  rows={2}
                  value={config.step1Welcome.template}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      step1Welcome: { ...prev.step1Welcome, template: e.target.value },
                    }))
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                ></textarea>
              </div>
            </div>

            {/* STEP 2 CONFIGURATION CARD */}
            <div className="border border-slate-200 rounded-2xl p-5 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Step 2: Qualification Survey Questionnaire Completed 📋</span>
                </h3>

                <label className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl cursor-pointer hover:bg-emerald-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={config.step2Survey.isEnabled}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        step2Survey: { ...prev.step2Survey, isEnabled: e.target.checked },
                      }))
                    }
                    className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-emerald-800">
                    {config.step2Survey.isEnabled ? "Step 2 Active ✓" : "Step 2 Off ❌"}
                  </span>
                </label>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>Message Template:</span>
                  <span>Tags: {"{{name}}"}, {"{{email}}"}, {"{{phone}}"}</span>
                </div>
                <textarea
                  rows={2}
                  value={config.step2Survey.template}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      step2Survey: { ...prev.step2Survey, template: e.target.value },
                    }))
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                ></textarea>
              </div>
            </div>

            {/* STEP 3/4 CONFIGURATION CARD */}
            <div className="border border-slate-200 rounded-2xl p-5 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>Step 3/4: Calendar Meeting Booked Confirmation 📅</span>
                </h3>

                <label className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl cursor-pointer hover:bg-emerald-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={config.step3Meeting.isEnabled}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        step3Meeting: { ...prev.step3Meeting, isEnabled: e.target.checked },
                      }))
                    }
                    className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-emerald-800">
                    {config.step3Meeting.isEnabled ? "Step 3 Active ✓" : "Step 3 Off ❌"}
                  </span>
                </label>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>Message Template:</span>
                  <span>Tags: {"{{name}}"}, {"{{email}}"}, {"{{date}}"}, {"{{time}}"}, {"{{meeting_url}}"}</span>
                </div>
                <textarea
                  rows={2}
                  value={config.step3Meeting.template}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      step3Meeting: { ...prev.step3Meeting, template: e.target.value },
                    }))
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                ></textarea>
              </div>
            </div>

            {configStatus && (
              <div className="p-3 rounded-xl text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300">
                ✓ {configStatus}
              </div>
            )}

            <button
              type="submit"
              disabled={isSavingConfig}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isSavingConfig ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
              ) : (
                <i className="fa-solid fa-floppy-disk text-xs"></i>
              )}
              <span>Save All WhatsApp Workflow Configurations 💾</span>
            </button>
          </form>
        </div>

        {/* Create Instance Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center space-x-2">
                <span>Create New WhatsApp Instance</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Enter an instance name (e.g. <strong className="text-indigo-600">customer1</strong>) to generate a QR code for WhatsApp login.
              </p>
            </div>

            <form onSubmit={handleCreateInstance} className="flex items-center space-x-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Instance Name (e.g. customer1)"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 w-full sm:w-64"
                required
              />
              <button
                type="submit"
                disabled={isCreatingInstance}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-md transition-all flex-shrink-0 flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isCreatingInstance ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                ) : (
                  <i className="fa-solid fa-plus text-xs"></i>
                )}
                <span>Create Instance</span>
              </button>
            </form>
          </div>
        </div>

        {/* GOOGLE MEET INTEGRATION CARD & ACCOUNTS LIST */}
        <div id="integrations" className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 font-sans scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-center flex-shrink-0">
                <svg className="w-8 h-8" viewBox="0 0 48 48">
                  <path fill="#4CAF50" d="M12 12h14v24H12z"/>
                  <path fill="#2196F3" d="M26 12l10 8v8l-10 8z"/>
                  <path fill="#FFC107" d="M36 20l6-4.5v17L36 28z"/>
                  <path fill="#F44336" d="M12 12l14 12L12 36z"/>
                </svg>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900">Google Meet</h2>
                  <span className="text-[10px] font-extrabold font-mono bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md uppercase border border-emerald-200">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Connect your Google Meet account for seamless meeting integration & automated WhatsApp video links.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="bg-slate-100 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-200">
                {meetAccounts.length} Active
              </span>
              <button
                type="button"
                onClick={() => setIsConnectMeetModalOpen(true)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 w-9 h-9 rounded-xl font-bold flex items-center justify-center text-lg shadow-2xs transition-all cursor-pointer"
                title="Connect New Google Meet Account"
              >
                +
              </button>
            </div>
          </div>

          {/* Connected Accounts Grid */}
          {meetAccounts.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-2xl p-5 text-center space-y-1 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-600 block">No Google Meet accounts connected yet.</span>
              <p className="text-[11px] text-slate-400">
                Click the <strong className="text-indigo-600">+</strong> button above to connect your account name and video call URL!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {meetAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:border-indigo-300 transition-all"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <h4 className="text-xs font-extrabold text-slate-900 truncate">{acc.name}</h4>
                    <p className="text-[11px] text-slate-500 font-mono truncate">{acc.email}</p>
                    <span className="text-[10px] text-indigo-600 font-mono truncate block font-bold">
                      🔗 {acc.meetingUrl}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteMeetAccount(acc.id)}
                    className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                    title="Delete Account Integration"
                  >
                    <i className="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instances Grid */}
        <div className="space-y-3 font-sans">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider text-slate-500">
              WhatsApp Instances ({instances.length})
            </h3>
            <button
              onClick={fetchLiveStatusList}
              className="text-xs font-extrabold text-indigo-600 hover:underline"
            >
              🔄 Refresh Live Connection Statuses
            </button>
          </div>

          {instances.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mx-auto">
                <i className="fa-brands fa-whatsapp"></i>
              </div>
              <h4 className="text-sm font-extrabold text-slate-900">No WhatsApp Instances Created Yet</h4>
              <p className="text-xs text-slate-500">
                Use the form above to create your first instance and generate a login QR code!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {instances.map((inst) => {
                const isConnected = inst.status === "open" || inst.status === "connected";
                const isConnecting = inst.status === "connecting";

                return (
                  <div
                    key={inst.instanceId}
                    className={`bg-white border rounded-3xl p-5 space-y-4 shadow-sm flex flex-col justify-between ${
                      isConnected
                        ? "border-emerald-300 ring-2 ring-emerald-500/10"
                        : isConnecting
                        ? "border-amber-300"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Instance Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 uppercase">
                            Instance: {inst.instanceName}
                          </span>
                          <h4 className="text-base font-extrabold text-slate-900 mt-1">
                            {inst.instanceName}
                          </h4>
                        </div>

                        <span
                          className={`text-[11px] font-extrabold px-2.5 py-1 rounded-xl border flex items-center space-x-1 ${
                            isConnected
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : isConnecting
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : "bg-slate-100 text-slate-700 border-slate-300"
                          }`}
                        >
                          <span>{isConnected ? "🟢 Connected" : isConnecting ? "🟡 Connecting" : "🔴 Disconnected"}</span>
                        </span>
                      </div>

                      {/* QR Code Display if Connecting */}
                      {inst.qrCode && !isConnected ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-2">
                          <span className="text-xs font-bold text-slate-700 block">
                            Scan QR Code with WhatsApp:
                          </span>
                          <div className="bg-white p-3 rounded-xl inline-block shadow-xs border border-slate-200">
                            {/* eslint-disable-next-html-element-suppress */}
                            <img
                              src={inst.qrCode}
                              alt="WhatsApp QR Code"
                              className="w-48 h-48 mx-auto object-contain"
                            />
                          </div>
                          <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl font-bold border border-amber-200">
                            📱 Open WhatsApp &gt; Linked Devices &gt; Scan QR Code
                          </p>
                        </div>
                      ) : isConnected ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-1">
                          <div className="text-emerald-700 font-extrabold text-sm flex items-center justify-center space-x-1">
                            <span>✅ Device Linked & Connected!</span>
                          </div>
                          <p className="text-xs text-emerald-800">
                            Ready to send automated messages and media.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-2">
                          <p className="text-xs text-slate-500">
                            Click "Connect / Generate QR" below to login with WhatsApp.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {!isConnected && (
                        <button
                          onClick={() => handleConnectInstance(inst.instanceName, inst.instanceId)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-2xs transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <i className="fa-solid fa-qrcode"></i>
                          <span>Connect QR</span>
                        </button>
                      )}

                      {isConnected && (
                        <button
                          onClick={() => handleDisconnectInstance(inst)}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 text-xs font-extrabold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                        >
                          Disconnect 🚪
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteInstance(inst)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold px-2.5 py-1.5 rounded-xl transition-colors ml-auto cursor-pointer"
                        title="Delete Instance"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Send Message Panel & Tester */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <i className="fa-solid fa-paper-plane text-emerald-600"></i>
              <span>Send WhatsApp Message Tester</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Send instant text messages or media attachments (images/PDFs) to any recipient number.
            </p>
          </div>

          <form onSubmit={handleSendMessage} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Select Instance */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Select Active Instance:</label>
                <select
                  value={selectedInstanceName}
                  onChange={(e) => setSelectedInstanceName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                  required
                >
                  <option value="">-- Choose Instance --</option>
                  {instances.map((inst) => (
                    <option key={inst.instanceId} value={inst.instanceName}>
                      {inst.instanceName} ({inst.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Phone Number */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Recipient Phone Number:</label>
                <input
                  type="text"
                  placeholder="e.g. 919876543210"
                  value={targetNumber}
                  onChange={(e) => setTargetNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              {/* Message Type */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Message Type:</label>
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="text">Text Message</option>
                  <option value="image">Image Attachment</option>
                  <option value="pdf">PDF Attachment / Invoice</option>
                </select>
              </div>
            </div>

            {/* Dynamic Content Fields */}
            {messageType === "text" ? (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Message Text:</label>
                <textarea
                  placeholder="Type your WhatsApp message here..."
                  rows={3}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                  required
                ></textarea>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Media URL ({messageType.toUpperCase()} Link):
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/file.jpg or https://example.com/invoice.pdf"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Caption (Optional):</label>
                  <input
                    type="text"
                    placeholder="Caption for media file..."
                    value={mediaCaption}
                    onChange={(e) => setMediaCaption(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            )}

            {sendMessageStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-extrabold border ${
                  sendMessageStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-rose-50 text-rose-800 border-rose-300"
                }`}
              >
                {sendMessageStatus.msg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSendingMessage}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isSendingMessage ? (
                <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
              ) : (
                <i className="fa-solid fa-paper-plane text-xs"></i>
              )}
              <span>Send WhatsApp Message 📤</span>
            </button>
          </form>
        </div>

        {/* Message Logs */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider text-slate-500">
            Recent Message Activity Logs ({messageLogs.length})
          </h3>

          {messageLogs.length === 0 ? (
            <p className="text-xs text-slate-400 font-mono italic">No message logs recorded yet for selected instance.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 font-mono text-xs">
              {messageLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-indigo-700">To: {log.number}</span>
                      <span className="bg-slate-200 text-slate-800 text-[10px] px-1.5 py-0.2 rounded uppercase">
                        {log.type}
                      </span>
                    </div>
                    <p className="text-slate-900 font-sans font-bold">
                      {log.text || log.caption || log.mediaUrl}
                    </p>
                  </div>

                  <span className="text-[10px] text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      {/* CONNECT GOOGLE MEET ACCOUNT MODAL */}
      {isConnectMeetModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="fixed inset-0" onClick={() => setIsConnectMeetModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-5 border border-slate-200 z-10 animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Connect Your Account</h3>
              <button
                onClick={() => setIsConnectMeetModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConnectMeetAccount} className="space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800 flex items-center space-x-1">
                  <span>Name</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Account Name (e.g. First Option Agency)"
                  value={newMeetName}
                  onChange={(e) => setNewMeetName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800 flex items-center space-x-1">
                  <span>Email</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="Account Email (e.g. contact@firstoption.com)"
                  value={newMeetEmail}
                  onChange={(e) => setNewMeetEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              {/* Google Meet Room URL */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800 flex items-center space-x-1">
                  <span>Default Google Meet Link / Video Room URL</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/xyz-abc-123"
                  value={newMeetUrl}
                  onChange={(e) => setNewMeetUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-indigo-700 font-mono focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              {/* Google OAuth Refresh Token for Auto Unique Links */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-indigo-900 flex items-center space-x-1">
                    <span>⚡ Google Calendar OAuth (Auto Unique Links)</span>
                  </span>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                    Optional
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Enter your Google Refresh Token below if you want Google Calendar API to automatically generate a brand-new, unique <code>meet.google.com</code> link for every booking!
                </p>

                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Google OAuth Refresh Token (Optional)"
                    value={newMeetRefreshToken}
                    onChange={(e) => setNewMeetRefreshToken(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Google Client ID"
                      value={newMeetClientId}
                      onChange={(e) => setNewMeetClientId(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-[11px] font-mono text-slate-900 focus:outline-none"
                    />
                    <input
                      type="password"
                      placeholder="Google Client Secret"
                      value={newMeetClientSecret}
                      onChange={(e) => setNewMeetClientSecret(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-[11px] font-mono text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isConnectingMeet}
                  className="bg-indigo-950 hover:bg-indigo-900 text-white text-xs font-extrabold px-6 py-2.5 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isConnectingMeet ? "Connecting..." : "Connect Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
