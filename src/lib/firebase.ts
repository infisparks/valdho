import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, update, get, set, push } from "firebase/database";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from "firebase/auth";
import { CAMPAIGNS } from "@/config/campaigns";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getDatabase(app);
export const auth = getAuth(app);

const WHATSAPP_SERVER_URL = (
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL
    ? process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL
    : "https://first.infiplus.in"
).replace(/\/$/, "");

const syncDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Helper: Triggers Google Cloud Tasks sync for a lead after creation, stage update, or meeting update (Debounced 400ms)
 */
export async function syncLeadCloudTasks(
  leadData: any,
  previousStage?: string | null,
  previousMeetingTime?: string | null
): Promise<void> {
  try {
    if (!leadData || !leadData.phone) return;
    const cleanPhone = String(leadData.phone).replace(/\D/g, "");
    const debounceKey = `sync_${cleanPhone || leadData.id || leadData.email}`;

    if (syncDebounceTimers.has(debounceKey)) {
      clearTimeout(syncDebounceTimers.get(debounceKey)!);
    }

    syncDebounceTimers.set(
      debounceKey,
      setTimeout(async () => {
        syncDebounceTimers.delete(debounceKey);
        try {
          await fetch(`${WHATSAPP_SERVER_URL}/api/whatsapp/sync-lead`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leadData,
              previousStage,
              previousMeetingTime,
            }),
          });
        } catch (err) {
          console.error("syncLeadCloudTasks Exception:", err);
        }
      }, 400)
    );
  } catch (err) {
    console.error("syncLeadCloudTasks Exception:", err);
  }
}

/**
 * Helper: Cancels all pending Google Cloud Tasks when a lead is deleted or disqualified
 */
