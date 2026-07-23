import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, set, update, push } from "firebase/database";

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
}

export interface SaveLeadResult {
  leadId: string;
  createdDate: string;
}

/**
 * Save or Update lead entry in Realtime Database under:
 * campaigns/[campaignName]/[createdDate]/[leadId]
 *
 * Ensures ONLY ONE single node per lead under its initial creation date.
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

    let leadId = existingLeadId;

    // If no existing ID, generate a new push key under initial creation date ref
    if (!leadId) {
      const dateRef = ref(db, `campaigns/${campaignName}/${createdDate}`);
      const newRef = push(dateRef);
      leadId = newRef.key;
    }

    if (!leadId) return null;

    const leadRef = ref(db, `campaigns/${campaignName}/${createdDate}/${leadId}`);

    const payload: Record<string, any> = {
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

    if (lead.survey) {
      payload.survey = lead.survey;
    }

    if (lead.meeting) {
      payload.meeting = {
        meetingDate: lead.meeting.meetingDate || "",
        meetingTime: lead.meeting.meetingTime || "",
        bookedAt: lead.meeting.bookedAt || timestamp,
      };
    }

    // Update node directly in Firebase
    await update(leadRef, payload);

    return {
      leadId,
      createdDate,
    };
  } catch (error) {
    console.error("Firebase Database Save Error:", error);
    return null;
  }
}
