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

/**
 * Firebase Realtime Database REST API Helper
 */
async function firebaseDb(path, method = "GET", body = null) {
  try {
    const url = `${FIREBASE_DB_URL}/${path}.json`;
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
    const cleanDate = dateStr.trim();
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

    const isoStr = `${cleanDate}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`;
    const dt = new Date(isoStr);
    return isNaN(dt.getTime()) ? null : dt;
  } catch (err) {
    return null;
  }
}

/**
 * Recursive Lead Extractor - Traverses campaigns & leads nodes in Firebase RTDB
 */
function extractLeadsFromFirebaseData(obj, foundLeads = [], path = "") {
  if (!obj || typeof obj !== "object") return foundLeads;

  // If object has phone and name or email, it's a valid lead
  if (obj.phone && (obj.fullName || obj.email || obj.pipelineStage)) {
    // Generate deterministic ID if missing
    const leadId = obj.id || obj.email || `lead_${foundLeads.length + 1}`;
    foundLeads.push({ ...obj, leadId, _path: path });
    return foundLeads;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object") {
      extractLeadsFromFirebaseData(value, foundLeads, `${path}/${key}`);
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

async function evaluateStageAutomations() {
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

    // Deduplicate leads by phone number / email
    const uniqueLeadsMap = new Map();
    for (const l of rawLeadsList) {
      const key = (l.phone || l.email || l.leadId).toString();
      if (!uniqueLeadsMap.has(key)) {
        uniqueLeadsMap.set(key, l);
      }
    }

    const allLeads = Array.from(uniqueLeadsMap.values());
    const nowMs = Date.now();

    // 4. Evaluate each lead against matching stage rules
    for (const lead of allLeads) {
      const leadStage = lead.pipelineStage || "raw";
      const matchingRules = activeRules.filter((r) => r.stageId === leadStage);

      if (matchingRules.length === 0) continue;

      for (const rule of matchingRules) {
        // Resolve Target Instance Name for this rule
        const targetInstance = rule.instanceName || defaultInstanceName;
        if (!targetInstance) {
          console.warn(`[Pipeline Worker ⚠️] No active WhatsApp instance available for rule "${rule.title}"`);
          continue;
        }

        let referenceDate = null;

        if (rule.triggerBase === "meeting") {
          if (!lead.meeting || !lead.meeting.meetingDate) {
            continue; // Skip if missing meeting details
          }
          referenceDate = parseMeetingDateTime(lead.meeting.meetingDate, lead.meeting.meetingTime);
        } else {
          // Fallbacks for creation timestamp
          const rawCreated = lead.createdAt || lead.createdDate || lead.timestamp || lead.meeting?.bookedAt;
          referenceDate = rawCreated ? new Date(rawCreated) : new Date();
        }

        if (!referenceDate || isNaN(referenceDate.getTime())) continue;

        // Calculate offset in milliseconds
        let offsetMs = Number(rule.offsetValue) * 60 * 1000; // default minutes
        if (rule.offsetUnit === "hours") offsetMs = Number(rule.offsetValue) * 3600 * 1000;
        if (rule.offsetUnit === "days") offsetMs = Number(rule.offsetValue) * 86400 * 1000;
        if (offsetMs <= 0) offsetMs = 60000; // minimum 1 minute

        let scheduledTriggerTimeMs = 0;
        let triggerKey = "";

        if (rule.offsetType === "recurring") {
          const elapsedMs = Math.max(0, nowMs - referenceDate.getTime());
          const intervalIndex = Math.floor(elapsedMs / offsetMs);

          scheduledTriggerTimeMs = referenceDate.getTime() + (intervalIndex * offsetMs);
          triggerKey = `auto_${lead.leadId || lead.phone}_${rule.id}_seq_${intervalIndex}`;
        } else if (rule.offsetType === "before") {
          scheduledTriggerTimeMs = referenceDate.getTime() - offsetMs;
          triggerKey = `auto_${lead.leadId || lead.phone}_${rule.id}_before`;
        } else {
          // after
          scheduledTriggerTimeMs = referenceDate.getTime() + offsetMs;
          triggerKey = `auto_${lead.leadId || lead.phone}_${rule.id}_after`;
        }

        // Window check: execute if current time has reached or passed scheduledTriggerTimeMs
        const diffMs = nowMs - scheduledTriggerTimeMs;
        const isTimeReached = diffMs >= -30000; // within 30s before or anytime after target

        if (!isTimeReached) continue;

        // Guard Check: Verify if this specific trigger key has already been executed
        const alreadySent = await firebaseDb(`whatsapp_sent_automations/${triggerKey}`);
        if (alreadySent) continue; // Already executed

        // Format Dynamic Message Template
        const formattedDate = lead.meeting?.meetingDate || "Upcoming Date";
        const formattedTime = lead.meeting?.meetingTime || "Scheduled Time";

        const textMessage = rule.template
          .replace(/\{\{\s*name\s*\}\}/gi, lead.fullName || "Valued Client")
          .replace(/\{\{\s*email\s*\}\}/gi, lead.email || "N/A")
          .replace(/\{\{\s*phone\s*\}\}/gi, lead.phone || "N/A")
          .replace(/\{\{\s*date\s*\}\}/gi, formattedDate)
          .replace(/\{\{\s*time\s*\}\}/gi, formattedTime);

        const cleanNumber = sanitizePhoneNumber(lead.phone);

        console.log(`[Pipeline Worker ⚡] Triggering WhatsApp Rule "${rule.title}" via instance '${targetInstance}' to ${lead.fullName} (${cleanNumber})`);

        // Send Text Message via Evolution API
        const evoRes = await evoApiCall(`/message/sendText/${targetInstance}`, "POST", {
          number: cleanNumber,
          text: textMessage,
        });

        // Record Guard Flag to prevent duplicate sends
        await firebaseDb(`whatsapp_sent_automations/${triggerKey}`, "PUT", {
          sentAt: new Date().toISOString(),
          status: evoRes.ok ? "sent" : "failed",
          leadId: lead.leadId || lead.phone,
          ruleId: rule.id,
          phone: cleanNumber,
          instanceName: targetInstance,
        });

        // Log into Activity Logs
        const logId = `auto_stage_${Date.now()}`;
        await firebaseDb(`whatsapp_logs/${targetInstance}/${logId}`, "PUT", {
          id: logId,
          type: "auto_stage_automation",
          ruleTitle: rule.title,
          stageId: leadStage,
          number: cleanNumber,
          text: textMessage,
          status: evoRes.ok ? "sent" : "failed",
          error: evoRes.ok ? null : (evoRes.data?.error || "Send failed"),
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("[Pipeline Worker Daemon Exception]:", err);
  }
}

// Start Background Daemon Cron Worker Interval (runs every 15 seconds for instant 1m execution)
setInterval(() => {
  evaluateStageAutomations();
}, 15000);

// Run initial evaluation on server startup
setTimeout(() => {
  evaluateStageAutomations();
}, 2000);

module.exports = router;
