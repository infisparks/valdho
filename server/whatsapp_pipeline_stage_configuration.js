const express = require("express");
const router = express.Router();

// Configuration from Environment
const API_KEY = process.env.WHATSAPP_API_KEY || "vR39h6avY69g7kAU3YQbS6V6XEvudson";
const BASE_URL = (process.env.WHATSAPP_API_URL || "https://evo.infispark.in").replace(/\/$/, "");
const FIREBASE_DB_URL = (
  process.env.FIREBASE_DATABASE_URL ||
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  "https://firstoption-8da25-default-rtdb.firebaseio.com"
).replace(/\/$/, "");
const FIREBASE_DB_SECRET = process.env.FIREBASE_DB_SECRET || process.env.FIREBASE_DATABASE_SECRET || "";

/**
 * Firebase Realtime Database REST API Helper
 */
async function firebaseDb(path, method = "GET", body = null) {
  try {
    const authQuery = FIREBASE_DB_SECRET ? `?auth=${encodeURIComponent(FIREBASE_DB_SECRET)}` : "";
    const url = `${FIREBASE_DB_URL}/${path}.json${authQuery}`;
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (!res.ok) {
      console.error(`[Pipeline Worker] Firebase DB Error (${res.status}):`, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("[Pipeline Worker] Firebase DB Exception:", err);
    return null;
  }
}

/**
 * Evolution API Call Helper
 */
async function evoApiCall(endpoint, method = "GET", body = null) {
  try {
    const url = `${BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const options = {
      method,
      headers: {
        apikey: API_KEY,
        "Content-Type": "application/json",
      },
    };
    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    console.error(`[Pipeline Worker] Evolution API Error (${endpoint}):`, err);
    return { status: 500, ok: false, data: { error: err.message } };
  }
}

/**
 * Sanitize Phone Number Helper
 */
function sanitizePhoneNumber(number) {
  if (!number) return "";
  let clean = String(number).replace(/\D/g, "");
  if (clean.length === 10) {
    clean = "91" + clean;
  }
  return clean;
}

/**
 * Parse Date and Time String into JavaScript Date
 */
function parseMeetingDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  try {
    const rawDate = String(dateStr).trim();
    const cleanDate = rawDate.split("T")[0];
    const dateParts = cleanDate.split(/[-/]/);

    let year = 0, month = 0, day = 0;

    if (dateParts.length === 3) {
      const p0 = parseInt(dateParts[0], 10);
      const p1 = parseInt(dateParts[1], 10);
      const p2 = parseInt(dateParts[2], 10);

      if (p0 > 1000) {
        // YYYY-MM-DD or YYYY/MM/DD
        year = p0;
        month = p1 - 1;
        day = p2;
      } else if (p2 > 1000) {
        // DD-MM-YYYY or MM-DD-YYYY or DD/MM/YYYY
        year = p2;
        if (p0 > 12) {
          day = p0;
          month = p1 - 1;
        } else if (p1 > 12) {
          month = p0 - 1;
          day = p1;
        } else {
          day = p0;
          month = p1 - 1;
        }
      }
    }

    let hour = 12;
    let minute = 0;

    if (timeStr) {
      const cleanTime = String(timeStr).trim().toUpperCase();
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

    if (year > 1900 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const pad = (n) => String(n).padStart(2, "0");
      // Explicitly construct IST (+05:30) date object so server timezone doesn't offset it by 5.5 hours!
      const isoString = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+05:30`;
      const dt = new Date(isoString);
      return isNaN(dt.getTime()) ? null : dt;
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Recursive Lead Extractor - Traverses campaigns & leads nodes in Firebase RTDB
 */
function extractLeadsFromFirebaseData(obj, foundLeads = [], path = "", depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return foundLeads;

  // If object has phone and (fullName or email or pipelineStage or status), it's a valid lead
  if (obj.phone && (obj.fullName || obj.email || obj.pipelineStage || obj.status)) {
    const leadId = obj.id || obj.email || `lead_${foundLeads.length + 1}`;
    foundLeads.push({ ...obj, leadId, _path: path });
    return foundLeads;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object") {
      extractLeadsFromFirebaseData(value, foundLeads, `${path}/${key}`, depth + 1);
    }
  }

  return foundLeads;
}

/* ==========================================================================
   REST API ENDPOINTS FOR MANAGING STAGE AUTOMATION RULES
   ========================================================================== */

/**
 * GET /api/whatsapp/stage-automations
 */
router.get("/stage-automations", async (req, res) => {
  try {
    const automations = (await firebaseDb("whatsapp_stage_automations/firstoptionagency")) || {};
    return res.status(200).json({ success: true, data: automations });
  } catch (err) {
    console.error("Get Stage Automations Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/stage-automations
 */
router.post("/stage-automations", async (req, res) => {
  try {
    const { stageId, rule } = req.body;
    if (!stageId || !rule || !rule.title) {
      return res.status(400).json({ success: false, error: "stageId and valid rule object are required" });
    }

    const ruleId = rule.id || `rule_${Date.now()}`;
    const rulePayload = {
      id: ruleId,
      stageId,
      title: rule.title.trim(),
      instanceName: rule.instanceName || "", // Specific WhatsApp Instance selector
      triggerBase: rule.triggerBase || "created", // "meeting" | "created"
      offsetType: rule.offsetType || "recurring", // "before" | "after" | "recurring"
      offsetValue: Number(rule.offsetValue) || 1,
      offsetUnit: rule.offsetUnit || "minutes", // "minutes" | "hours" | "days"
      template: rule.template || "Hello {{name}}, reminder for your session at {{time}} on {{date}}!",
      isEnabled: rule.isEnabled !== false,
      updatedAt: new Date().toISOString(),
    };

    await firebaseDb(`whatsapp_stage_automations/firstoptionagency/${stageId}/${ruleId}`, "PUT", rulePayload);

    return res.status(200).json({
      success: true,
      message: "Stage automation rule saved successfully",
      data: rulePayload,
    });
  } catch (err) {
    console.error("Save Stage Automation Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/whatsapp/stage-automations/:stageId/:ruleId
 */
router.delete("/stage-automations/:stageId/:ruleId", async (req, res) => {
  try {
    const { stageId, ruleId } = req.params;
    await firebaseDb(`whatsapp_stage_automations/firstoptionagency/${stageId}/${ruleId}`, "DELETE");
    return res.status(200).json({ success: true, message: "Rule deleted successfully" });
  } catch (err) {
    console.error("Delete Stage Automation Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ==========================================================================
   BACKGROUND AUTOMATION EVALUATOR & CRON WORKER DAEMON
   ========================================================================== */

let isWorkerEvaluating = false;

async function evaluateStageAutomations() {
  if (isWorkerEvaluating) return;
  isWorkerEvaluating = true;
  try {
    // 1. Fetch active stage automation rules
    const allStageRulesObj = (await firebaseDb("whatsapp_stage_automations/firstoptionagency")) || {};
    const activeRules = [];
    for (const [stageId, rulesMap] of Object.entries(allStageRulesObj)) {
      if (!rulesMap) continue;
      for (const rule of Object.values(rulesMap)) {
        if (rule && rule.isEnabled) {
          activeRules.push(rule);
        }
      }
    }

    if (activeRules.length === 0) return; // No active rules to process

    // 2. Resolve Global Default WhatsApp Sender Instance
    const config = (await firebaseDb("whatsapp_configuration/firstoptionagency")) || {};
    let defaultInstanceName = config.selectedInstanceName;

    if (!defaultInstanceName) {
      const fbInstances = (await firebaseDb("whatsapp_unofficial_instances")) || {};
      const instancesList = Object.values(fbInstances).filter(Boolean);
      const openInst = instancesList.find((i) => i.status === "open") || instancesList[0];
      if (openInst) defaultInstanceName = openInst.instanceName;
    }

    // 3. Fetch All Campaign & Master Leads from Firebase RTDB
    const campaignsData = (await firebaseDb("campaigns")) || {};
    const leadsData = (await firebaseDb("leads")) || {};

    const rawLeadsList = [
      ...extractLeadsFromFirebaseData(campaignsData, [], "campaigns"),
      ...extractLeadsFromFirebaseData(leadsData, [], "leads"),
    ];

    // Deduplicate leads by normalized 12-digit phone number / email
    const uniqueLeadsMap = new Map();
    for (const l of rawLeadsList) {
      const cleanPhone = sanitizePhoneNumber(l.phone);
      const key = cleanPhone || (l.email ? l.email.toLowerCase().trim() : l.leadId);
      if (key && !uniqueLeadsMap.has(key)) {
        uniqueLeadsMap.set(key, { ...l, _cleanPhone: cleanPhone });
      }
    }

    const allLeads = Array.from(uniqueLeadsMap.values());
    const nowMs = Date.now();

    console.log(`[Pipeline Worker 🔍] Starting evaluation of ${activeRules.length} active rules across ${allLeads.length} leads at ${new Date().toLocaleTimeString()}...`);

    // 4. Evaluate each lead against matching stage rules (With Smart Stage Alias Mapping & Fallback Funnel Engine)
    const normStage = (s) => (s || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");

    const stageEquivalents = {
      surveycompleted: ["surveycompleted", "survey", "step2", "qualificationsurvey"],
      inprogress: ["inprogress", "1stconnection", "firstconnection", "step1", "connection"],
      meetingbooked: ["meetingbooked", "meeting", "step3", "booking"],
      raw: ["raw", "leads", "newlead"],
      proposalsent: ["proposalsent", "proposal"],
      won: ["won", "closedwon"],
      notqualified: ["notqualified", "disqualified"],
    };

    for (const lead of allLeads) {
      const cleanNumber = lead._cleanPhone || sanitizePhoneNumber(lead.phone);
      if (!cleanNumber || cleanNumber.length < 5) {
        console.log(`[Pipeline Worker ⚠️] Lead '${lead.fullName || lead.leadId}' has no valid phone number (${lead.phone}). Skipping.`);
        continue;
      }

      const leadStage = lead.pipelineStage || lead.status || lead.stage || "raw";
      const leadStgNorm = normStage(leadStage);
      const leadEquivs = stageEquivalents[leadStgNorm] || [leadStgNorm];

      let matchingRules = activeRules.filter((r) => {
        const rStgNorm = normStage(r.stageId);
        const rEquivs = stageEquivalents[rStgNorm] || [rStgNorm];
        return rEquivs.some((eq) => leadEquivs.includes(eq)) || (rStgNorm && leadStgNorm && (rStgNorm.includes(leadStgNorm) || leadStgNorm.includes(rStgNorm)));
      });

      // Smart Fallback Engine: If no custom stage rule exists, check Global 3-Step Funnel Config
      if (matchingRules.length === 0) {
        if (leadEquivs.includes("surveycompleted")) {
          const tpl = config.step2Survey?.template || "Hello {{name}}, thank you for completing our qualification survey! Your answers have been recorded. Proceed to select a meeting time slot to complete your booking.";
          matchingRules.push({
            id: "fallback_step2_survey",
            stageId: leadStage,
            title: "Auto Funnel: Step 2 Survey Completed",
            triggerBase: "created",
            offsetType: "after",
            offsetValue: 0,
            offsetUnit: "minutes",
            template: tpl,
            isEnabled: true,
          });
        } else if (leadEquivs.includes("inprogress") || leadEquivs.includes("raw")) {
          const tpl = config.step1Welcome?.template || "Hello {{name}}, thank you for contacting First Option Agency! We have received your contact details. Our team will get back to you shortly.";
          matchingRules.push({
            id: "fallback_step1_welcome",
            stageId: leadStage,
            title: "Auto Funnel: Step 1 Contact Welcome",
            triggerBase: "created",
            offsetType: "after",
            offsetValue: 0,
            offsetUnit: "minutes",
            template: tpl,
            isEnabled: true,
          });
        } else if (leadEquivs.includes("meetingbooked")) {
          const tpl = config.step3Meeting?.template || "🎉 Meeting Confirmed! Hello {{name}}, your strategy session with First Option Agency is booked for {{date}} at {{time}}. Join video call: {{meeting_url}}";
          matchingRules.push({
            id: "fallback_step3_meeting",
            stageId: leadStage,
            title: "Auto Funnel: Step 3 Meeting Confirmed",
            triggerBase: "meeting",
            offsetType: "before",
            offsetValue: 10,
            offsetUnit: "minutes",
            template: tpl,
            isEnabled: true,
          });
        }
      }

      console.log(`[Pipeline Worker 👤] Checking Lead: ${lead.fullName || "Client"} (${cleanNumber}) | Stage: '${leadStage}' (Norm: '${leadStgNorm}') | Matching Rules: ${matchingRules.length}`);

      for (const rule of matchingRules) {
        const targetInstance = rule.instanceName || defaultInstanceName;
        if (!targetInstance) {
          console.warn(`[Pipeline Worker ⚠️] No active WhatsApp instance available for rule "${rule.title}"`);
          continue;
        }

        let referenceDate = null;
        let meetingKey = "";

        if (rule.triggerBase === "meeting") {
          if (leadStage === "won" || leadStage === "not_qualified") {
            console.log(`[Pipeline Worker ⏭️] Skipping meeting reminder for ${lead.fullName || cleanNumber} in stage '${leadStage}'`);
            continue;
          }

          const meetingDateVal = lead.meeting?.meetingDate || lead.meetingDate || lead.date;
          const meetingTimeVal = lead.meeting?.meetingTime || lead.meetingTime || lead.time;

          if (!meetingDateVal) {
            console.log(`[Pipeline Worker ℹ️] Lead ${lead.fullName || cleanNumber} has no meeting date set. Skipping rule '${rule.title}'`);
            continue;
          }
          referenceDate = parseMeetingDateTime(meetingDateVal, meetingTimeVal);

          if (!referenceDate || isNaN(referenceDate.getTime())) {
            console.log(`[Pipeline Worker ⚠️] Failed to parse meeting date '${meetingDateVal}' '${meetingTimeVal}' for ${lead.fullName || cleanNumber}`);
            continue;
          }

          meetingKey = (String(meetingDateVal) + "_" + String(meetingTimeVal || "")).replace(/\D/g, "");
        } else {
          const rawReference = lead.stageMovedAt || lead.createdAt || lead.createdDate || lead.timestamp || lead.meeting?.bookedAt;
          referenceDate = rawReference ? new Date(rawReference) : new Date();
          meetingKey = String(rawReference || "").replace(/\D/g, "").slice(0, 12) || "init";
        }

        if (!referenceDate || isNaN(referenceDate.getTime())) continue;

        // Calculate offset in milliseconds
        let offsetMs = Number(rule.offsetValue) * 60 * 1000;
        if (rule.offsetUnit === "hours") offsetMs = Number(rule.offsetValue) * 3600 * 1000;
        if (rule.offsetUnit === "days") offsetMs = Number(rule.offsetValue) * 86400 * 1000;
        if (offsetMs <= 0) offsetMs = 60000;

        let scheduledTriggerTimeMs = 0;
        let triggerKey = "";

        if (rule.offsetType === "recurring") {
          const elapsedMs = Math.max(0, nowMs - referenceDate.getTime());
          const intervalIndex = Math.floor(elapsedMs / offsetMs);

          scheduledTriggerTimeMs = referenceDate.getTime() + (intervalIndex * offsetMs);
          triggerKey = `auto_${cleanNumber}_stg_${leadStage}_rule_${rule.id}_stg_${meetingKey || "init"}_seq_${intervalIndex}`;
        } else if (rule.offsetType === "before") {
          scheduledTriggerTimeMs = referenceDate.getTime() - offsetMs;
          triggerKey = `auto_${cleanNumber}_stg_${leadStage}_rule_${rule.id}_m_${meetingKey || "bef"}`;
        } else {
          // after
          scheduledTriggerTimeMs = referenceDate.getTime() + offsetMs;
          triggerKey = `auto_${cleanNumber}_stg_${leadStage}_rule_${rule.id}_aft_${meetingKey || "aft"}`;
        }

        const diffMs = nowMs - scheduledTriggerTimeMs;

        // For 'before' meeting rules, do not send if meeting has already passed by > 15 minutes
        if (rule.triggerBase === "meeting" && rule.offsetType === "before") {
          if (nowMs > referenceDate.getTime() + (15 * 60 * 1000)) {
            console.log(`[Pipeline Worker ⏭️] Skipping 'before' rule '${rule.title}' for ${lead.fullName || cleanNumber} because meeting at ${referenceDate.toLocaleTimeString()} passed > 15m ago.`);
            continue;
          }
        }

        // Window check: execute if current time has reached or passed scheduledTriggerTimeMs
        const isTimeReached = diffMs >= -30000;

        const formatIST = (ms) => new Date(ms).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });

        const alreadySent = await firebaseDb(`whatsapp_sent_automations/${triggerKey}`);

        // Record accurate Server-side Timer Target in Firebase RTDB for Frontend Countdown UI
        let nextTargetMs = scheduledTriggerTimeMs;
        if (alreadySent && alreadySent.status === "sent") {
          nextTargetMs = rule.offsetType === "recurring" ? (scheduledTriggerTimeMs + offsetMs) : null;
        }

        if (nextTargetMs) {
          const remSec = Math.max(0, Math.round((nextTargetMs - nowMs) / 1000));
          await firebaseDb(`whatsapp_lead_timers/${cleanNumber}`, "PUT", {
            phone: cleanNumber,
            leadName: lead.fullName || cleanNumber,
            leadStage,
            ruleId: rule.id,
            ruleTitle: rule.title || rule.offsetType,
            nextTriggerTimeMs: nextTargetMs,
            nextTriggerTimeIST: formatIST(nextTargetMs),
            remainingSeconds: remSec,
            status: alreadySent && alreadySent.status === "sent" ? "next_recurring_queued" : "waiting",
            updatedAt: new Date().toISOString(),
          });
        }

        if (!isTimeReached) {
          console.log(`[Pipeline Worker ⏳] Rule '${rule.title}' not reached yet for ${lead.fullName || cleanNumber}. (Target IST: ${formatIST(scheduledTriggerTimeMs)}, Now IST: ${formatIST(nowMs)}, ${Math.round(-diffMs / 1000)}s remaining)`);
          continue;
        }

        // Guard Check 1: Verify if this specific trigger key has already been executed successfully
        if (alreadySent && alreadySent.status === "sent") {
          console.log(`[Pipeline Worker ⏩] Rule '${rule.title}' ALREADY EXECUTED for ${lead.fullName || cleanNumber} (Key: '${triggerKey}', Sent at: ${alreadySent.sentAt})`);
          continue;
        }

        // Guard Check 2: 15-Second Cooldown per rule and phone number
        const cooldownKey = `cooldown_${rule.id}_${cleanNumber}`;
        const phoneCooldown = await firebaseDb(`whatsapp_sent_automations/${cooldownKey}`);
        if (phoneCooldown && phoneCooldown.lastSentAt) {
          const cooldownDiffMs = nowMs - new Date(phoneCooldown.lastSentAt).getTime();
          if (cooldownDiffMs < 15000) {
            console.log(`[Pipeline Worker ⏳] Cooldown active for ${cleanNumber} on rule '${rule.title}' (${Math.round(cooldownDiffMs / 1000)}s since last message). Skipping.`);
            continue;
          }
        }

        // If previously failed less than 30s ago, wait before retrying
        if (alreadySent && alreadySent.status === "failed" && alreadySent.failedAt) {
          const failedDiffMs = nowMs - new Date(alreadySent.failedAt).getTime();
          if (failedDiffMs < 30000) {
            console.log(`[Pipeline Worker ⏳] Previous failed attempt < 30s ago for ${cleanNumber} on '${rule.title}'. Waiting before retry.`);
            continue;
          }
        }

        // Format Dynamic Message Template
        const formattedDate = lead.meeting?.meetingDate || lead.meetingDate || "Upcoming Date";
        const formattedTime = lead.meeting?.meetingTime || lead.meetingTime || "Scheduled Time";
        const resolvedMeetingUrl =
          lead.meeting?.meetingUrl ||
          lead.links?.meetingUrl ||
          lead.meetingUrl ||
          config.defaultMeetingUrl ||
          "https://meet.google.com/firstoption-strategy-call";

        const stageNameMap = {
          raw: "Leads",
          in_progress: "1st Connection",
          survey_completed: "Survey Completed",
          meeting_booked: "Meeting Booked",
          proposal_sent: "Proposal Sent",
          won: "Won",
          not_qualified: "Not Qualified",
        };
        const leadStageName = stageNameMap[leadStage] || leadStage;

        const textMessage = rule.template
          .replace(/\{\{\s*name\s*\}\}/gi, lead.fullName || "Valued Client")
          .replace(/\{\{\s*email\s*\}\}/gi, lead.email || "N/A")
          .replace(/\{\{\s*phone\s*\}\}/gi, lead.phone || "N/A")
          .replace(/\{\{\s*date\s*\}\}/gi, formattedDate)
          .replace(/\{\{\s*time\s*\}\}/gi, formattedTime)
          .replace(/\{\{\s*meeting_url\s*\}\}/gi, resolvedMeetingUrl)
          .replace(/\{\{\s*meeting_link\s*\}\}/gi, resolvedMeetingUrl)
          .replace(/\{\{\s*meetingUrl\s*\}\}/gi, resolvedMeetingUrl)
          .replace(/\{\{\s*meetingLink\s*\}\}/gi, resolvedMeetingUrl)
          .replace(/\{\{\s*link\s*\}\}/gi, resolvedMeetingUrl)
          .replace(/\{\{\s*stage\s*\}\}/gi, leadStageName);

        console.log(`[Pipeline Worker ⚡ DISPATCHING] Sending WhatsApp Rule "${rule.title}" via instance '${targetInstance}' to ${lead.fullName || "Client"} (${cleanNumber})`);

        // Record immediate cooldown timestamp
        await firebaseDb(`whatsapp_sent_automations/${cooldownKey}`, "PUT", {
          lastSentAt: new Date().toISOString(),
          ruleId: rule.id,
          phone: cleanNumber,
        });

        // Send Text Message via Evolution API
        const evoRes = await evoApiCall(`/message/sendText/${targetInstance}`, "POST", {
          number: cleanNumber,
          text: textMessage,
        });

        console.log(`[Pipeline Worker ${evoRes.ok ? "✅ SUCCESS" : "❌ FAILED"}] Message dispatch for '${rule.title}' to ${cleanNumber}: ${evoRes.ok ? "Sent successfully" : evoRes.data?.error || evoRes.status}`);

        // Record Guard Flag status
        await firebaseDb(`whatsapp_sent_automations/${triggerKey}`, "PUT", {
          sentAt: new Date().toISOString(),
          status: evoRes.ok ? "sent" : "failed",
          failedAt: evoRes.ok ? null : new Date().toISOString(),
          leadId: lead.leadId || lead.phone,
          ruleId: rule.id,
          phone: cleanNumber,
          instanceName: targetInstance,
          error: evoRes.ok ? null : (evoRes.data?.error || evoRes.data?.message || `HTTP ${evoRes.status}`),
        });

        // Log into Realtime Activity Logs for instant retrieval
        const logId = `auto_stage_${Date.now()}`;
        const errorMessage = evoRes.ok
          ? null
          : (evoRes.data?.error || evoRes.data?.message || evoRes.data?.response?.message || `HTTP Error ${evoRes.status}: Evolution API request failed`);

        const logData = {
          id: logId,
          type: "auto_stage_automation",
          ruleTitle: rule.title,
          stageId: leadStage,
          number: cleanNumber,
          leadName: lead.fullName || "Client",
          text: textMessage,
          instanceName: targetInstance,
          status: evoRes.ok ? "sent" : "failed",
          error: errorMessage,
          timestamp: new Date().toISOString(),
        };

        await firebaseDb(`whatsapp_logs/${targetInstance}/${logId}`, "PUT", logData);
        await firebaseDb(`whatsapp_lead_logs/${cleanNumber}/${logId}`, "PUT", logData);
      }
    }
  } catch (err) {
    console.error("[Pipeline Worker Daemon Exception]:", err);
  } finally {
    isWorkerEvaluating = false;
  }
}

/**
 * 5. Evaluate Lead WhatsApp Messages Scheduled By Exact Date & Time
 * Node: /lead_whatapp_send_by_date/${cleanNumber}/${scheduleId}
 */
async function evaluateScheduledDateMessages() {
  try {
    const allScheduledData = (await firebaseDb("lead_whatapp_send_by_date")) || {};
    if (!allScheduledData || typeof allScheduledData !== "object" || Object.keys(allScheduledData).length === 0) return;

    // Resolve Default Instance
    const config = (await firebaseDb("whatsapp_configuration/firstoptionagency")) || {};
    let defaultInstanceName = config.selectedInstanceName;

    if (!defaultInstanceName) {
      const fbInstances = (await firebaseDb("whatsapp_unofficial_instances")) || {};
      const instancesList = Object.values(fbInstances).filter(Boolean);
      const openInst = instancesList.find((i) => i.status === "open") || instancesList[0];
      if (openInst) defaultInstanceName = openInst.instanceName;
    }

    const nowMs = Date.now();

    for (const [cleanNumber, scheduleGroup] of Object.entries(allScheduledData)) {
      if (!scheduleGroup || typeof scheduleGroup !== "object") continue;

      for (const [schId, item] of Object.entries(scheduleGroup)) {
        if (!item || typeof item !== "object") continue;

        // Skip if already successfully sent
        if (item.status === "sent") continue;

        // If previously failed, retry after 15 seconds cooldown
        if (item.status === "failed" && item.lastAttemptAt) {
          const lastFailDiff = nowMs - new Date(item.lastAttemptAt).getTime();
          if (lastFailDiff < 15000) continue; // Wait 15s before retrying
        }

        const scheduledAtMs = new Date(item.scheduledAt).getTime();
        if (isNaN(scheduledAtMs)) continue;

        // Check if scheduled date/time has been reached
        if (nowMs >= scheduledAtMs - 5000) {
          const targetInstance = item.instanceName || defaultInstanceName;
          if (!targetInstance) {
            console.warn(`[Scheduled Worker ⚠️] No active WhatsApp instance available for scheduled message '${schId}'`);
            continue;
          }

          console.log(`[Scheduled Worker ⚡ DISPATCHING] Sending Date-Scheduled Message '${schId}' via instance '${targetInstance}' to ${cleanNumber}`);

          // Send Text Message via Evolution API
          const evoRes = await evoApiCall(`/message/sendText/${targetInstance}`, "POST", {
            number: cleanNumber,
            text: item.messageText || "",
          });

          const isSuccess = evoRes.ok;
          const attemptCount = (item.attempts || 0) + 1;
          const updateRecord = {
            ...item,
            status: isSuccess ? "sent" : "failed",
            sentAt: isSuccess ? new Date().toISOString() : null,
            lastAttemptAt: new Date().toISOString(),
            attempts: attemptCount,
            error: isSuccess ? null : (evoRes.data?.error || `HTTP ${evoRes.status}`),
            updatedAt: new Date().toISOString(),
          };

          // Update Firebase RTDB under /lead_whatapp_send_by_date/${cleanNumber}/${schId}
          await firebaseDb(`lead_whatapp_send_by_date/${cleanNumber}/${schId}`, "PUT", updateRecord);

          // Log in WhatsApp Logs
          const logId = `sch_log_${Date.now()}`;
          const logData = {
            id: logId,
            ruleTitle: `Scheduled Date Broadcast (${item.scheduledAtIST || item.scheduledAt})`,
            number: cleanNumber,
            leadName: item.leadName || cleanNumber,
            text: item.messageText,
            instanceName: targetInstance,
            status: isSuccess ? "sent" : "failed",
            error: updateRecord.error,
            timestamp: new Date().toISOString(),
          };

          await firebaseDb(`whatsapp_logs/${targetInstance}/${logId}`, "PUT", logData);
          await firebaseDb(`whatsapp_lead_logs/${cleanNumber}/${logId}`, "PUT", logData);

          console.log(`[Scheduled Worker ${isSuccess ? "✅ SUCCESS" : "❌ FAILED (Will retry in 15s)"}] Result for ${cleanNumber}: ${isSuccess ? "Sent successfully" : updateRecord.error}`);
        }
      }
    }
  } catch (err) {
    console.error("[Scheduled Worker Exception]:", err);
  }
}

// Start Background Daemon Cron Worker Interval (runs every 15 seconds)
setInterval(() => {
  evaluateStageAutomations().catch((err) => {
    console.error("[Pipeline Worker Interval Catch Error]:", err);
  });
  evaluateScheduledDateMessages().catch((err) => {
    console.error("[Scheduled Worker Interval Catch Error]:", err);
  });
}, 15000);

// Run initial evaluation on server startup
setTimeout(() => {
  evaluateStageAutomations().catch((err) => {
    console.error("[Pipeline Worker Startup Catch Error]:", err);
  });
  evaluateScheduledDateMessages().catch((err) => {
    console.error("[Scheduled Worker Startup Catch Error]:", err);
  });
}, 2000);

/**
 * POST /api/whatsapp/scheduled-message/add
 * Body: { phone: "919958399157", leadName: "mkmods", scheduledAt: "2026-07-25T13:00", instanceName: "mudassir", messageText: "..." }
 */
router.post("/scheduled-message/add", async (req, res) => {
  try {
    const { phone, leadName, scheduledAt, instanceName, messageText } = req.body;
    if (!phone || !scheduledAt || !messageText) {
      return res.status(400).json({ success: false, error: "phone, scheduledAt, and messageText are required" });
    }

    const cleanNumber = sanitizePhoneNumber(phone);
    const schId = `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Parse scheduled date/time in Indian Standard Time (IST UTC+5:30)
    let rawDateStr = String(scheduledAt).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(rawDateStr)) {
      if (!rawDateStr.includes(":00") && rawDateStr.split(":").length === 2) {
        rawDateStr += ":00";
      }
      rawDateStr += "+05:30"; // Enforce IST timezone offset
    }
    const scheduledDateObj = new Date(rawDateStr);

    const record = {
      id: schId,
      phone: cleanNumber,
      leadName: leadName || cleanNumber,
      scheduledAt: scheduledDateObj.toISOString(),
      scheduledAtIST: scheduledDateObj.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      instanceName: instanceName || "",
      messageText,
      status: "pending",
      attempts: 0,
      lastAttemptAt: null,
      sentAt: null,
      createdAt: new Date().toISOString(),
    };

    await firebaseDb(`lead_whatapp_send_by_date/${cleanNumber}/${schId}`, "PUT", record);

    // Trigger immediate evaluation check
    evaluateScheduledDateMessages().catch(() => {});

    return res.status(200).json({ success: true, message: "WhatsApp message scheduled successfully", data: record });
  } catch (err) {
    console.error("Add Scheduled Message Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/scheduled-message/delete
 * Body: { phone: "919958399157", schId: "sch_123" }
 */
router.post("/scheduled-message/delete", async (req, res) => {
  try {
    const { phone, schId } = req.body;
    if (!phone || !schId) {
      return res.status(400).json({ success: false, error: "phone and schId are required" });
    }

    const cleanNumber = sanitizePhoneNumber(phone);
    await firebaseDb(`lead_whatapp_send_by_date/${cleanNumber}/${schId}`, "DELETE");

    return res.status(200).json({ success: true, message: "Scheduled message deleted successfully" });
  } catch (err) {
    console.error("Delete Scheduled Message Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/evaluate-automations
 * Instant realtime trigger for automation evaluation
 */
router.post("/evaluate-automations", async (req, res) => {
  try {
    evaluateStageAutomations();
    evaluateScheduledDateMessages();
    return res.status(200).json({ success: true, message: "Stage automations evaluation triggered" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