export async function cancelLeadCloudTasks(phone: string): Promise<void> {
  try {
    if (!phone) return;
    await fetch(`${WHATSAPP_SERVER_URL}/api/whatsapp/cancel-lead-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
  } catch (err) {
    console.error("cancelLeadCloudTasks Exception:", err);
  }
}


export interface SurveyData {
  industry?: string;
  role?: string;
  revenue?: string;
  investmentReady?: string;
  [key: string]: any;
}

export interface MeetingData {
  meetingDate?: string;
  meetingTime?: string;
  bookedAt?: string;
  rescheduledAt?: string;
  meetingUrl?: string;
}

export interface StaffNote {
  id: string;
  text: string;
  createdAt: string;
  author?: string;
}

export interface LeadData {
  id?: string;
  campaign?: string;
  createdDate?: string;
  createdAt?: string;
  updatedAt?: string;
  fullName: string;
  email: string;
  phone: string;
  countryCode: string;
  status: "partial" | "survey_completed" | "completed";
  pipelineStage?: string; // "raw" | "in_progress" | "survey_completed" | "meeting_booked" | "proposal_sent" | "won" | "not_qualified"
  stageMovedAt?: string;
  dealValue?: number; // e.g. 50000 (represented in ₹)
  survey?: SurveyData;
  meeting?: MeetingData;
  notes?: StaffNote[];
  followUpDate?: string;
  onboarded?: boolean;
  onboardedAt?: string;
  onboardCount?: number;
  links?: {
    surveyUrl?: string;
    meetingUrl?: string;
  };
}

export interface OnboardRecord {
  id: string;
  leadId: string;
  fullName: string;
  email: string;
  phone: string;
  countryCode: string;
  campaign: string;
  onboardedAt: string;
  onboardedDate: string;
  onboardedBy?: string;
  dealValue?: number;
  survey?: SurveyData;
  meeting?: MeetingData;
  notes?: StaffNote[];
  followUpDate?: string;
}

export interface SaveLeadResult {
  leadId: string;
  createdDate: string;
  leadData?: LeadData;
}

/**
 * Sanitize email prefix (before @) to serve as deterministic Firebase Node ID.
 * Example: mk@gmail.com -> "mk", testing1@gmail.com -> "testing1"
 */
export function sanitizeEmailToId(email: string): string {
  if (!email || !email.includes("@")) {
    return "lead_" + Date.now();
  }
  const prefix = email.split("@")[0].trim().toLowerCase();
  const cleanId = prefix.replace(/[^a-z0-9_]/g, "_");
  return cleanId || "lead_" + Date.now();
}

/**
 * Helper: Convert time string like "09:00 AM" to Firebase key "09_00_AM"
 */
export function sanitizeSlotKey(time: string): string {
  return time.replace(/[^a-zA-Z0-9]/g, "_");
}

/**
 * Fetch booked slots for a specific date under path:
 * slots/[campaignName]/[appointmentDate]
 */
export async function getBookedSlotsForDate(
  appointmentDate: string,
  campaignName: string = "firstoptionagency"
): Promise<Record<string, boolean>> {
  try {
    const slotsRef = ref(db, `slots/${campaignName}/${appointmentDate}`);
    const snapshot = await get(slotsRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const bookedMap: Record<string, boolean> = {};
      
      if (data._blockedDate && data._blockedDate.blocked) {
        bookedMap["_blockedDate"] = true;
      }

      Object.keys(data).forEach((key) => {
        if (key === "_blockedDate") return;
        if (data[key] && (data[key].booked || data[key].blocked)) {
          bookedMap[key] = true;
        }
      });
      return bookedMap;
    }
    return {};
  } catch (error) {
    console.error("Firebase getBookedSlotsForDate Error:", error);
    return {};
  }
}

/**
 * Standard daily time slots matching system configuration
 */
export const DEFAULT_DAILY_TIME_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "02:00 PM",
  "03:00 PM",
  "07:00 PM",
  "09:00 PM",
];

/**
 * Mark a full date or range of dates as booked/blocked in Firebase CRM
 */
export async function markDateAsBooked(
  startDateStr: string,
  endDateStr: string,
  reason: string = "Marked as booked by admin",
  campaignName: string = "firstoptionagency"
): Promise<{ success: boolean; message: string }> {
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { success: false, message: "Invalid date range selected." };
    }

    const updates: Record<string, any> = {};
    const curr = new Date(start);

    while (curr <= end) {
      const year = curr.getFullYear();
      const month = String(curr.getMonth() + 1).padStart(2, "0");
      const day = String(curr.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      updates[`slots/${campaignName}/${dateStr}/_blockedDate`] = {
        blocked: true,
        date: dateStr,
        reason: reason || "Marked as booked",
        createdAt: Date.now(),
      };

      DEFAULT_DAILY_TIME_SLOTS.forEach((slotTime) => {
        const slotKey = sanitizeSlotKey(slotTime);
        updates[`slots/${campaignName}/${dateStr}/${slotKey}`] = {
          booked: true,
          blocked: true,
          reason: reason || "Marked as booked",
          bookedAt: Date.now(),
        };
      });

      curr.setDate(curr.getDate() + 1);
    }

    await update(ref(db), updates);
    return { success: true, message: "Dates marked as booked successfully." };
  } catch (error: any) {
    console.error("Firebase markDateAsBooked Error:", error);
    return { success: false, message: error.message || "Failed to mark dates as booked." };
  }
}

/**
 * Mark specific time slots on a date as booked/blocked in Firebase CRM
 */
export async function markSlotsAsBooked(
  dateStr: string,
  timeSlots: string[],
  reason: string = "Marked as booked by admin",
  campaignName: string = "firstoptionagency"
): Promise<{ success: boolean; message: string }> {
  try {
    if (!dateStr || !timeSlots || timeSlots.length === 0) {
      return { success: false, message: "Please select a date and at least one time slot." };
    }

    const updates: Record<string, any> = {};
    timeSlots.forEach((slotTime) => {
      const slotKey = sanitizeSlotKey(slotTime);
      updates[`slots/${campaignName}/${dateStr}/${slotKey}`] = {
        booked: true,
        blocked: true,
        reason: reason || "Marked as booked",
        bookedAt: Date.now(),
      };
    });

    await update(ref(db), updates);
    return { success: true, message: "Time slots marked as booked successfully." };
  } catch (error: any) {
    console.error("Firebase markSlotsAsBooked Error:", error);
    return { success: false, message: error.message || "Failed to mark slots as booked." };
  }
}

/**
 * Unmark / unblock a specific date or time slot in Firebase CRM
 */
export async function unmarkDateOrSlot(
  dateStr: string,
  timeSlot?: string,
  campaignName: string = "firstoptionagency"
): Promise<{ success: boolean; message: string }> {
  try {
    if (!dateStr) return { success: false, message: "Date is required." };

    if (timeSlot) {
      const slotKey = sanitizeSlotKey(timeSlot);
      const updates: Record<string, any> = {};
      updates[`slots/${campaignName}/${dateStr}/${slotKey}`] = null;
      await update(ref(db), updates);
    } else {
      const updates: Record<string, any> = {};
      updates[`slots/${campaignName}/${dateStr}`] = null;
      await update(ref(db), updates);
    }
    return { success: true, message: "Unmarked successfully." };
  } catch (error: any) {
    console.error("Firebase unmarkDateOrSlot Error:", error);
    return { success: false, message: error.message || "Failed to unmark." };
  }
}

/**
 * Fetch all blocked dates and slots for CRM management view
 */
export async function getAllBlockedSlotsAndDates(
  campaignName: string = "firstoptionagency"
): Promise<Array<{
  dateStr: string;
  isFullDateBlocked: boolean;
  blockedSlots: string[];
  reason?: string;
}>> {
  try {
    const slotsRef = ref(db, `slots/${campaignName}`);
    const snapshot = await get(slotsRef);
    if (!snapshot.exists()) return [];

    const data = snapshot.val();
    const result: Array<{
      dateStr: string;
      isFullDateBlocked: boolean;
      blockedSlots: string[];
      reason?: string;
    }> = [];

    Object.keys(data).forEach((dateStr) => {
      const dateObj = data[dateStr];
      if (!dateObj || typeof dateObj !== "object") return;

      const isFullDateBlocked = Boolean(dateObj._blockedDate && dateObj._blockedDate.blocked);
      const blockedSlots: string[] = [];
      let reason = dateObj._blockedDate?.reason;

      Object.keys(dateObj).forEach((key) => {
        if (key === "_blockedDate") return;
        const slotData = dateObj[key];
        if (slotData && slotData.blocked) {
          if (!reason && slotData.reason) reason = slotData.reason;
          // Re-convert sanitized slot key to human readable if possible
          blockedSlots.push(key);
        }
      });

      if (isFullDateBlocked || blockedSlots.length > 0) {
        result.push({
          dateStr,
          isFullDateBlocked,
          blockedSlots,
          reason: reason || "Marked as booked",
        });
      }
    });

    return result.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  } catch (error) {
    console.error("Firebase getAllBlockedSlotsAndDates Error:", error);
    return [];
  }
}

/**
 * Fetch lead profile from Firebase by leadId & createdDate
 */
export async function getLeadById(
  leadId: string,
  createdDate: string,
  campaignName: string = "firstoptionagency"
): Promise<LeadData | null> {
  try {
    const leadRef = ref(db, `campaigns/${campaignName}/leads/${createdDate}/${leadId}`);
    const snapshot = await get(leadRef);
    if (snapshot.exists()) {
      return snapshot.val() as LeadData;
    }
    return null;
  } catch (error) {
    if (!String(error).includes("Permission denied")) {
      console.error("Firebase getLeadById Error:", error);
    }
    return null;
  }
}

/**
 * Search for an existing lead across dates or under a specific createdDate
 */
export async function findExistingLead(
  leadId: string,
  createdDate?: string | null,
  campaignName: string = "firstoptionagency"
): Promise<{ lead: LeadData; createdDate: string } | null> {
  try {
    if (createdDate) {
      const directLead = await getLeadById(leadId, createdDate, campaignName);
      if (directLead) {
        return { lead: directLead, createdDate };
      }
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (createdDate !== todayStr) {
      const todayLead = await getLeadById(leadId, todayStr, campaignName);
      if (todayLead) {
        return { lead: todayLead, createdDate: todayStr };
      }
    }

    const campaignLeadsRef = ref(db, `campaigns/${campaignName}/leads`);
    const snapshot = await get(campaignLeadsRef);
    if (snapshot.exists()) {
      const allDatesObj = snapshot.val();
      const dateKeys = Object.keys(allDatesObj).sort().reverse();
      for (const dKey of dateKeys) {
        if (!allDatesObj[dKey]) continue;
        if (allDatesObj[dKey][leadId]) {
          return {
            lead: allDatesObj[dKey][leadId] as LeadData,
            createdDate: dKey,
          };
        }
        // Fallback: search by lead id or sanitized email within the date group
        for (const [lKey, lVal] of Object.entries(allDatesObj[dKey])) {
          const lObj = lVal as LeadData;
          if (!lObj) continue;
          if (
            lKey === leadId ||
            (lObj.email && sanitizeEmailToId(lObj.email) === leadId)
          ) {
            return {
              lead: lObj,
              createdDate: dKey,
            };
          }
        }
      }
    }
    return null;
  } catch (error) {
    if (!String(error).includes("Permission denied")) {
      console.error("Firebase findExistingLead Error:", error);
    }
    return null;
  }
}

export interface ExistingLeadCheckResult {
  emailExists: boolean;
  phoneExists: boolean;
}

/**
 * Fast check to verify if an email or phone number is already registered in Firebase Database across any campaign/date.
 * Checks via Client JS SDK with fallback to Node.js backend server API.
 */
export async function checkExistingLeadByEmailOrPhone(
  email: string,
  phone: string,
  campaignName: string = "firstoptionagency"
): Promise<ExistingLeadCheckResult> {
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanPhone = (phone || "").replace(/\D/g, "");

  if (!cleanEmail && !cleanPhone) {
    return { emailExists: false, phoneExists: false };
  }

  let emailExists = false;
  let phoneExists = false;

  try {
    const campaignKeys = Object.keys(CAMPAIGNS);
    const orderedKeys = [campaignName, ...campaignKeys.filter((k) => k !== campaignName)];

    for (const cName of orderedKeys) {
      const leadsRef = ref(db, `campaigns/${cName}/leads`);
      const snapshot = await get(leadsRef);

      if (snapshot.exists()) {
        const datesObj = snapshot.val();
        for (const dKey of Object.keys(datesObj)) {
          const dayLeads = datesObj[dKey];
          if (!dayLeads) continue;

          for (const lKey of Object.keys(dayLeads)) {
            const lead = dayLeads[lKey] as LeadData;
            if (!lead) continue;

            const lEmail = (lead.email || "").trim().toLowerCase();
            const lPhone = (lead.phone || "").replace(/\D/g, "");

            if (cleanEmail && lEmail && lEmail === cleanEmail) {
              emailExists = true;
            }
            if (
              cleanPhone &&
              lPhone &&
              (lPhone === cleanPhone ||
                (lPhone.length >= 10 && cleanPhone.length >= 10 && lPhone.slice(-10) === cleanPhone.slice(-10)))
            ) {
              phoneExists = true;
            }

            if (emailExists && phoneExists) break;
          }
          if (emailExists && phoneExists) break;
        }
      }
      if (emailExists && phoneExists) break;
    }
  } catch (error) {
    console.error("Firebase JS checkExistingLeadByEmailOrPhone Error, attempting Node.js API fallback:", error);
    try {
      const serverUrl = (process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL || "https://first.infiplus.in").replace(/\/$/, "");
      const res = await fetch(`${serverUrl}/api/whatsapp/check-lead-duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, phone: cleanPhone, campaignId: campaignName }),
      });
      if (res.ok) {
        const data = await res.json();
        return { emailExists: !!data.emailExists, phoneExists: !!data.phoneExists };
      }
    } catch (apiErr) {
      console.error("Node.js duplicate check endpoint error:", apiErr);
    }
  }

  return { emailExists, phoneExists };
}


/**
 * CRM Query: Fetch all leads for a specific date across selected or all campaigns
 */
export async function getLeadsForDate(
  targetDate: string,
  campaignId: string = "all"
): Promise<LeadData[]> {
  try {
    const campaignKeys = campaignId === "all" ? Object.keys(CAMPAIGNS) : [campaignId];
    const results: LeadData[] = [];

    for (const cName of campaignKeys) {
      const leadsRef = ref(db, `campaigns/${cName}/leads/${targetDate}`);
      const snapshot = await get(leadsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.values(data).forEach((item: any) => {
          results.push(item as LeadData);
        });
      }
    }

    return results.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  } catch (error) {
    console.error("Firebase getLeadsForDate Error:", error);
    return [];
  }
}

