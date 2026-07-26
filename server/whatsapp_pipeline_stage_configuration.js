const express = require("express");
const router = express.Router();
const { createScheduledHttpTask, deleteScheduledHttpTask, listScheduledTasks } = require("./cloud_tasks");

// Configuration from Environment
const API_KEY = process.env.WHATSAPP_API_KEY || "vR39h6avY69g7kAU3YQbS6V6XEvudson";
const BASE_URL = (process.env.WHATSAPP_API_URL || "https://evo.infispark.in").replace(/\/$/, "");
const FIREBASE_DB_URL = (
  process.env.FIREBASE_DATABASE_URL ||
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  "https://firstoption-8da25-default-rtdb.firebaseio.com"
).replace(/\/$/, "");
const FIREBASE_DB_SECRET = process.env.FIREBASE_DB_SECRET || process.env.FIREBASE_DATABASE_SECRET || "";
const SERVER_PUBLIC_URL = (process.env.WHATSAPP_SERVER_URL || process.env.PUBLIC_APP_URL || "https://first.infiplus.in").replace(/\/$/, "");
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "valdho_gcp_tasks_sec_2026_x89";

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
      const errText = await res.text();
      console.error(`[Pipeline Worker] Firebase DB Error (${res.status}):`, errText);
      throw new Error(`Firebase DB HTTP ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (err) {
    console.error("[Pipeline Worker] Firebase DB Exception:", err.message || err);
    throw err;
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
 * Parse Date and Time String into JavaScript Date (Enforcing IST UTC+05:30)
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
      // Explicitly construct IST (+05:30) date object so server timezone doesn't offset it
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
      instanceName: rule.instanceName || "",
      triggerBase: rule.triggerBase || "created", // "meeting" | "created"
      offsetType: rule.offsetType || "after", // "before" | "after"
      offsetValue: Number(rule.offsetValue) || 1,
      offsetUnit: rule.offsetUnit || "minutes", // "minutes" | "hours" | "days"
      template: rule.template || "Hello {{name}}, reminder for your session at {{time}} on {{date}}!",
      isEnabled: rule.isEnabled !== false,
      applyToExisting: rule.applyToExisting !== false, // Condition 5 support
      createdAt: rule.createdAt || new Date().toISOString(),
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
   GOOGLE CLOUD TASKS EVENT-DRIVEN AUTOMATION ENGINE
   ========================================================================== */

/**
 * Condition 3: Lead Deletion (Zombie Messages)
 * Deletes all pending Cloud Tasks for a given lead and wipes the Firebase task tracking node.
 */
async function cancelAllLeadTasks(leadPhone) {
  try {
    const cleanPhone = sanitizePhoneNumber(leadPhone);
    if (!cleanPhone) return { success: false, error: "Invalid phone number" };

    console.log(`[Cloud Tasks 🧹] Canceling all scheduled tasks for lead '${cleanPhone}'...`);

    const activeTasksMap = (await firebaseDb(`whatsapp_scheduled_tasks/${cleanPhone}`)) || {};
    const taskEntries = Object.entries(activeTasksMap);

    if (taskEntries.length === 0) {
      console.log(`[Cloud Tasks ℹ️] No pending tasks found for lead '${cleanPhone}'.`);
      return { success: true, count: 0 };
    }

    for (const [taskId, taskRecord] of taskEntries) {
      if (!taskRecord) continue;
      const gcpTaskName = typeof taskRecord === "object" ? taskRecord.taskName : null;
      await deleteScheduledHttpTask({ taskId, taskName: gcpTaskName });
    }

    // Wipe tracking nodes in RTDB
    await firebaseDb(`whatsapp_scheduled_tasks/${cleanPhone}`, "DELETE");
    await firebaseDb(`whatsapp_lead_timers/${cleanPhone}`, "DELETE");

    console.log(`[Cloud Tasks ✅] Canceled ${taskEntries.length} pending tasks for lead '${cleanPhone}'.`);
    return { success: true, count: taskEntries.length };
  } catch (err) {
    console.error("[Cloud Tasks ❌] cancelAllLeadTasks Exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Unified Function: Sync Lead Automations
 * Calculates future execution times based on active stage rules and schedules Google Cloud Tasks.
 */
async function syncLeadAutomations(leadData, previousStage = null, previousMeetingTime = null) {
  try {
    if (!leadData) return { success: false, error: "leadData is required" };

    const cleanPhone = sanitizePhoneNumber(leadData.phone || leadData.number);
    if (!cleanPhone || cleanPhone.length < 5) {
      console.warn("[Cloud Tasks ⚠️] Lead has no valid phone number. Skipping automation sync.");
      return { success: false, error: "No valid phone number" };
    }

    const currentStage = leadData.pipelineStage || leadData.status || leadData.stage || "raw";
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

    const currentNorm = normStage(currentStage);
    const prevNorm = previousStage ? normStage(previousStage) : null;

    // Condition 1: Changing Pipeline Stages (Ghost Tasks)
    if (previousStage && prevNorm !== currentNorm) {
      console.log(`[Cloud Tasks 🔄] Stage change detected for lead ${cleanPhone}: '${previousStage}' -> '${currentStage}'. Purging ghost tasks...`);
      await cancelAllLeadTasks(cleanPhone);
    }

    // Condition 2: Changing Meeting Dates
    const currentMeetingDate = leadData.meeting?.meetingDate || leadData.meetingDate || leadData.date || "";
    const currentMeetingTime = leadData.meeting?.meetingTime || leadData.meetingTime || leadData.time || "";
    const currentMeetingKey = `${currentMeetingDate}_${currentMeetingTime}`;

    if (previousMeetingTime && previousMeetingTime !== currentMeetingKey) {
      console.log(`[Cloud Tasks 📅] Meeting date/time change detected for lead ${cleanPhone}: '${previousMeetingTime}' -> '${currentMeetingKey}'. Purging old meeting tasks...`);
      const activeTasksMap = (await firebaseDb(`whatsapp_scheduled_tasks/${cleanPhone}`)) || {};
      for (const [taskId, record] of Object.entries(activeTasksMap)) {
        if (record && record.triggerBase === "meeting") {
          await deleteScheduledHttpTask({ taskId, taskName: record.taskName });
          await firebaseDb(`whatsapp_scheduled_tasks/${cleanPhone}/${taskId}`, "DELETE");
        }
      }
    }

    // Fetch active rules from RTDB
    const allStageRulesObj = (await firebaseDb("whatsapp_stage_automations/firstoptionagency")) || {};
    const activeRules = [];
    for (const [sId, rulesMap] of Object.entries(allStageRulesObj)) {
      if (!rulesMap) continue;
      for (const rule of Object.values(rulesMap)) {
        if (rule && rule.isEnabled) {
          activeRules.push(rule);
        }
      }
    }

    // Resolve Default WhatsApp Instance
    const config = (await firebaseDb("whatsapp_configuration/firstoptionagency")) || {};
    let defaultInstanceName = config.selectedInstanceName;
    if (!defaultInstanceName) {
      const fbInstances = (await firebaseDb("whatsapp_unofficial_instances")) || {};
      const instancesList = Object.values(fbInstances).filter(Boolean);
      const openInst = instancesList.find((i) => i.status === "open") || instancesList[0];
      if (openInst) defaultInstanceName = openInst.instanceName;
    }

    const currentEquivs = stageEquivalents[currentNorm] || [currentNorm];

    let matchingRules = activeRules.filter((r) => {
      const rStgNorm = normStage(r.stageId);
      const rEquivs = stageEquivalents[rStgNorm] || [rStgNorm];
      return rEquivs.some((eq) => currentEquivs.includes(eq)) || (rStgNorm && currentNorm && (rStgNorm.includes(currentNorm) || currentNorm.includes(rStgNorm)));
    });

    // Auto Funnel Fallback Engine
    if (matchingRules.length === 0) {
      if (currentEquivs.includes("surveycompleted")) {
        const tpl = config.step2Survey?.template || "Hello {{name}}, thank you for completing our qualification survey! Your answers have been recorded. Proceed to select a meeting time slot to complete your booking.";
        matchingRules.push({
          id: "fallback_step2_survey",
          stageId: currentStage,
          title: "Auto Funnel: Step 2 Survey Completed",
          triggerBase: "created",
          offsetType: "after",
          offsetValue: 0,
          offsetUnit: "minutes",
          template: tpl,
          isEnabled: true,
        });
      } else if (currentEquivs.includes("inprogress") || currentEquivs.includes("raw")) {
        const tpl = config.step1Welcome?.template || "Hello {{name}}, thank you for contacting First Option Agency! We have received your contact details. Our team will get back to you shortly.";
        matchingRules.push({
          id: "fallback_step1_welcome",
          stageId: currentStage,
          title: "Auto Funnel: Step 1 Contact Welcome",
          triggerBase: "created",
          offsetType: "after",
          offsetValue: 0,
          offsetUnit: "minutes",
          template: tpl,
          isEnabled: true,
        });
      } else if (currentEquivs.includes("meetingbooked")) {
        const tpl = config.step3Meeting?.template || "🎉 Meeting Confirmed! Hello {{name}}, your strategy session with First Option Agency is booked for {{date}} at {{time}}. Join video call: {{meeting_url}}";
        matchingRules.push({
          id: "fallback_step3_meeting",
          stageId: currentStage,
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

    const nowMs = Date.now();
    const scheduledTaskResults = [];

    for (const rule of matchingRules) {
      // Condition 5: Retroactive Rule Creation (applyToExisting check)
      if (rule.applyToExisting === false) {
        const leadCreatedTime = new Date(leadData.stageMovedAt || leadData.createdAt || leadData.createdDate || 0).getTime();
        const ruleCreatedTime = new Date(rule.createdAt || 0).getTime();
        if (ruleCreatedTime > 0 && leadCreatedTime > 0 && leadCreatedTime < ruleCreatedTime) {
          console.log(`[Cloud Tasks ⏭️] Skipping rule '${rule.title}' for lead ${cleanPhone}: rule.applyToExisting is false and lead was created before rule.`);
          continue;
        }
      }

      let referenceDate = null;
      let meetingKey = "";

      if (rule.triggerBase === "meeting") {
        if (currentStage === "won" || currentStage === "not_qualified") continue;
        if (!currentMeetingDate) {
          console.log(`[Cloud Tasks ℹ️] Lead ${cleanPhone} has no meeting date set. Skipping rule '${rule.title}'.`);
          continue;
        }

        // Condition 6: Timezone Accuracy in IST (+05:30)
        referenceDate = parseMeetingDateTime(currentMeetingDate, currentMeetingTime);
        if (!referenceDate || isNaN(referenceDate.getTime())) {
          console.warn(`[Cloud Tasks ⚠️] Failed to parse IST meeting date/time '${currentMeetingDate}' '${currentMeetingTime}' for ${cleanPhone}`);
          continue;
        }
        meetingKey = (String(currentMeetingDate) + "_" + String(currentMeetingTime)).replace(/\D/g, "");
      } else {
        const rawReference = leadData.stageMovedAt || leadData.createdAt || leadData.createdDate || leadData.timestamp;
        referenceDate = rawReference ? new Date(rawReference) : new Date();
        meetingKey = String(rawReference || "").replace(/\D/g, "").slice(0, 12) || "init";
      }

      if (!referenceDate || isNaN(referenceDate.getTime())) continue;

      let offsetMs = Number(rule.offsetValue) * 60 * 1000;
      if (rule.offsetUnit === "hours") offsetMs = Number(rule.offsetValue) * 3600 * 1000;
      if (rule.offsetUnit === "days") offsetMs = Number(rule.offsetValue) * 86400 * 1000;
      if (offsetMs <= 0) offsetMs = 10000;

      let scheduledTriggerTimeMs = 0;
      let triggerKey = "";

      if (rule.offsetType === "before") {
        scheduledTriggerTimeMs = referenceDate.getTime() - offsetMs;
        triggerKey = `auto_${cleanPhone}_stg_${currentStage}_rule_${rule.id}_m_${meetingKey || "bef"}`;
      } else {
        scheduledTriggerTimeMs = referenceDate.getTime() + offsetMs;
        triggerKey = `auto_${cleanPhone}_stg_${currentStage}_rule_${rule.id}_aft_${meetingKey || "aft"}`;
      }

      // Guard against Late Reminder Blast: Skip 'before meeting' rules if the meeting is already in the past
      if (rule.triggerBase === "meeting" && rule.offsetType === "before") {
        if (nowMs > referenceDate.getTime()) {
          console.log(`[Cloud Tasks ⏭️] Skipping 'before' rule '${rule.title}' because meeting is in the past.`);
          continue;
        }
      }

      // STRICT LOCKOUT: Prevent double-scheduling from rapid-fire API requests
      const idempotencyNode = await firebaseDb(`whatsapp_sent_automations/${triggerKey}`);
      if (idempotencyNode) {
        if (idempotencyNode.status === "sent") {
          console.log(`[Cloud Tasks ⏩] Trigger '${triggerKey}' ALREADY EXECUTED for ${cleanPhone}.`);
          continue;
        }
        if (idempotencyNode.status === "pending" || idempotencyNode.status === "scheduled") {
          console.log(`[Cloud Tasks 🛡️] Duplicate API request blocked. Trigger '${triggerKey}' is already scheduled.`);
          continue;
        }
      }

      // Immediately write a "pending" lock to Firebase to block the twin request
      await firebaseDb(`whatsapp_sent_automations/${triggerKey}`, "PUT", {
        status: "pending",
        lockedAt: new Date().toISOString(),
      });

      const scheduledSeconds = Math.floor(scheduledTriggerTimeMs / 1000);
      const currentSeconds = Math.floor(nowMs / 1000);

      const targetSeconds = scheduledSeconds < currentSeconds - 120 ? currentSeconds + 5 : Math.max(currentSeconds + 5, scheduledSeconds);

      const taskId = `task_${cleanPhone}_${rule.id}_${meetingKey || "t"}_${targetSeconds}`;
      const webhookUrl = `${SERVER_PUBLIC_URL}/api/whatsapp/execute-task`;

      const webhookPayload = {
        taskId,
        leadPhone: cleanPhone,
        leadId: leadData.id || leadData.email || cleanPhone,
        leadName: leadData.fullName || cleanPhone,
        leadPath: leadData._path || (leadData.campaign && leadData.createdDate && leadData.id ? `campaigns/${leadData.campaign}/leads/${leadData.createdDate}/${leadData.id}` : null),
        stageId: currentStage,
        ruleId: rule.id,
        ruleTitle: rule.title,
        triggerKey,
        triggerBase: rule.triggerBase,
        offsetType: rule.offsetType,
        offsetValue: rule.offsetValue,
        offsetUnit: rule.offsetUnit,
        template: rule.template,
        instanceName: rule.instanceName || defaultInstanceName,
        meetingDate: currentMeetingDate,
        meetingTime: currentMeetingTime,
        scheduledTimeMs: targetSeconds * 1000,
        createdAt: new Date().toISOString(),
      };

      const taskResult = await createScheduledHttpTask({
        taskId,
        url: webhookUrl,
        payload: webhookPayload,
        scheduleTimeSeconds: targetSeconds,
      });

      if (taskResult.success) {
        const trackingRecord = {
          taskId,
          taskName: taskResult.taskName,
          phone: cleanPhone,
          ruleId: rule.id,
          ruleTitle: rule.title,
          stageId: currentStage,
          scheduledAt: new Date(targetSeconds * 1000).toISOString(),
          scheduledTimeMs: targetSeconds * 1000,
          triggerBase: rule.triggerBase,
          offsetType: rule.offsetType,
          status: "scheduled",
          updatedAt: new Date().toISOString(),
        };
        await firebaseDb(`whatsapp_scheduled_tasks/${cleanPhone}/${taskId}`, "PUT", trackingRecord);

        await firebaseDb(`whatsapp_lead_timers/${cleanPhone}`, "PUT", {
          phone: cleanPhone,
          leadName: leadData.fullName || cleanPhone,
          leadStage: currentStage,
          ruleId: rule.id,
          ruleTitle: rule.title,
          nextTriggerTimeMs: targetSeconds * 1000,
          nextTriggerTimeIST: new Date(targetSeconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
          remainingSeconds: Math.max(0, targetSeconds - currentSeconds),
          status: "scheduled_cloud_task",
          updatedAt: new Date().toISOString(),
        });

        scheduledTaskResults.push(trackingRecord);
      }
    }

    return { success: true, count: scheduledTaskResults.length, tasks: scheduledTaskResults };
  } catch (err) {
    console.error("[Cloud Tasks ❌] syncLeadAutomations Exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Condition 4: Idempotency & State Verification Webhook Endpoint
 * Executed by Google Cloud Tasks HTTP trigger when scheduled time arrives.
 * POST /api/whatsapp/execute-task
 */
router.post("/execute-task", async (req, res) => {
  try {
    // 1. Verify Webhook Secret Header
    const secretHeader = req.headers["x-webhook-secret"];
    if (secretHeader && secretHeader !== WEBHOOK_SECRET) {
      console.warn("[Cloud Tasks Executor ⚠️] Unauthorized execution attempt with invalid secret header.");
      return res.status(401).json({ success: false, error: "Unauthorized webhook request" });
    }

    const {
      taskId,
      leadPhone,
      leadId,
      leadName,
      leadPath,
      stageId,
      ruleId,
      ruleTitle,
      triggerKey,
      triggerBase,
      offsetType,
      offsetValue,
      offsetUnit,
      template,
      instanceName,
      meetingDate,
      meetingTime,
    } = req.body;

    if (!leadPhone || !triggerKey || !template) {
      return res.status(400).json({ success: false, error: "Missing required task payload parameters" });
    }

    const cleanNumber = sanitizePhoneNumber(leadPhone);

    console.log(`[Cloud Tasks Executor ⚡] Executing Task '${taskId}' for lead '${cleanNumber}' (Rule: '${ruleTitle}')`);

    // 2. Targeted Single-Lead RTDB Fetch (Fast Route: 1 API call, tiny payload)
    let currentLead = null;

    if (leadPath) {
      try {
        const cleanPath = String(leadPath).replace(/^\//, "").replace(/\.json$/, "");
        const fetched = await firebaseDb(cleanPath);
        if (fetched && typeof fetched === "object" && (fetched.phone || fetched.fullName || fetched.pipelineStage)) {
          currentLead = { ...fetched, _path: cleanPath };
        }
      } catch (err) {
        console.warn(`[Cloud Tasks Executor ⚠️] Direct fetch failed for leadPath '${leadPath}': ${err.message}. Falling back to search.`);
      }
    }

    if (!currentLead) {
      // Fallback Route: Only if leadPath is missing or direct fetch returned null
      console.warn(`[Cloud Tasks Executor ⚠️] leadPath missing or failed for ${cleanNumber}, performing fallback RTDB search.`);
      const campaignsData = (await firebaseDb("campaigns")) || {};
      const leadsData = (await firebaseDb("leads")) || {};
      const allLeads = [
        ...extractLeadsFromFirebaseData(campaignsData, [], "campaigns"),
        ...extractLeadsFromFirebaseData(leadsData, [], "leads"),
      ];
      currentLead = allLeads.find((l) => sanitizePhoneNumber(l.phone) === cleanNumber);
    }

    if (!currentLead) {
      console.warn(`[Cloud Tasks Executor 🛑 ABORT] Lead '${cleanNumber}' no longer exists in Firebase. Skipping task execution.`);
      if (taskId) await firebaseDb(`whatsapp_scheduled_tasks/${cleanNumber}/${taskId}`, "DELETE");
      return res.status(200).json({ success: true, skipped: true, reason: "Lead deleted from database" });
    }

    // Check Stage Alignment (Condition 4)
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

    const currentLeadStage = currentLead.pipelineStage || currentLead.status || currentLead.stage || "raw";
    const currentLeadNorm = normStage(currentLeadStage);
    const ruleStageNorm = normStage(stageId);

    const leadEquivs = stageEquivalents[currentLeadNorm] || [currentLeadNorm];
    const ruleEquivs = stageEquivalents[ruleStageNorm] || [ruleStageNorm];

    const isStageMatching = leadEquivs.some((eq) => ruleEquivs.includes(eq)) || (ruleStageNorm && currentLeadNorm && (ruleStageNorm.includes(currentLeadNorm) || currentLeadNorm.includes(ruleStageNorm)));

    if (!isStageMatching) {
      console.warn(`[Cloud Tasks Executor 🛑 ABORT] Lead '${cleanNumber}' stage in RTDB ('${currentLeadStage}') no longer matches rule stage ('${stageId}'). Aborting task execution.`);
      if (taskId) await firebaseDb(`whatsapp_scheduled_tasks/${cleanNumber}/${taskId}`, "DELETE");
      return res.status(200).json({ success: true, skipped: true, reason: `Stage mismatch: current stage is ${currentLeadStage}, rule stage is ${stageId}` });
    }

    // 3. Double-Send Check (Idempotency Check)
    const alreadySent = await firebaseDb(`whatsapp_sent_automations/${triggerKey}`);
    if (alreadySent && alreadySent.status === "sent") {
      console.log(`[Cloud Tasks Executor 🛑 ABORT] Trigger key '${triggerKey}' was already executed at ${alreadySent.sentAt}. Skipping duplicate send.`);
      if (taskId) await firebaseDb(`whatsapp_scheduled_tasks/${cleanNumber}/${taskId}`, "DELETE");
      return res.status(200).json({ success: true, skipped: true, reason: "Already executed" });
    }

    // Resolve Instance Name
    const config = (await firebaseDb("whatsapp_configuration/firstoptionagency")) || {};
    let targetInstance = instanceName || config.selectedInstanceName;
    if (!targetInstance) {
      const fbInstances = (await firebaseDb("whatsapp_unofficial_instances")) || {};
      const instancesList = Object.values(fbInstances).filter(Boolean);
      const openInst = instancesList.find((i) => i.status === "open") || instancesList[0];
      if (openInst) targetInstance = openInst.instanceName;
    }

    if (!targetInstance) {
      console.error(`[Cloud Tasks Executor ❌] No active WhatsApp instance available for task '${taskId}'`);
      return res.status(500).json({ success: false, error: "No active WhatsApp instance available" });
    }

    // 4. Format Dynamic Message Template
    const formattedDate = currentLead.meeting?.meetingDate || currentLead.meetingDate || meetingDate || "Upcoming Date";
    const formattedTime = currentLead.meeting?.meetingTime || currentLead.meetingTime || meetingTime || "Scheduled Time";
    const resolvedMeetingUrl =
      currentLead.meeting?.meetingUrl ||
      currentLead.links?.meetingUrl ||
      currentLead.meetingUrl ||
      config.defaultMeetingUrl ||
      "https://meet.google.com/firstoption-strategy-call";

    const textMessage = template
      .replace(/\{\{\s*name\s*\}\}/gi, currentLead.fullName || leadName || "Valued Client")
      .replace(/\{\{\s*email\s*\}\}/gi, currentLead.email || "N/A")
      .replace(/\{\{\s*phone\s*\}\}/gi, currentLead.phone || "N/A")
      .replace(/\{\{\s*date\s*\}\}/gi, formattedDate)
      .replace(/\{\{\s*time\s*\}\}/gi, formattedTime)
      .replace(/\{\{\s*meeting_url\s*\}\}/gi, resolvedMeetingUrl)
      .replace(/\{\{\s*meeting_link\s*\}\}/gi, resolvedMeetingUrl)
      .replace(/\{\{\s*meetingUrl\s*\}\}/gi, resolvedMeetingUrl)
      .replace(/\{\{\s*meetingLink\s*\}\}/gi, resolvedMeetingUrl)
      .replace(/\{\{\s*link\s*\}\}/gi, resolvedMeetingUrl)
      .replace(/\{\{\s*stage\s*\}\}/gi, currentLeadStage);

    console.log(`[Cloud Tasks Executor 🚀 DISPATCH] Sending WhatsApp message via '${targetInstance}' to ${cleanNumber}...`);

    // 5. Send WhatsApp Message via Evolution API
    const evoRes = await evoApiCall(`/message/sendText/${targetInstance}`, "POST", {
      number: cleanNumber,
      text: textMessage,
    });

    const isSuccess = evoRes.ok;

    // 6. Record Guard Flag status
    await firebaseDb(`whatsapp_sent_automations/${triggerKey}`, "PUT", {
      sentAt: new Date().toISOString(),
      status: isSuccess ? "sent" : "failed",
      failedAt: isSuccess ? null : new Date().toISOString(),
      leadId: currentLead.leadId || currentLead.id || cleanNumber,
      ruleId,
      phone: cleanNumber,
      instanceName: targetInstance,
      error: isSuccess ? null : (evoRes.data?.error || evoRes.data?.message || `HTTP ${evoRes.status}`),
    });

    // 7. Log into Realtime Activity Logs
    const logId = `auto_stage_${Date.now()}`;
    const logData = {
      id: logId,
      type: "auto_stage_automation",
      ruleTitle: ruleTitle || "Stage Automation",
      stageId: currentLeadStage,
      number: cleanNumber,
      leadName: currentLead.fullName || leadName || cleanNumber,
      text: textMessage,
      instanceName: targetInstance,
      status: isSuccess ? "sent" : "failed",
      error: isSuccess ? null : (evoRes.data?.error || evoRes.data?.message || `HTTP ${evoRes.status}`),
      timestamp: new Date().toISOString(),
    };

    await firebaseDb(`whatsapp_logs/${targetInstance}/${logId}`, "PUT", logData);
    await firebaseDb(`whatsapp_lead_logs/${cleanNumber}/${logId}`, "PUT", logData);

    // 8. Clean up task tracking node on success
    if (taskId && isSuccess) {
      await firebaseDb(`whatsapp_scheduled_tasks/${cleanNumber}/${taskId}`, "DELETE");
    }

    // 9. Handle Retries & Recurrence
    if (!isSuccess) {
      console.warn(`[Cloud Tasks Executor ⚠️] WhatsApp dispatch failed. Returning 500 to trigger GCP Task Retry.`);
      return res.status(500).json({
        success: false,
        error: evoRes.data?.error || evoRes.data?.message || `Evolution API dispatch failed (HTTP ${evoRes.status})`,
        logId,
      });
    }



    return res.status(200).json({
      success: true,
      message: "Task executed successfully",
      logId,
    });
  } catch (err) {
    console.error("[Cloud Tasks Executor Exception]:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/scheduled-message/add
 * Schedule a single exact date WhatsApp message using Google Cloud Tasks
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
    const scheduleTimeSeconds = Math.floor(scheduledDateObj.getTime() / 1000);

    const taskId = `task_sch_${cleanNumber}_${schId}`;
    const webhookUrl = `${SERVER_PUBLIC_URL}/api/whatsapp/execute-task`;

    const record = {
      id: schId,
      taskId,
      phone: cleanNumber,
      leadName: leadName || cleanNumber,
      scheduledAt: scheduledDateObj.toISOString(),
      scheduledAtIST: scheduledDateObj.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      instanceName: instanceName || "",
      messageText,
      status: "pending",
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    // 1. Save in Firebase RTDB
    await firebaseDb(`lead_whatapp_send_by_date/${cleanNumber}/${schId}`, "PUT", record);

    // 2. Schedule Google Cloud Task HTTP Webhook
    const taskResult = await createScheduledHttpTask({
      taskId,
      url: webhookUrl,
      payload: {
        taskId,
        leadPhone: cleanNumber,
        leadId: cleanNumber,
        leadName: leadName || cleanNumber,
        stageId: "custom_scheduled_message",
        ruleId: schId,
        ruleTitle: `Scheduled Date Message (${record.scheduledAtIST})`,
        triggerKey: `custom_sch_${cleanNumber}_${schId}`,
        triggerBase: "custom",
        offsetType: "custom",
        template: messageText,
        instanceName: instanceName || "",
      },
      scheduleTimeSeconds: Math.max(Math.floor(Date.now() / 1000) + 5, scheduleTimeSeconds),
    });

    if (taskResult.success) {
      await firebaseDb(`whatsapp_scheduled_tasks/${cleanNumber}/${taskId}`, "PUT", {
        taskId,
        taskName: taskResult.taskName,
        phone: cleanNumber,
        ruleId: schId,
        ruleTitle: `Scheduled Message (${record.scheduledAtIST})`,
        scheduledAt: scheduledDateObj.toISOString(),
        status: "scheduled",
      });
    }

    return res.status(200).json({ success: true, message: "WhatsApp message scheduled successfully via Cloud Tasks", data: record });
  } catch (err) {
    console.error("Add Scheduled Message Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/scheduled-message/delete
 * Cancels scheduled message task from GCP Cloud Tasks and deletes from Firebase RTDB
 */
router.post("/scheduled-message/delete", async (req, res) => {
  try {
    const { phone, schId } = req.body;
    if (!phone || !schId) {
      return res.status(400).json({ success: false, error: "phone and schId are required" });
    }

    const cleanNumber = sanitizePhoneNumber(phone);
    const taskId = `task_sch_${cleanNumber}_${schId}`;

    await deleteScheduledHttpTask({ taskId });
    await firebaseDb(`lead_whatapp_send_by_date/${cleanNumber}/${schId}`, "DELETE");
    await firebaseDb(`whatsapp_scheduled_tasks/${cleanNumber}/${taskId}`, "DELETE");

    return res.status(200).json({ success: true, message: "Scheduled message deleted successfully" });
  } catch (err) {
    console.error("Delete Scheduled Message Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/whatsapp/scheduled-tasks/list
 */
router.get("/scheduled-tasks/list", async (req, res) => {
  try {
    const result = await listScheduledTasks();
    if (!result.success) return res.status(500).json(result);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/sync-lead
 * Endpoint to trigger syncLeadAutomations for a lead
 */
router.post("/sync-lead", async (req, res) => {
  try {
    const { leadData, previousStage, previousMeetingTime } = req.body;
    if (!leadData) {
      return res.status(400).json({ success: false, error: "leadData is required" });
    }

    const result = await syncLeadAutomations(leadData, previousStage, previousMeetingTime);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Sync Lead API Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/cancel-lead-tasks
 * Endpoint to cancel all pending Cloud Tasks for a lead (e.g. on lead deletion)
 */
router.post("/cancel-lead-tasks", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: "phone is required" });
    }

    const result = await cancelAllLeadTasks(phone);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Cancel Lead Tasks API Exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.syncLeadAutomations = syncLeadAutomations;
module.exports.cancelAllLeadTasks = cancelAllLeadTasks;
