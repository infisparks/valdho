import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, update, get, set } from "firebase/database";
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
      Object.keys(data).forEach((key) => {
        if (data[key] && data[key].booked) {
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
    console.error("Firebase getLeadById Error:", error);
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
        if (allDatesObj[dKey] && allDatesObj[dKey][leadId]) {
          return {
            lead: allDatesObj[dKey][leadId] as LeadData,
            createdDate: dKey,
          };
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Firebase findExistingLead Error:", error);
    return null;
  }
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

    // Merge meeting data: use new meeting if provided, otherwise keep existing meeting
    const mergedMeeting = lead.meeting || existingLead?.meeting;

    // Merge staff notes, follow-up date, pipeline stage, deal value & onboard data: use new if provided, otherwise preserve existing
    const mergedNotes = lead.notes || existingLead?.notes;
    const mergedFollowUpDate = lead.followUpDate || existingLead?.followUpDate;
    const mergedPipelineStage = lead.pipelineStage || existingLead?.pipelineStage;
    const mergedDealValue = lead.dealValue !== undefined ? lead.dealValue : existingLead?.dealValue;
    const mergedOnboarded = lead.onboarded !== undefined ? lead.onboarded : existingLead?.onboarded;
    const mergedOnboardedAt = lead.onboardedAt || existingLead?.onboardedAt;
    const mergedOnboardCount = lead.onboardCount !== undefined ? lead.onboardCount : existingLead?.onboardCount;

    // Base Master Lead Payload
    const leadPayload: LeadData = {
      id: leadId,
      campaign: campaignName,
      createdDate: createdDate,
      createdAt: existingLead?.createdAt || lead.createdAt || timestamp,
      updatedAt: timestamp,
      fullName: lead.fullName || existingLead?.fullName || "",
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
 * Staff CRM Helper: Add/update staff notes and follow-up date for a lead
 */
export async function updateLeadStaffFields(
  leadId: string,
  createdDate: string,
  staffData: {
    notes?: StaffNote[];
    followUpDate?: string;
    pipelineStage?: string;
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
      }
      if (staffData.dealValue !== undefined) {
        updates[`${meetingRefPath}/dealValue`] = staffData.dealValue;
      }
      updates[`${meetingRefPath}/updatedAt`] = timestamp;
    }

    await update(ref(db), updates);
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
  uid?: string;
  updatedAt?: string;
}

export const MASTER_ADMIN_UID = "Z6Q2eQIQQuQf1rgk1hdWWxVUdLX2";

const DEFAULT_ROLES: RoleData[] = [
  { id: "role_admin", name: "Admin", description: "Full system administration & role management access", isDeleted: false },
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
 * Register a user entry by Email ONLY into Firebase /users node so Admin can assign their role. No UID needed!
 */
export async function registerUserByEmail(
  email: string,
  roleId: string = "role_onboarding",
  roleName: string = "Onboarding Specialist"
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