/**
 * CRM Query: Fetch all meetings scheduled for a specific date across selected or all campaigns
 */
export async function getMeetingsForDate(
  targetDate: string,
  campaignId: string = "all"
): Promise<any[]> {
  try {
    const campaignKeys = campaignId === "all" ? Object.keys(CAMPAIGNS) : [campaignId];
    const results: any[] = [];

    for (const cName of campaignKeys) {
      const meetingsRef = ref(db, `campaigns/${cName}/meetings/${targetDate}`);
      const snapshot = await get(meetingsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.values(data).forEach((item: any) => {
          results.push({ ...item, campaign: cName });
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Firebase getMeetingsForDate Error:", error);
    return [];
  }
}

/**
 * CRM Query: Fetch all meetings across all dates for the Interactive Calendar view
 */
export async function getAllMeetings(
  campaignId: string = "all"
): Promise<any[]> {
  try {
    const campaignKeys = campaignId === "all" ? Object.keys(CAMPAIGNS) : [campaignId];
    const results: any[] = [];

    for (const cName of campaignKeys) {
      const meetingsRef = ref(db, `campaigns/${cName}/meetings`);
      const snapshot = await get(meetingsRef);
      if (snapshot.exists()) {
        const datesObj = snapshot.val();
        Object.keys(datesObj).forEach((mDate) => {
          if (datesObj[mDate]) {
            Object.values(datesObj[mDate]).forEach((item: any) => {
              results.push({ ...item, campaign: cName });
            });
          }
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Firebase getAllMeetings Error:", error);
    return [];
  }
}

/**
 * CRM Query: Fetch all leads across all dates for the Pipeline Kanban Board
 */
export async function getAllLeadsAcrossDates(
  campaignId: string = "all"
): Promise<LeadData[]> {
  try {
    const campaignKeys = campaignId === "all" ? Object.keys(CAMPAIGNS) : [campaignId];
    const results: LeadData[] = [];

    for (const cName of campaignKeys) {
      const leadsRef = ref(db, `campaigns/${cName}/leads`);
      const snapshot = await get(leadsRef);
      if (snapshot.exists()) {
        const datesObj = snapshot.val();
        Object.keys(datesObj).forEach((dKey) => {
          if (datesObj[dKey]) {
            Object.values(datesObj[dKey]).forEach((item: any) => {
              results.push({ ...item, campaign: cName });
            });
          }
        });
      }
    }

    return results.sort((a, b) => (b.updatedAt || b.createdDate || "").localeCompare(a.updatedAt || a.createdDate || ""));
  } catch (error) {
    console.error("Firebase getAllLeadsAcrossDates Error:", error);
    return [];
  }
}

/**
 * Stage-Gated Lead Database Writer (Merge & Preserve Aware):
 * - Checks for pre-existing lead records to avoid wiping survey, meeting, links, or status.
 * - Partial (Step 1): Updates contact info while keeping previous survey & meeting data if present.
 * - Survey Completed (Step 2): Merges survey answers while keeping previous meeting data if present.
 * - Completed (Step 3): Updates meeting date & time + atomic slot booking.
 */
export async function saveOrUpdateLead(
  lead: LeadData,
  existingLeadId?: string | null,
  existingCreatedDate?: string | null,
  campaignName: string = "firstoptionagency"
): Promise<SaveLeadResult | null> {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const timestamp = new Date().toISOString();

    // Deterministic lead ID from email prefix (e.g., "mudassirs472")
    const leadId = existingLeadId || (lead.email ? sanitizeEmailToId(lead.email) : "lead_" + Date.now());

    // Search for existing lead record to avoid overwriting previously submitted survey/meeting details
    const existingMatch = await findExistingLead(leadId, existingCreatedDate, campaignName);
    const existingLead = existingMatch?.lead || null;
    const createdDate = existingMatch?.createdDate || existingCreatedDate || lead.createdDate || todayStr;

    // Determine status precedence: completed > survey_completed > partial
    const getStatusPriority = (s?: string) => {
      if (s === "completed") return 3;
      if (s === "survey_completed") return 2;
      if (s === "partial") return 1;
      return 0;
    };

    const existingPriority = getStatusPriority(existingLead?.status);
    const newPriority = getStatusPriority(lead.status);

    // Keep highest status achieved unless new submission advances it
    const finalStatus: "partial" | "survey_completed" | "completed" =
      newPriority >= existingPriority ? lead.status : (existingLead?.status || lead.status);

    // Merge survey data: use new survey if provided (and non-empty), otherwise keep existing survey
    const mergedSurvey =
      lead.survey && Object.keys(lead.survey).length > 0
        ? { ...(existingLead?.survey || {}), ...lead.survey }
        : existingLead?.survey;

    // Merge meeting data: use new meeting if user selected/re-selected a slot (lead.meeting), otherwise keep existing meeting
    const mergedMeeting = lead.meeting || existingLead?.meeting;

    // Funnel Stage Precedence Resolution:
    // raw (1) -> in_progress (2) -> survey_completed (3) -> meeting_booked (4) -> proposal_sent (5) -> won (6) -> not_qualified (7)
    const getStageWeight = (st?: string | null): number => {
      if (!st) return 0;
      if (st === "raw") return 1;
      if (st === "in_progress") return 2;
      if (st === "survey_completed") return 3;
      if (st === "meeting_booked") return 4;
      if (st === "proposal_sent") return 5;
      if (st === "won") return 6;
      if (st === "not_qualified") return 7;
      return 2;
    };

    const hasMeetingBooked =
      !!(mergedMeeting?.meetingDate && mergedMeeting?.meetingTime) ||
      finalStatus === "completed" ||
      lead.pipelineStage === "meeting_booked";

    const hasSurveyFilled =
      !!(mergedSurvey && Object.keys(mergedSurvey).length > 0) ||
      finalStatus === "survey_completed" ||
      lead.pipelineStage === "survey_completed";

    const currentExistingWeight = getStageWeight(existingLead?.pipelineStage);
    let targetPipelineStage: string;

    if (hasMeetingBooked) {
      // If meeting is booked, move to meeting_booked unless already in a post-meeting sales stage (proposal_sent, won, not_qualified)
      if (currentExistingWeight <= 3 || !existingLead?.pipelineStage) {
        targetPipelineStage = "meeting_booked";
      } else {
        targetPipelineStage = existingLead?.pipelineStage || "meeting_booked";
      }
    } else if (hasSurveyFilled) {
      // If survey is filled, move to survey_completed unless already at meeting_booked or beyond
      if (currentExistingWeight <= 2 || !existingLead?.pipelineStage) {
        targetPipelineStage = "survey_completed";
      } else {
        targetPipelineStage = existingLead?.pipelineStage || "survey_completed";
      }
    } else if (lead.pipelineStage) {
      const newStageWeight = getStageWeight(lead.pipelineStage);
      if (newStageWeight > currentExistingWeight || !existingLead?.pipelineStage) {
        targetPipelineStage = lead.pipelineStage;
      } else {
        targetPipelineStage = existingLead?.pipelineStage || lead.pipelineStage;
      }
    } else {
      targetPipelineStage = existingLead?.pipelineStage || "in_progress";
    }

    const stageChanged = !existingLead?.pipelineStage || existingLead.pipelineStage !== targetPipelineStage;
    const mergedPipelineStage = targetPipelineStage;
    const mergedStageMovedAt = stageChanged
      ? (lead.stageMovedAt || timestamp)
      : (existingLead?.stageMovedAt || lead.stageMovedAt || timestamp);

    const mergedNotes = lead.notes || existingLead?.notes;
    const mergedFollowUpDate = lead.followUpDate || existingLead?.followUpDate;
    const mergedDealValue = lead.dealValue !== undefined ? lead.dealValue : existingLead?.dealValue;
    const mergedOnboarded = lead.onboarded !== undefined ? lead.onboarded : existingLead?.onboarded;
    const mergedOnboardedAt = lead.onboardedAt || existingLead?.onboardedAt;
    const mergedOnboardCount = lead.onboardCount !== undefined ? lead.onboardCount : existingLead?.onboardCount;

    // Base Master Lead Payload
    const rawFullName = lead.fullName || existingLead?.fullName || "";
    const formattedFullName = rawFullName.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

    const leadPayload: LeadData = {
      id: leadId,
      campaign: campaignName,
      createdDate: createdDate,
      createdAt: existingLead?.createdAt || lead.createdAt || timestamp,
      updatedAt: timestamp,
      fullName: formattedFullName,
      email: lead.email || existingLead?.email || "",
      phone: lead.phone || existingLead?.phone || "",
      countryCode: lead.countryCode || existingLead?.countryCode || "+91",
      status: finalStatus,
    };

    if (mergedSurvey) {
      leadPayload.survey = mergedSurvey;
    }

    if (mergedMeeting) {
      leadPayload.meeting = mergedMeeting;
    }

    if (mergedNotes) {
      leadPayload.notes = mergedNotes;
    }

    if (mergedFollowUpDate) {
      leadPayload.followUpDate = mergedFollowUpDate;
    }

    if (mergedPipelineStage) {
      leadPayload.pipelineStage = mergedPipelineStage;
    }

    if (mergedStageMovedAt) {
      leadPayload.stageMovedAt = mergedStageMovedAt;
    }

    if (mergedDealValue !== undefined) {
      leadPayload.dealValue = mergedDealValue;
    }

    if (mergedOnboarded !== undefined) {
      leadPayload.onboarded = mergedOnboarded;
    }

    if (mergedOnboardedAt) {
      leadPayload.onboardedAt = mergedOnboardedAt;
    }

    if (mergedOnboardCount !== undefined) {
      leadPayload.onboardCount = mergedOnboardCount;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "https://firstoptionagency.in";

    // Build/preserve links
    const links: Record<string, string> = { ...(existingLead?.links || {}) };

    if (mergedSurvey || finalStatus === "survey_completed" || finalStatus === "completed") {
      links.surveyUrl = `${origin}/?step=survey&leadId=${leadId}&createdDate=${createdDate}&campaign=${campaignName}`;
    }

    if (mergedMeeting || finalStatus === "completed") {
      links.surveyUrl = `${origin}/?step=survey&leadId=${leadId}&createdDate=${createdDate}&campaign=${campaignName}`;
      links.meetingUrl = `${origin}/?step=meeting&leadId=${leadId}&createdDate=${createdDate}&campaign=${campaignName}`;
    }

    if (Object.keys(links).length > 0) {
      leadPayload.links = links;
    }

    const updates: Record<string, any> = {};

    // Check if meeting was changed to a different date or time, so we can clean up old slot & old meeting index
    if (
      existingLead?.meeting?.meetingDate &&
      existingLead?.meeting?.meetingTime &&
      lead.meeting?.meetingDate &&
      lead.meeting?.meetingTime &&
      (existingLead.meeting.meetingDate !== lead.meeting.meetingDate ||
        existingLead.meeting.meetingTime !== lead.meeting.meetingTime)
    ) {
      const oldMDate = existingLead.meeting.meetingDate;
      const oldMTime = existingLead.meeting.meetingTime;
      const oldSlotKey = sanitizeSlotKey(oldMTime);
      updates[`campaigns/${campaignName}/meetings/${oldMDate}/${leadId}`] = null;
      updates[`slots/${campaignName}/${oldMDate}/${oldSlotKey}`] = null;
    }

    // Set Master Lead Path
    updates[`campaigns/${campaignName}/leads/${createdDate}/${leadId}`] = leadPayload;

    // High-Performance Meeting Index & Atomic Slot Booking
    const finalMeeting = leadPayload.meeting;
    if (finalMeeting && finalMeeting.meetingDate && finalMeeting.meetingTime) {
      const mDate = finalMeeting.meetingDate;
      const mTime = finalMeeting.meetingTime;
      const slotKey = sanitizeSlotKey(mTime);

      const meetingIndexPayload = {
        leadId: leadId,
        fullName: leadPayload.fullName,
        email: leadPayload.email,
        phone: leadPayload.phone,
        countryCode: leadPayload.countryCode,
        meetingDate: mDate,
        meetingTime: mTime,
        status: "booked",
        createdDate: createdDate,
        bookedAt: finalMeeting.bookedAt || timestamp,
        survey: leadPayload.survey || {},
        notes: leadPayload.notes || [],
        followUpDate: leadPayload.followUpDate || null,
        pipelineStage: leadPayload.pipelineStage || null,
        dealValue: leadPayload.dealValue !== undefined ? leadPayload.dealValue : null,
      };

      // 1. Meeting Index Node
      updates[`campaigns/${campaignName}/meetings/${mDate}/${leadId}`] = meetingIndexPayload;

      // 2. Realtime Dedicated Slot Booking Node
      updates[`slots/${campaignName}/${mDate}/${slotKey}`] = {
        booked: true,
        leadId: leadId,
        fullName: leadPayload.fullName,
        phone: leadPayload.phone,
        bookedAt: finalMeeting.bookedAt || timestamp,
      };
    }

    // Perform Atomic Write to Firebase
    await update(ref(db), updates);

    // Trigger Google Cloud Tasks Automation Sync
    syncLeadCloudTasks(
      leadPayload,
      existingLead?.pipelineStage || null,
      existingLead?.meeting ? `${existingLead.meeting.meetingDate}_${existingLead.meeting.meetingTime}` : null
    ).catch(() => {});

    return {
      leadId,
      createdDate,
      leadData: leadPayload,
    };
  } catch (error) {
    console.error("Firebase Database Save Error:", error);
    return null;
  }
}

/**
 * Permanently delete a lead record from Firebase RTDB along with all assigned client flows
 */
export async function deleteLead(
  leadId: string,
  createdDate?: string | null,
  campaignName: string = "firstoptionagency",
  meetingDate?: string | null,
  meetingTime?: string | null,
  leadEmail?: string | null
): Promise<{ success: boolean; message?: string }> {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const targetCreatedDate = createdDate || todayStr;
    const updates: Record<string, any> = {};

    let targetEmail = leadEmail || null;

    // Fetch lead phone & email to cancel pending Cloud Tasks and find clientFlows
    try {
      const leadRefPath = `campaigns/${campaignName}/leads/${targetCreatedDate}/${leadId}`;
      const leadSnap = await get(ref(db, leadRefPath));
      if (leadSnap.exists()) {
        const lData = leadSnap.val();
        if (lData?.phone) {
          cancelLeadCloudTasks(lData.phone).catch(() => {});
        }
        if (!targetEmail && lData?.email) {
          targetEmail = lData.email;
        }
      }
    } catch (e) {}

    // Delete lead node
    updates[`campaigns/${campaignName}/leads/${targetCreatedDate}/${leadId}`] = null;

    // Delete meeting and slot if present
    if (meetingDate && meetingTime) {
      const slotKey = sanitizeSlotKey(meetingTime);
      updates[`campaigns/${campaignName}/meetings/${meetingDate}/${leadId}`] = null;
      updates[`slots/${campaignName}/${meetingDate}/${slotKey}`] = null;
    }

    // Permanently purge associated assigned Client Flow Instance(s) from /clientFlows node
    try {
      const clientFlowsSnap = await get(ref(db, "clientFlows"));
      if (clientFlowsSnap.exists()) {
        const flowsData = clientFlowsSnap.val();
        Object.keys(flowsData).forEach((flowKey) => {
          const flow = flowsData[flowKey];
          if (flow) {
            const matchesId = flow.clientOnboardId === leadId;
            const matchesEmail =
              targetEmail &&
              flow.clientEmail &&
              flow.clientEmail.toLowerCase().trim() === targetEmail.toLowerCase().trim();

            if (matchesId || matchesEmail) {
              updates[`clientFlows/${flowKey}`] = null;
            }
          }
        });
      }
    } catch (e) {
      console.error("Error finding clientFlows for lead deletion:", e);
    }

    await update(ref(db), updates);
    return { success: true };

  } catch (err: any) {
    console.error("deleteLead Error:", err);
    return { success: false, message: err?.message || "Failed to delete lead." };
  }
}

/**
 * Staff CRM Helper: Add/update staff notes and follow-up date for a lead
 */
export async function updateLeadStaffFields(
  leadId: string,
  createdDate: string,
  staffData: {
    notes?: StaffNote[];
    followUpDate?: string;
    pipelineStage?: string;
    stageMovedAt?: string;
    dealValue?: number;
  },
  campaignName: string = "firstoptionagency"
): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString();
    const updates: Record<string, any> = {};

    const leadRefPath = `campaigns/${campaignName}/leads/${createdDate}/${leadId}`;
    const snapshot = await get(ref(db, leadRefPath));
    if (!snapshot.exists()) return false;

    const existingLead = snapshot.val() as LeadData;

    if (staffData.notes !== undefined) {
      updates[`${leadRefPath}/notes`] = staffData.notes;
    }
    if (staffData.followUpDate !== undefined) {
      updates[`${leadRefPath}/followUpDate`] = staffData.followUpDate;
    }
    if (staffData.pipelineStage !== undefined) {
      updates[`${leadRefPath}/pipelineStage`] = staffData.pipelineStage;
      updates[`${leadRefPath}/stageMovedAt`] = timestamp;
    }
    // If dealValue is updated, also update any onboard snapshot records for this lead
    if (staffData.dealValue !== undefined) {
      updates[`${leadRefPath}/dealValue`] = staffData.dealValue;
      try {
        const onboardsSnap = await get(ref(db, `onboards/${campaignName}/all`));
        if (onboardsSnap.exists()) {
          const obData = onboardsSnap.val();
          Object.keys(obData).forEach((obId) => {
            if (obData[obId]?.leadId === leadId || obData[obId]?.email === existingLead.email) {
              const obDate = obData[obId]?.onboardedDate;
              updates[`onboards/${campaignName}/all/${obId}/dealValue`] = staffData.dealValue;
              if (obDate) {
                updates[`onboards/${campaignName}/${obDate}/${obId}/dealValue`] = staffData.dealValue;
              }
            }
          });
        }
      } catch (err) {
        console.error("Error syncing dealValue to onboards:", err);
      }
    }
    updates[`${leadRefPath}/updatedAt`] = timestamp;

    // If a meeting index exists for this lead, update meeting index node too
    if (existingLead.meeting?.meetingDate) {
      const mDate = existingLead.meeting.meetingDate;
      const meetingRefPath = `campaigns/${campaignName}/meetings/${mDate}/${leadId}`;
      if (staffData.notes !== undefined) {
        updates[`${meetingRefPath}/notes`] = staffData.notes;
      }
      if (staffData.followUpDate !== undefined) {
        updates[`${meetingRefPath}/followUpDate`] = staffData.followUpDate;
      }
      if (staffData.pipelineStage !== undefined) {
        updates[`${meetingRefPath}/pipelineStage`] = staffData.pipelineStage;
        updates[`${meetingRefPath}/stageMovedAt`] = timestamp;
      }
      if (staffData.dealValue !== undefined) {
        updates[`${meetingRefPath}/dealValue`] = staffData.dealValue;
      }
      updates[`${meetingRefPath}/updatedAt`] = timestamp;
    }

    await update(ref(db), updates);

    // Trigger Cloud Tasks Sync if pipelineStage or staff fields updated
    syncLeadCloudTasks(
      {
        ...existingLead,
        notes: staffData.notes !== undefined ? staffData.notes : existingLead.notes,
        followUpDate: staffData.followUpDate !== undefined ? staffData.followUpDate : existingLead.followUpDate,
        pipelineStage: staffData.pipelineStage !== undefined ? staffData.pipelineStage : existingLead.pipelineStage,
        dealValue: staffData.dealValue !== undefined ? staffData.dealValue : existingLead.dealValue,
      },
      staffData.pipelineStage !== undefined ? existingLead.pipelineStage || null : null,
      existingLead.meeting ? `${existingLead.meeting.meetingDate}_${existingLead.meeting.meetingTime}` : null
    ).catch(() => {});

    return true;
  } catch (error) {
    console.error("Firebase updateLeadStaffFields Error:", error);
    return false;
  }
}

/**
 * Onboard Client Function:
 * Creates an immutable snapshot record under /onboards/{campaignName}/{date}/{onboardId}
 * and updates master lead with onboarded status & pipeline stage = 'won'.
 */
export async function onboardLeadClient(
  lead: LeadData,
  staffUserEmail?: string,
  campaignName: string = "firstoptionagency"
): Promise<{ success: boolean; onboardId?: string }> {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const timestamp = new Date().toISOString();
    const leadId = lead.id || (lead.email ? sanitizeEmailToId(lead.email) : "lead_" + Date.now());
    const createdDate = lead.createdDate || todayStr;
    const onboardId = `ob_${leadId}_${Date.now()}`;
    const newCount = (lead.onboardCount || 0) + 1;

    const onboardRecord: OnboardRecord = {
      id: onboardId,
      leadId: leadId,
      fullName: lead.fullName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      countryCode: lead.countryCode || "+91",
      campaign: campaignName,
      onboardedAt: timestamp,
      onboardedDate: todayStr,
      onboardedBy: staffUserEmail || "Staff",
      dealValue: lead.dealValue || 0,
      survey: lead.survey || {},
      meeting: lead.meeting || {},
      notes: lead.notes || [],
      followUpDate: lead.followUpDate || "",
    };

    const updates: Record<string, any> = {};

    // 1. Store immutable snapshot in dedicated /onboards node
    updates[`onboards/${campaignName}/${todayStr}/${onboardId}`] = onboardRecord;
    updates[`onboards/${campaignName}/all/${onboardId}`] = onboardRecord;

    // 2. Update Master Lead Record with onboard status & move stage to 'won'
    const updatedLeadPayload: LeadData = {
      ...lead,
      onboarded: true,
      onboardedAt: timestamp,
      onboardCount: newCount,
      pipelineStage: "won",
      updatedAt: timestamp,
    };

    updates[`campaigns/${campaignName}/leads/${createdDate}/${leadId}`] = updatedLeadPayload;

    await update(ref(db), updates);

    // Trigger Cloud Tasks Sync for 'won' stage transition
    syncLeadCloudTasks(updatedLeadPayload, lead.pipelineStage || null, null).catch(() => {});

    return { success: true, onboardId };
  } catch (err) {
    console.error("Firebase onboardLeadClient Error:", err);
    return { success: false };
  }
}

/**
 * Fetch all onboard snapshot records from /onboards/{campaignName}/all
 */
export async function getAllOnboardedRecords(campaignName: string = "all"): Promise<OnboardRecord[]> {
  try {
    const results: OnboardRecord[] = [];

    if (campaignName === "all") {
      const campaigns = Object.keys(CAMPAIGNS);
      const snapshots = await Promise.all(
        campaigns.map((cmp) => get(ref(db, `onboards/${cmp}/all`)))
      );

      snapshots.forEach((snap) => {
        if (snap.exists()) {
          const data = snap.val();
          Object.keys(data).forEach((obId) => {
            results.push(data[obId]);
          });
        }
      });
    } else {
      const snap = await get(ref(db, `onboards/${campaignName}/all`));
      if (snap.exists()) {
        const data = snap.val();
        Object.keys(data).forEach((obId) => {
          results.push(data[obId]);
        });
      }
    }

    // Sort newest first by onboardedAt
    return results.sort((a, b) => (b.onboardedAt || "").localeCompare(a.onboardedAt || ""));
  } catch (err) {
    console.error("Firebase getAllOnboardedRecords Error:", err);
    return [];
  }
}

/**
 * Delete a specific onboard snapshot record
 */
export async function deleteOnboardRecord(
  onboardId: string,
  campaignName: string,
  onboardedDate?: string,
  leadId?: string,
  createdDate?: string
): Promise<boolean> {
  try {
    const updates: Record<string, any> = {};

    updates[`onboards/${campaignName}/all/${onboardId}`] = null;
    if (onboardedDate) {
      updates[`onboards/${campaignName}/${onboardedDate}/${onboardId}`] = null;
    }

    if (leadId && createdDate) {
      const allRecords = await getAllOnboardedRecords(campaignName);
      const remainingForLead = allRecords.filter((r) => r.leadId === leadId && r.id !== onboardId);

      if (remainingForLead.length === 0) {
        updates[`campaigns/${campaignName}/leads/${createdDate}/${leadId}/onboarded`] = false;
        updates[`campaigns/${campaignName}/leads/${createdDate}/${leadId}/onboardCount`] = 0;
      } else {
        updates[`campaigns/${campaignName}/leads/${createdDate}/${leadId}/onboardCount`] = remainingForLead.length;
      }
    }

    await update(ref(db), updates);
    return true;
  } catch (err) {
    console.error("Firebase deleteOnboardRecord Error:", err);
    return false;
  }
}

/**
 * Update Deal Value (₹) on an Onboard Record and synchronize with master lead record.
 */
export async function updateOnboardRecordDealValue(
  onboardId: string,
  campaignName: string,
  onboardedDate: string,
  newDealValue: number,
  leadId?: string,
  createdDate?: string
): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString();
    const updates: Record<string, any> = {};

    updates[`onboards/${campaignName}/all/${onboardId}/dealValue`] = newDealValue;
    updates[`onboards/${campaignName}/all/${onboardId}/updatedAt`] = timestamp;
    if (onboardedDate) {
      updates[`onboards/${campaignName}/${onboardedDate}/${onboardId}/dealValue`] = newDealValue;
      updates[`onboards/${campaignName}/${onboardedDate}/${onboardId}/updatedAt`] = timestamp;
    }

    if (leadId && createdDate) {
      updates[`campaigns/${campaignName}/leads/${createdDate}/${leadId}/dealValue`] = newDealValue;
      updates[`campaigns/${campaignName}/leads/${createdDate}/${leadId}/updatedAt`] = timestamp;
    }

    await update(ref(db), updates);
    return true;
  } catch (err) {
    console.error("Firebase updateOnboardRecordDealValue Error:", err);
    return false;
  }
}

export interface RoleData {
  id: string;
  name: string;
  description: string;
  isDeleted?: boolean;
}

export interface UserData {
  email: string;
  emailId: string;
  roleId: string;
  roleName: string;
  name?: string;
  phone?: string;
  uid?: string;
  updatedAt?: string;
}

export const MASTER_ADMIN_UID = "Z6Q2eQIQQuQf1rgk1hdWWxVUdLX2";

const DEFAULT_ROLES: RoleData[] = [
  { id: "role_admin", name: "Admin", description: "Full system administration & role management access", isDeleted: false },
  { id: "role_appointment_setter_1", name: "Appointment_Setter_1", description: "Access pipeline and calendar data & operations, restricted from deleting pipeline data", isDeleted: false },
  { id: "role_onboarding", name: "Onboarding Specialist", description: "Handles client onboarding & contract snapshot creation", isDeleted: false },
  { id: "role_research", name: "Research", description: "Market research & client survey analysis", isDeleted: false },
  { id: "role_editor", name: "Editor", description: "Content & proposal editing staff", isDeleted: false },
  { id: "role_designer", name: "Designer", description: "Creative branding & asset designer", isDeleted: false },
];

/**
 * Fetch all roles from Firebase /roles node. Filters out soft-deleted roles (isDeleted: true).
 */
export async function getRoles(): Promise<RoleData[]> {
  try {
    const rolesSnap = await get(ref(db, "roles"));
    if (!rolesSnap.exists()) {
      const updates: Record<string, any> = {};
      DEFAULT_ROLES.forEach((r) => {
        updates[`roles/${r.id}`] = r;
      });
      await update(ref(db), updates);
      return DEFAULT_ROLES;
    }

    const data = rolesSnap.val();
    const result: RoleData[] = Object.keys(data)
      .map((k) => data[k])
      .filter((r) => !r.isDeleted);

    if (!result.some((r) => r.id === "role_appointment_setter_1" || r.name === "Appointment_Setter_1")) {
      const appSetterRole: RoleData = {
        id: "role_appointment_setter_1",
        name: "Appointment_Setter_1",
        description: "Access pipeline and calendar data & operations, restricted from deleting pipeline data",
        isDeleted: false,
      };
      await set(ref(db, "roles/role_appointment_setter_1"), appSetterRole);
      result.push(appSetterRole);
    }

    return result.sort((a, b) => (a.name.toLowerCase() === "admin" ? -1 : 1));
  } catch (err) {
    console.error("Firebase getRoles Error:", err);
    return DEFAULT_ROLES;
  }
}

/**
 * Create a new custom role under /roles node (Prevents creating Admin role)
 */
export async function createRole(
  name: string,
  description: string = ""
): Promise<{ success: boolean; message?: string; role?: RoleData }> {
  try {
    const cleanName = name.trim();
    if (!cleanName) return { success: false, message: "Role name cannot be empty." };

    if (cleanName.toLowerCase() === "admin") {
      return { success: false, message: "Cannot create 'Admin' role. Admin is a system default role." };
    }

    const roleId = "role_" + cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now();

    const newRole: RoleData = {
      id: roleId,
      name: cleanName,
      description: description.trim(),
      isDeleted: false,
    };

    await set(ref(db, `roles/${roleId}`), newRole);
    return { success: true, role: newRole };
  } catch (err) {
    console.error("Firebase createRole Error:", err);
    return { success: false, message: "Failed to create role in Firebase." };
  }
}

/**
 * Soft Delete a role from /roles by setting isDeleted: true (Prevents deleting Admin role)
 */
export async function deleteRole(roleId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const roleSnap = await get(ref(db, `roles/${roleId}`));
    if (!roleSnap.exists()) return { success: false, message: "Role not found." };

    const role = roleSnap.val() as RoleData;
    if (role.name.toLowerCase() === "admin" || roleId === "role_admin") {
      return { success: false, message: "System 'Admin' role cannot be deleted." };
    }

    await update(ref(db, `roles/${roleId}`), { isDeleted: true });
    return { success: true };
  } catch (err) {
    console.error("Firebase deleteRole Error:", err);
    return { success: false, message: "Failed to soft delete role." };
  }
}

/**
 * Sync and fetch user profile from Firebase /users node based on Email.
 * For Master Admin, forces Admin role.
 */
export async function syncAndGetUser(uid: string, email: string): Promise<UserData> {
  try {
    const timestamp = new Date().toISOString();
    const cleanEmail = email.trim();
    const emailId = sanitizeEmailToId(cleanEmail);
    const isMasterAdmin = uid === MASTER_ADMIN_UID || cleanEmail.toLowerCase().startsWith("firstoption");

    const userRefPath = `users/${emailId}`;
    const userSnap = await get(ref(db, userRefPath));

    if (!userSnap.exists()) {
      const newUser: UserData = {
        email: cleanEmail,
        emailId,
        roleId: isMasterAdmin ? "role_admin" : "role_onboarding",
        roleName: isMasterAdmin ? "Admin" : "Onboarding Specialist",
        uid,
        updatedAt: timestamp,
      };
      await set(ref(db, userRefPath), newUser);
      return newUser;
    }

    const existingUser = userSnap.val() as UserData;

    if (isMasterAdmin && existingUser.roleId !== "role_admin") {
      const fixedAdmin: UserData = {
        ...existingUser,
        roleId: "role_admin",
        roleName: "Admin",
        uid,
        updatedAt: timestamp,
      };
      await set(ref(db, userRefPath), fixedAdmin);
      return fixedAdmin;
    }

    if (uid && existingUser.uid !== uid) {
      await update(ref(db, userRefPath), { uid, updatedAt: timestamp });
      existingUser.uid = uid;
    }

    return existingUser;
  } catch (err) {
    console.error("Firebase syncAndGetUser Error:", err);
    const cleanEmail = email.trim();
    const isMasterAdmin = uid === MASTER_ADMIN_UID || cleanEmail.toLowerCase().startsWith("firstoption");
    return {
      email: cleanEmail,
      emailId: sanitizeEmailToId(cleanEmail),
      roleId: isMasterAdmin ? "role_admin" : "role_onboarding",
      roleName: isMasterAdmin ? "Admin" : "Onboarding Specialist",
      uid,
    };
  }
}

/**
 * Fetch all registered users from Firebase /users node.
 */
export async function getAllUsers(): Promise<UserData[]> {
  try {
    const usersSnap = await get(ref(db, "users"));
    if (!usersSnap.exists()) return [];

    const data = usersSnap.val();
    const result: UserData[] = Object.keys(data).map((k) => data[k]);
    return result;
  } catch (err) {
    console.error("Firebase getAllUsers Error:", err);
    return [];
  }
}

/**
 * Assign / Update User Role in Firebase /users node by Email.
 * Prevents assigning Admin role to non-Master emails.
 */
export async function setUserRoleByEmail(
  email: string,
  roleId: string,
  roleName: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const cleanEmail = email.trim();
    const emailId = sanitizeEmailToId(cleanEmail);
    const isMaster = cleanEmail.toLowerCase().startsWith("firstoption");

    if (!isMaster && (roleId === "role_admin" || roleName.toLowerCase() === "admin")) {
      return {
        success: false,
        message: "Admin role is strictly reserved for the Master Admin account. You cannot assign Admin role to other staff emails.",
      };
    }

    const timestamp = new Date().toISOString();
    await update(ref(db, `users/${emailId}`), {
      roleId,
      roleName,
      updatedAt: timestamp,
    });

    return { success: true };
  } catch (err) {
    console.error("Firebase setUserRoleByEmail Error:", err);
    return { success: false, message: "Failed to update user role." };
  }
}

