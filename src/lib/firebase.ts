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
 * Clean Stage-Based Lead Database Writer:
 * - Partial (Step 1): ONLY contact info is saved (NO dummy survey, NO links).
 * - Survey Completed (Step 2): Adds survey answers + re-engagement links.
 * - Completed (Step 3): Adds meeting date & time to master lead + meeting index.
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

    // ONLY attach survey answers & links if user actually completed Step 2 (or beyond)
    if (lead.status !== "partial") {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://firstoptionagency.in";
      leadPayload.links = {
        surveyUrl: `${origin}/?step=survey&leadId=${leadId}&createdDate=${createdDate}`,
        meetingUrl: `${origin}/?step=meeting&leadId=${leadId}&createdDate=${createdDate}`,
      };

      if (lead.survey) {
        leadPayload.survey = lead.survey;
      }
    }

    // ONLY attach meeting details if user actually picked a time slot in Step 3
    if (lead.meeting) {
      leadPayload.meeting = {
        meetingDate: lead.meeting.meetingDate || "",
        meetingTime: lead.meeting.meetingTime || "",
        bookedAt: lead.meeting.bookedAt || timestamp,
      };
    }

    // Set Master Lead Path
    updates[`campaigns/${campaignName}/leads/${createdDate}/${leadId}`] = leadPayload;

    // High-Performance Meeting Index Path (For CRM "Today's Meetings" View)
    if (lead.meeting && lead.meeting.meetingDate) {
      const mDate = lead.meeting.meetingDate;
      const meetingIndexPayload = {
        leadId: leadId,
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        countryCode: lead.countryCode || "+91",
        meetingDate: mDate,
        meetingTime: lead.meeting.meetingTime || "",
        status: "booked",
        createdDate: createdDate,
        bookedAt: lead.meeting.bookedAt || timestamp,
        survey: lead.survey || {},
      };

      updates[`campaigns/${campaignName}/meetings/${mDate}/${leadId}`] = meetingIndexPayload;
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
