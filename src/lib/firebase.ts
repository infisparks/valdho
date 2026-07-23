import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, update, get } from "firebase/database";

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

export interface SurveyData {
  industry?: string;
  role?: string;
  revenue?: string;
  investmentReady?: string;
}

export interface MeetingData {
  meetingDate?: string;
  meetingTime?: string;
  bookedAt?: string;
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
  links?: {
    surveyUrl?: string;
    meetingUrl?: string;
  };
}

export interface SaveLeadResult {
  leadId: string;
  createdDate: string;
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
          // Store original formatted time or key
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
 * Stage-Gated Lead Database Writer:
 * - Partial (Step 1): ONLY contact info saved (NO survey, NO links).
 * - Survey Completed (Step 2): Adds survey answers + ONLY surveyUrl link (NO meetingUrl).
 * - Completed (Step 3): Adds meeting date & time + meetingUrl link to master lead & meeting index.
 * - Realtime Slot Booking: Atomic write to slots/[campaignName]/[appointmentDate]/[slotKey]
 */
export async function saveOrUpdateLead(
  lead: LeadData,
  existingLeadId?: string | null,
  existingCreatedDate?: string | null,
  campaignName: string = "firstoptionagency"
): Promise<SaveLeadResult | null> {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const createdDate = existingCreatedDate || lead.createdDate || todayStr;
    const timestamp = new Date().toISOString();

    // Deterministic lead ID from email prefix (e.g., "mudassirs472")
    const leadId = existingLeadId || (lead.email ? sanitizeEmailToId(lead.email) : "lead_" + Date.now());

    const updates: Record<string, any> = {};

    // Base Master Lead Payload
    const leadPayload: Record<string, any> = {
      id: leadId,
      campaign: campaignName,
      createdDate: createdDate,
      createdAt: lead.createdAt || timestamp,
      updatedAt: timestamp,
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      countryCode: lead.countryCode || "+91",
      status: lead.status,
    };

    const origin = typeof window !== "undefined" ? window.location.origin : "https://firstoptionagency.in";

    // Stage 2: Survey Completed -> Attach survey answers and ONLY surveyUrl
    if (lead.status === "survey_completed" || lead.status === "completed") {
      if (lead.survey) {
        leadPayload.survey = lead.survey;
      }

      leadPayload.links = {
        surveyUrl: `${origin}/?step=survey&leadId=${leadId}&createdDate=${createdDate}`,
      };
    }

    // Stage 3: Meeting Completed -> Attach meeting details and meetingUrl
    if (lead.status === "completed" || lead.meeting) {
      if (!leadPayload.links) {
        leadPayload.links = {};
      }
      leadPayload.links.surveyUrl = `${origin}/?step=survey&leadId=${leadId}&createdDate=${createdDate}`;
      leadPayload.links.meetingUrl = `${origin}/?step=meeting&leadId=${leadId}&createdDate=${createdDate}`;

      if (lead.meeting) {
        leadPayload.meeting = {
          meetingDate: lead.meeting.meetingDate || "",
          meetingTime: lead.meeting.meetingTime || "",
          bookedAt: lead.meeting.bookedAt || timestamp,
        };
      }
    }

    // Set Master Lead Path
    updates[`campaigns/${campaignName}/leads/${createdDate}/${leadId}`] = leadPayload;

    // High-Performance Meeting Index & Atomic Slot Booking
    if (lead.meeting && lead.meeting.meetingDate && lead.meeting.meetingTime) {
      const mDate = lead.meeting.meetingDate;
      const mTime = lead.meeting.meetingTime;
      const slotKey = sanitizeSlotKey(mTime);

      const meetingIndexPayload = {
        leadId: leadId,
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        countryCode: lead.countryCode || "+91",
        meetingDate: mDate,
        meetingTime: mTime,
        status: "booked",
        createdDate: createdDate,
        bookedAt: lead.meeting.bookedAt || timestamp,
        survey: lead.survey || {},
      };

      // 1. Meeting Index Node
      updates[`campaigns/${campaignName}/meetings/${mDate}/${leadId}`] = meetingIndexPayload;

      // 2. Realtime Dedicated Slot Booking Node under slots/[campaignName]/[appointmentDate]/[slotKey]
      updates[`slots/${campaignName}/${mDate}/${slotKey}`] = {
        booked: true,
        leadId: leadId,
        fullName: lead.fullName,
        phone: lead.phone,
        bookedAt: timestamp,
      };
    }

    // Perform Atomic Write to Firebase
    await update(ref(db), updates);

    return {
      leadId,
      createdDate,
    };
  } catch (error) {
    console.error("Firebase Database Save Error:", error);
    return null;
  }
}