/**
 * Register a user entry by Email into Firebase /users node along with staff name, phone number, and UID so Admin can assign their role and system can dispatch WhatsApp notifications.
 */
export async function registerUserByEmail(
  email: string,
  roleId: string = "role_onboarding",
  roleName: string = "Onboarding Specialist",
  name?: string,
  phone?: string,
  uid?: string
): Promise<{ success: boolean; message?: string; user?: UserData }> {
  try {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return { success: false, message: "User Email is required." };
    }

    const emailId = sanitizeEmailToId(cleanEmail);
    const isMaster = cleanEmail.toLowerCase().startsWith("firstoption");

    if (!isMaster && (roleId === "role_admin" || roleName.toLowerCase() === "admin")) {
      return { success: false, message: "Cannot assign Admin role to non-Master emails." };
    }

    const timestamp = new Date().toISOString();

    const userEntry: UserData = {
      email: cleanEmail,
      emailId,
      name: name?.trim() || cleanEmail.split("@")[0],
      phone: phone?.trim() || "",
      uid: uid?.trim() || "",
      roleId: isMaster ? "role_admin" : roleId,
      roleName: isMaster ? "Admin" : roleName,
      updatedAt: timestamp,
    };

    await set(ref(db, `users/${emailId}`), userEntry);
    return { success: true, user: userEntry };
  } catch (err) {
    console.error("Firebase registerUserByEmail Error:", err);
    return { success: false, message: "Failed to register user in Firebase." };
  }
}

