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
  type: "text" | "media";
  number: string;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  status: string;
  timestamp: string;
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
        // Automatically connect to get QR code / status
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
    </div>
  );
}
