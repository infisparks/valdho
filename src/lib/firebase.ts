import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, update, push } from "firebase/database";

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
 * High-Performance Dual-Index Architecture:
 * 1. Master Lead Record -> campaigns/[campaign]/leads/[createdDate]/[leadId]
 * 2. Instant Meeting Index -> campaigns/[campaign]/meetings/[meetingDate]/[leadId]
 *
 * Uses Atomic Multi-Location Updates so CRM queries for "Today's Meetings" run in O(1) time!
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

    // Generate push ID under leads createdDate node if first time
    if (!leadId) {
      const dateRef = ref(db, `campaigns/${campaignName}/leads/${createdDate}`);
      const newRef = push(dateRef);
      leadId = newRef.key;
    }

    if (!leadId) return null;

    const updates: Record<string, any> = {};

    // 1. Master Lead Record Payload
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

    if (lead.survey) {
      leadPayload.survey = lead.survey;
    }

    if (lead.meeting) {
      leadPayload.meeting = {
        meetingDate: lead.meeting.meetingDate || "",
        meetingTime: lead.meeting.meetingTime || "",
        bookedAt: lead.meeting.bookedAt || timestamp,
      };
    }

    // Set Master Lead Path
    updates[`campaigns/${campaignName}/leads/${createdDate}/${leadId}`] = leadPayload;

    // 2. High-Performance Meeting Index Path (For CRM "Today's Meetings" View)
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
      };

      updates[`campaigns/${campaignName}/meetings/${mDate}/${leadId}`] = meetingIndexPayload;
    }

    // Perform Atomic Multi-Path Write in 1 Request
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