/**
 * Update existing staff user details (Name, Phone, UID, Role) in Firebase /users node.
 */
export async function updateUserStaffDetails(
  emailId: string,
  data: Partial<UserData>
): Promise<{ success: boolean; message?: string }> {
  try {
    const timestamp = new Date().toISOString();
    await update(ref(db, `users/${emailId}`), {
      ...data,
      updatedAt: timestamp,
    });
    return { success: true };
  } catch (err) {
    console.error("Firebase updateUserStaffDetails Error:", err);
    return { success: false, message: "Failed to update staff user details." };
  }
}

/* ==========================================================================
   WORKFLOW FLOW TEMPLATES & CLIENT FLOW MANAGEMENT
   ========================================================================== */

export interface FlowTaskTemplate {
  id: string;
  roleId: string;
  roleName: string;
  title: string;
  type: "checkbox" | "text" | "both";
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  tasks: FlowTaskTemplate[];
  createdAt: string;
  createdBy: string;
}

export interface ClientFlowTask {
  id: string;
  roleId: string;
  roleName: string;
  title: string;
  type: "checkbox" | "text" | "both";
  isCompleted: boolean;
  textValue: string;
  completedAt?: string;
  completedBy?: string;
}

export interface ClientFlowInstance {
  id: string;
  clientOnboardId: string;
  clientName: string;
  clientEmail: string;
  campaign: string;
  flowTemplateId: string;
  flowName: string;
  status: "in_progress" | "completed";
  assignedAt: string;
  assignedBy: string;
  tasks: ClientFlowTask[];
  roleOrder?: string[];
}

