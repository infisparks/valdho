import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, update, get } from "firebase/database";
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
  survey?: SurveyData;
  meeting?: MeetingData;
  notes?: StaffNote[];
  followUpDate?: string;
  links?: {
    surveyUrl?: string;
    meetingUrl?: string;
  };
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

    // Merge staff notes & follow-up date: use new if provided, otherwise preserve existing
    const mergedNotes = lead.notes || existingLead?.notes;
    const mergedFollowUpDate = lead.followUpDate || existingLead?.followUpDate;

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
      updates[`${meetingRefPath}/updatedAt`] = timestamp;
    }

    await update(ref(db), updates);
    return true;
  } catch (error) {
    console.error("Firebase updateLeadStaffFields Error:", error);
    return false;
  }
}

