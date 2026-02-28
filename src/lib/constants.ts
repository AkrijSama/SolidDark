export const LEGAL_DISCLAIMER_LINES = [
  "SolidDark provides legal information, research, and document preparation services.",
  "SolidDark is NOT a law firm and does NOT provide legal advice.",
  "SolidDark does NOT represent users in court or any legal proceeding.",
  "No attorney-client relationship is created by using SolidDark.",
  "For legal advice specific to your situation, consult a licensed attorney in your jurisdiction.",
  "SolidDark's AI analysis is supplementary — always verify critical legal information independently.",
] as const;

export const INSURANCE_DISCLAIMER_LINES = [
  "SolidDark's insurance risk assessments are informational estimates only.",
  "Actual insurance policies are underwritten and issued by licensed insurance carriers.",
  "SolidDark acts as an informational intermediary, not as an insurance company or broker (pending applicable licensing).",
  "Coverage terms, premiums, and eligibility are determined solely by the issuing carrier.",
] as const;

export const APP_NAME = "SolidDark";

export const DASHBOARD_NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/soul", label: "Soul" },
  { href: "/dashboard/continuity", label: "Continuity" },
  { href: "/dashboard/ledger", label: "Ledger" },
  { href: "/dashboard/compliance", label: "Compliance" },
  { href: "/dashboard/insurance", label: "Insurance" },
  { href: "/dashboard/collective", label: "Collective" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

export const PLAN_DETAILS = [
  {
    key: "FREE",
    name: "Free",
    price: "$0",
    description: "Get oriented and see what protections you are missing.",
  },
  {
    key: "STARTER",
    name: "Starter",
    price: "$49/mo",
    description: "Business continuity basics for solo builders.",
  },
  {
    key: "GROWTH",
    name: "Growth",
    price: "$149/mo",
    description: "Continuity, ledger, and compliance for active products.",
  },
  {
    key: "PROFESSIONAL",
    name: "Professional",
    price: "$299/mo",
    description: "Full platform access for revenue-bearing AI software.",
  },
  {
    key: "ENTERPRISE",
    name: "Enterprise",
    price: "$499+/mo",
    description: "Custom workflows for higher-risk teams and operations.",
  },
] as const;

export const JURISDICTION_DESCRIPTIONS = {
  US: "Activates US federal rules plus state business, privacy, contract, and employment considerations.",
  EU: "Activates GDPR and member-state corporate, consumer, and labor variations.",
  UK: "Activates UK company, contract, consumer, employment, and data-protection context.",
  CA: "Activates Canadian federal rules plus province-specific privacy, employment, and entity law.",
  AU: "Activates Australian federal rules plus state and territory business and employment context.",
} as const;

export const JURISDICTION_OPTIONS = {
  "United States": [
    "US-AL","US-AK","US-AZ","US-AR","US-CA","US-CO","US-CT","US-DE","US-FL","US-GA","US-HI","US-ID","US-IL","US-IN","US-IA","US-KS","US-KY","US-LA","US-ME","US-MD","US-MA","US-MI","US-MN","US-MS","US-MO","US-MT","US-NE","US-NV","US-NH","US-NJ","US-NM","US-NY","US-NC","US-ND","US-OH","US-OK","US-OR","US-PA","US-RI","US-SC","US-SD","US-TN","US-TX","US-UT","US-VT","US-VA","US-WA","US-WV","US-WI","US-WY",
  ],
  "European Union": [
    "EU-AT","EU-BE","EU-BG","EU-HR","EU-CY","EU-CZ","EU-DK","EU-EE","EU-FI","EU-FR","EU-DE","EU-GR","EU-HU","EU-IE","EU-IT","EU-LV","EU-LT","EU-LU","EU-MT","EU-NL","EU-PL","EU-PT","EU-RO","EU-SK","EU-SI","EU-ES","EU-SE",
  ],
  "United Kingdom": ["UK-ENG", "UK-SCT", "UK-WLS", "UK-NIR"],
  Canada: ["CA-AB", "CA-BC", "CA-MB", "CA-NB", "CA-NL", "CA-NS", "CA-ON", "CA-PE", "CA-QC", "CA-SK", "CA-NT", "CA-NU", "CA-YT"],
  Australia: ["AU-ACT", "AU-NSW", "AU-NT", "AU-QLD", "AU-SA", "AU-TAS", "AU-VIC", "AU-WA"],
} as const;

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  CLOUD_PROVIDER: "Cloud Provider",
  PAYMENT_PROCESSOR: "Payment Processor",
  DOMAIN_REGISTRAR: "Domain Registrar",
  HOSTING: "Hosting",
  DATABASE: "Database",
  EMAIL: "Email",
  MONITORING: "Monitoring",
  SOURCE_CONTROL: "Source Control",
  OTHER: "Other",
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  DIGITAL_POWER_OF_ATTORNEY: "Digital Power of Attorney",
  BUSINESS_CONTINUITY_PLAN: "Business Continuity Plan",
  INFRASTRUCTURE_HEIR_AGREEMENT: "Infrastructure Heir Agreement",
  CUSTOMER_NOTIFICATION_TEMPLATE: "Customer Notification Template",
  OPERATING_AGREEMENT_ADDENDUM: "Operating Agreement Addendum",
  CREDENTIAL_ACCESS_AGREEMENT: "Credential Access Agreement",
};

export const HEIR_ACCESS_LABELS: Record<string, string> = {
  FULL: "Full Access",
  OPERATIONAL: "Operational Access",
  READONLY: "Read Only",
  NOTIFICATION_ONLY: "Notification Only",
};

export const DEADMAN_INTERVAL_OPTIONS = [
  { label: "24 hours", value: 24 },
  { label: "48 hours", value: 48 },
  { label: "72 hours", value: 72 },
  { label: "7 days", value: 168 },
] as const;

export const DEADMAN_GRACE_OPTIONS = [
  { label: "12 hours", value: 12 },
  { label: "24 hours", value: 24 },
  { label: "48 hours", value: 48 },
] as const;

export const SOUL_FIRST_MESSAGE = [
  "I am the SolidDark Soul.",
  ...LEGAL_DISCLAIMER_LINES,
].join("\n");