/**
 * Update role sequence order for a Client Flow Instance (Admin Action).
 */
export async function updateClientFlowRoleOrder(
  clientFlowId: string,
  roleOrder: string[]
): Promise<{ success: boolean }> {
  try {
    await update(ref(db, `clientFlows/${clientFlowId}`), {
      roleOrder,
    });
    return { success: true };
  } catch (err) {
    console.error("Firebase updateClientFlowRoleOrder Error:", err);
    return { success: false };
  }
}

/**
 * Fetch all Flow Templates from Firebase /flows node.
 */
export async function getFlowTemplates(): Promise<FlowTemplate[]> {
  try {
    const snap = await get(ref(db, "flows"));
    if (!snap.exists()) return [];

    const data = snap.val();
    return Object.keys(data).map((k) => data[k]);
  } catch (err) {
    console.error("Firebase getFlowTemplates Error:", err);
    return [];
  }
}

/**
 * Create a new Flow Template under /flows node.
 */
export async function createFlowTemplate(
  name: string,
  description: string,
  tasks: FlowTaskTemplate[],
  createdBy: string
): Promise<{ success: boolean; message?: string; flow?: FlowTemplate }> {
  try {
    const cleanName = name.trim();
    if (!cleanName) return { success: false, message: "Flow name is required." };
    if (!tasks || tasks.length === 0) return { success: false, message: "At least one task step is required." };

    const flowId = "flow_" + cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now();
    const timestamp = new Date().toISOString();

    const newFlow: FlowTemplate = {
      id: flowId,
      name: cleanName,
      description: description.trim(),
      tasks,
      createdAt: timestamp,
      createdBy,
    };

    await set(ref(db, `flows/${flowId}`), newFlow);
    return { success: true, flow: newFlow };
  } catch (err) {
    console.error("Firebase createFlowTemplate Error:", err);
    return { success: false, message: "Failed to create flow template." };
  }
}

