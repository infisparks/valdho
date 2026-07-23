export interface QuestionOption {
  label: string;
  key: string;
}

export interface QualificationQuestion {
  num: number;
  question: string;
  field: string;
  options: QuestionOption[];
}

export interface CampaignConfig {
  id: string;
  title: string;
  subtitle: string;
  questions: QualificationQuestion[];
}

export const CAMPAIGNS: Record<string, CampaignConfig> = {
  firstoptionagency: {
    id: "firstoptionagency",
    title: "First Option Agency",
    subtitle: "Let's Understand Your Business Before We Grow It",
    questions: [
      {
        num: 2,
        question: "What industry are you in? *",
        field: "industry",
        options: [
          { label: "Doctor / Clinic", key: "A" },
          { label: "Manufacturer / Distributor", key: "B" },
          { label: "IT / Tech / SaaS", key: "C" },
          { label: "Service Business", key: "D" },
          { label: "Other", key: "E" },
        ],
      },
      {
        num: 3,
        question: "What is your role in the business? *",
        field: "role",
        options: [
          { label: "Founder / Owner", key: "A" },
          { label: "Partner", key: "B" },
          { label: "Marketing Head", key: "C" },
          { label: "Team Member", key: "D" },
        ],
      },
      {
        num: 4,
        question: "What is your current monthly revenue? *",
        field: "revenue",
        options: [
          { label: "Below ₹5L", key: "A" },
          { label: "₹5L – ₹10L", key: "B" },
          { label: "₹10L – ₹25L", key: "C" },
          { label: "₹25L – ₹50L", key: "D" },
          { label: "₹50L+", key: "E" },
        ],
      },
      {
        num: 5,
        question: "Are you ready to invest in a proper marketing system if it makes financial sense? *",
        field: "investmentReady",
        options: [
          { label: "Yes", key: "A" },
          { label: "Maybe", key: "B" },
          { label: "Just exploring", key: "C" },
        ],
      },
    ],
  },
  doctors_growth: {
    id: "doctors_growth",
    title: "Doctors & Clinic Growth Campaign",
    subtitle: "Help Us Tailor Your Patient Acquisition Strategy",
    questions: [
      {
        num: 2,
        question: "What type of practice do you run? *",
        field: "practiceType",
        options: [
          { label: "Dental Clinic", key: "A" },
          { label: "Dermatology / Cosmetology", key: "B" },
          { label: "Multispecialty Hospital", key: "C" },
          { label: "Ayurveda / Wellness", key: "D" },
          { label: "Solo Practitioner", key: "E" },
        ],
      },
      {
        num: 3,
        question: "How many new patients do you want per month? *",
        field: "targetPatients",
        options: [
          { label: "15 – 30 new patients", key: "A" },
          { label: "30 – 60 new patients", key: "B" },
          { label: "60+ high-value surgeries/treatments", key: "C" },
        ],
      },
      {
        num: 4,
        question: "Are you currently running Google or Meta Ads? *",
        field: "currentAdsStatus",
        options: [
          { label: "Yes, in-house", key: "A" },
          { label: "Yes, with another agency", key: "B" },
          { label: "No, never tried before", key: "C" },
        ],
      },
    ],
  },
};

export const DEFAULT_CAMPAIGN_ID = "firstoptionagency";

export function getCampaignConfig(campaignId?: string | null): CampaignConfig {
  if (campaignId && CAMPAIGNS[campaignId]) {
    return CAMPAIGNS[campaignId];
  }
  return CAMPAIGNS[DEFAULT_CAMPAIGN_ID];
}