/**
 * Update an existing Flow Template under /flows node.
 */
export async function updateFlowTemplate(
  flowId: string,
  name: string,
  description: string,
  tasks: FlowTaskTemplate[],
  updatedBy: string
): Promise<{ success: boolean; message?: string; flow?: FlowTemplate }> {
  try {
    const cleanName = name.trim();
    if (!cleanName) return { success: false, message: "Flow name is required." };
    if (!tasks || tasks.length === 0) return { success: false, message: "At least one task step is required." };

    const flowRef = ref(db, `flows/${flowId}`);
    const snapshot = await get(flowRef);
    const existingData = snapshot.exists() ? snapshot.val() : {};

    const updatedFlow: FlowTemplate = {
      ...existingData,
      id: flowId,
      name: cleanName,
      description: description.trim(),
      tasks,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await set(flowRef, updatedFlow);
    return { success: true, flow: updatedFlow };
  } catch (err) {
    console.error("Firebase updateFlowTemplate Error:", err);
    return { success: false, message: "Failed to update flow template." };
  }
}

/**
 * Delete a Flow Template from /flows.
 */
export async function deleteFlowTemplate(flowId: string): Promise<{ success: boolean; message?: string }> {
  try {
    await set(ref(db, `flows/${flowId}`), null);
    return { success: true };
  } catch (err) {
    console.error("Firebase deleteFlowTemplate Error:", err);
    return { success: false, message: "Failed to delete flow template." };
  }
}

/**
 * Assign a Flow Template to an Onboarded Client under /clientFlows.
 */
export async function assignFlowToClient(
  clientOnboardId: string,
  clientName: string,
  clientEmail: string,
  campaign: string,
  flowTemplateId: string,
  customFlowName: string,
  assignedBy: string
): Promise<{ success: boolean; message?: string; instance?: ClientFlowInstance }> {
  try {
    const templates = await getFlowTemplates();
    const targetTemplate = templates.find((t) => t.id === flowTemplateId);

    if (!targetTemplate) {
      return { success: false, message: "Selected Flow template does not exist." };
    }

    const instanceId = "cflow_" + Date.now();
    const timestamp = new Date().toISOString();

    const clientTasks: ClientFlowTask[] = targetTemplate.tasks.map((t) => ({
      id: "ctask_" + Math.random().toString(36).substr(2, 9),
      roleId: t.roleId,
      roleName: t.roleName,
      title: t.title,
      type: t.type,
      isCompleted: false,
      textValue: "",
    }));

    const flowInstance: ClientFlowInstance = {
      id: instanceId,
      clientOnboardId,
      clientName,
      clientEmail,
      campaign,
      flowTemplateId,
      flowName: customFlowName.trim() || targetTemplate.name,
      status: "in_progress",
      assignedAt: timestamp,
      assignedBy,
      tasks: clientTasks,
    };

    await set(ref(db, `clientFlows/${instanceId}`), flowInstance);
    return { success: true, instance: flowInstance };
  } catch (err) {
    console.error("Firebase assignFlowToClient Error:", err);
    return { success: false, message: "Failed to assign flow to client." };
  }
}

/**
 * Fetch all assigned Client Flow Instances from /clientFlows.
 */
export async function getAllClientFlows(): Promise<ClientFlowInstance[]> {
  try {
    const snap = await get(ref(db, "clientFlows"));
    if (!snap.exists()) return [];

    const data = snap.val();
    return Object.keys(data).map((k) => data[k]);
  } catch (err) {
    console.error("Firebase getAllClientFlows Error:", err);
    return [];
  }
}

/**
 * Update a task's completion status and text value in a Client Flow Instance.
 * Saves timestamp (completedAt) and user (completedBy) when checked.
 * Resets or updates timestamps on toggle.
 */
export async function updateClientFlowTaskStatus(
  clientFlowId: string,
  taskId: string,
  isCompleted: boolean,
  textValue: string,
  userEmail: string
): Promise<{ success: boolean }> {
  try {
    const snap = await get(ref(db, `clientFlows/${clientFlowId}`));
    if (!snap.exists()) return { success: false };

    const flow = snap.val() as ClientFlowInstance;
    const timestamp = new Date().toISOString();

    const updatedTasks = flow.tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          isCompleted,
          textValue,
          completedAt: isCompleted ? timestamp : null,
          completedBy: isCompleted ? userEmail : null,
        };
      }
      return t;
    });

    await update(ref(db, `clientFlows/${clientFlowId}`), {
      tasks: updatedTasks,
    });

    return { success: true };
  } catch (err) {
    console.error("Firebase updateClientFlowTaskStatus Error:", err);
    return { success: false };
  }
}

/**
 * Mark an entire Client Flow Instance as completed (Admin Only Action).
 */
export async function markClientFlowCompleted(clientFlowId: string): Promise<{ success: boolean }> {
  try {
    await update(ref(db, `clientFlows/${clientFlowId}`), {
      status: "completed",
    });
    return { success: true };
  } catch (err) {
    console.error("Firebase markClientFlowCompleted Error:", err);
    return { success: false };
  }
}

/**
 * Delete an assigned Client Flow Instance from /clientFlows.
 */
export async function deleteClientFlowInstance(clientFlowId: string): Promise<{ success: boolean }> {
  try {
    await set(ref(db, `clientFlows/${clientFlowId}`), null);
    return { success: true };
  } catch (err) {
    console.error("Firebase deleteClientFlowInstance Error:", err);
    return { success: false };
  }
}

/* ==========================================================================
   SUPPORT TICKET SYSTEM HELPERS
   ========================================================================== */

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  clientId?: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  raisedById?: string;
  raisedByName?: string;
  raisedByEmail?: string;
  raisedByPhone?: string;
  raisedByRole?: string;
  assignedToType?: "admin" | "user";
  assignedToId?: string;
  assignedToName?: string;
  assignedToEmail?: string;
  assignedToPhone?: string;
  assignedToRole?: string;
  level: "level1" | "level2" | "level3" | "level4";
  levelLabel: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  isSeen?: boolean;
  seenAt?: string;
  seenBy?: string;
  seenByUserIds?: Record<string, string>; // userId/emailId -> seenAt ISO string
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

/**
 * Raise a new Support Ticket in /support_tickets
 */
export async function createSupportTicket(
  ticket: Omit<SupportTicket, "id" | "ticketNumber" | "createdAt" | "status">
): Promise<{ success: boolean; data?: SupportTicket; error?: string }> {
  try {
    const timestamp = new Date().toISOString();
    const ticketsRef = ref(db, "support_tickets");
    const snapshot = await get(ticketsRef);
    const existingCount = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    const ticketNumber = `TCK-${1000 + existingCount + 1}`;
    const newTicketRef = push(ticketsRef);
    const ticketId = newTicketRef.key || `tck_${Date.now()}`;

    const newTicket: SupportTicket = {
      ...ticket,
      id: ticketId,
      ticketNumber,
      status: "open",
      isSeen: false,
      createdAt: timestamp,
    };

    await set(ref(db, `support_tickets/${ticketId}`), newTicket);
    return { success: true, data: newTicket };
  } catch (err: any) {
    console.error("createSupportTicket Error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all Support Tickets from /support_tickets
 */
export async function getAllSupportTickets(): Promise<SupportTicket[]> {
  try {
    const snapshot = await get(ref(db, "support_tickets"));
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    const tickets = Object.values(val) as SupportTicket[];
    return tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error("getAllSupportTickets Error:", err);
    return [];
  }
}

/**
 * Mark a single ticket as seen
 */
export async function markSupportTicketSeen(
  ticketId: string,
  userId: string,
  userName?: string
): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString();
    const sanitizedUserId = sanitizeEmailToId(userId);
    const updates: Record<string, any> = {
      isSeen: true,
      seenAt: timestamp,
      seenBy: userName || userId,
      [`seenByUserIds/${sanitizedUserId}`]: timestamp,
      updatedAt: timestamp,
    };
    await update(ref(db, `support_tickets/${ticketId}`), updates);
    return true;
  } catch (err) {
    console.error("markSupportTicketSeen Error:", err);
    return false;
  }
}

/**
 * Mark multiple tickets as seen in batch
 */
export async function markAllSupportTicketsSeen(
  ticketIds: string[],
  userId: string,
  userName?: string
): Promise<boolean> {
  try {
    if (!ticketIds || ticketIds.length === 0) return true;
    const timestamp = new Date().toISOString();
    const sanitizedUserId = sanitizeEmailToId(userId);
    const updates: Record<string, any> = {};
    for (const ticketId of ticketIds) {
      updates[`support_tickets/${ticketId}/isSeen`] = true;
      updates[`support_tickets/${ticketId}/seenAt`] = timestamp;
      updates[`support_tickets/${ticketId}/seenBy`] = userName || userId;
      updates[`support_tickets/${ticketId}/seenByUserIds/${sanitizedUserId}`] = timestamp;
      updates[`support_tickets/${ticketId}/updatedAt`] = timestamp;
    }
    await update(ref(db), updates);
    return true;
  } catch (err) {
    console.error("markAllSupportTicketsSeen Error:", err);
    return false;
  }
}

/**
 * Update Support Ticket Status in /support_tickets
 */
export async function updateSupportTicketStatus(
  ticketId: string,
  status: SupportTicket["status"],
  resolvedBy?: string
): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString();
    const updateData: Record<string, any> = { status, updatedAt: timestamp };
    if (status === "resolved" || status === "closed") {
      updateData.resolvedAt = timestamp;
      if (resolvedBy) updateData.resolvedBy = resolvedBy;
    }
    await update(ref(db, `support_tickets/${ticketId}`), updateData);
    return true;
  } catch (err) {
    console.error("updateSupportTicketStatus Error:", err);
    return false;
  }
}

/**
 * Delete a Support Ticket from /support_tickets
 */
export async function deleteSupportTicket(ticketId: string): Promise<boolean> {
  try {
    await set(ref(db, `support_tickets/${ticketId}`), null);
    return true;
  } catch (err) {
    console.error("deleteSupportTicket Error:", err);
    return false;
  }
}

/**
 * Get ticket WhatsApp dispatcher instance configured by Admin
 */
export async function getTicketWhatsappInstance(): Promise<string> {
  try {
    const snap = await get(ref(db, "whatsapp_configuration/firstoptionagency/ticketWhatsappInstance"));
    if (snap.exists()) return snap.val();
    const selSnap = await get(ref(db, "whatsapp_configuration/firstoptionagency/selectedInstanceName"));
    if (selSnap.exists()) return selSnap.val();
    return "";
  } catch (err) {
    return "";
  }
}

/**
 * Set ticket WhatsApp dispatcher instance in Firebase RTDB
 */
export async function setTicketWhatsappInstance(instanceName: string): Promise<boolean> {
  try {
    await update(ref(db, "whatsapp_configuration/firstoptionagency"), {
      ticketWhatsappInstance: instanceName,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error("Error setting ticket WhatsApp instance:", err);
    return false;
  }
}

