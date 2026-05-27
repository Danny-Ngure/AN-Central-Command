// English translations.
// Ported from prototypes/vite-react-sketch/src/context/CampaignContext.tsx TRANSLATIONS.en.
// Add new keys to BOTH en.ts and sw.ts — a missing translation falls back to returning the key,
// which makes the omission visible in the UI (SRS NFR-031).

export const en = {
  // Navigation
  'nav.dashboard': 'Zen Dashboard',
  'nav.analytics': 'Pollings & Analysis',
  'nav.community': 'Community Intel',
  'nav.supporters': 'Supporter Network',
  'nav.issues': 'Issue Tracker',
  'nav.team': 'Team Directory',
  'nav.nyalitrack': 'NyaliTrack D-Day',
  'nav.audit': 'Security Audit Logs',
  'nav.role': 'Active Role',
  'nav.language': 'Language',
  'nav.searchPlaceholder': 'Search leaders, sites, issues, stations...',

  // Countdown Widget (SRS FR-090)
  'countdown.title': 'ELECTION COUNTDOWN',
  'countdown.days': 'Days',
  'countdown.hours': 'Hours',
  'countdown.mins': 'Mins',
  'countdown.secs': 'Secs',
  'countdown.reached': 'Election Day!',

  // Core KPIs
  'kpi.registeredVoters': 'Registered Voters',
  'kpi.villageCoverage': 'Village Coverage',
  'kpi.warmLeaders': 'Warm Contacts',
  'kpi.criticalIssues': 'Critical Issues',
  'kpi.turnoutPace': 'Turnout Pace',
  'kpi.incidents': 'Active Incidents',
  'kpi.supporters': 'Committed Supporters',
  'kpi.activeStaff': 'Active Staff',

  // Common Words
  'common.ward': 'Ward',
  'common.village': 'Village',
  'common.status': 'Status',
  'common.severity': 'Severity',
  'common.category': 'Category',
  'common.date': 'Date',
  'common.action': 'Action',
  'common.details': 'Details',
  'common.none': 'None',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.submit': 'Submit',
  'common.delete': 'Delete',
  'common.search': 'Search',
  'common.all': 'All',
  'common.active': 'Active',
  'common.inactive': 'Inactive',

  // Issue controlled vocabulary (SRS BR-030.1)
  'issue.water': 'Water Supply',
  'issue.sanitation': 'Sanitation',
  'issue.garbage': 'Garbage Collection',
  'issue.drainage': 'Drainage / Flooding',
  'issue.roads': 'Road Network',
  'issue.street_lighting': 'Street Lighting',
  'issue.electricity': 'Electricity Grid',
  'issue.security': 'Security',
  'issue.drugs_substance_abuse': 'Drug / Substance Abuse',
  'issue.gbv': 'Gender-Based Violence',
  'issue.youth_unemployment': 'Youth Unemployment',
  'issue.education': 'Education / Bursary',
  'issue.healthcare': 'Healthcare Services',
  'issue.land_disputes': 'Land Disputes',
  'issue.housing': 'Affordable Housing',
  'issue.business_permits': 'Business Permits / Fees',
  'issue.corruption': 'County Corruption',
  'issue.service_delivery': 'Public Service Delivery',
  'issue.other': 'Other Local Grievance',

  // Leader roles
  'role.imam': 'Imam',
  'role.pastor': 'Pastor',
  'role.boda_chairman': 'Boda Boda Chairman',
  'role.mama_kiongozi': 'Mama Kiongozi',
  'role.elder': 'Mzee / Elder',
  'role.chief': 'Chief / Sub-Chief',

  // Dashboard & Map
  'dashboard.mapTitle': 'Nyali Constituency Heatmap Control',
  'dashboard.heatmapA': 'Heatmap A: Coverage Recency',
  'dashboard.heatmapB': 'Heatmap B: Influence Density',
  'dashboard.heatmapC': 'Heatmap C: Persuasion Opportunity',
  'dashboard.hexOverlay': 'Toggle Hex Grid Overlay',
  'dashboard.quickActions': 'Quick Campaign Actions',
  'dashboard.logVisit': 'Log Field Visit',
  'dashboard.logIssue': 'Log Local Issue',
  'dashboard.scheduleMeeting': 'Schedule Stakeholder Meeting',

  // Access Control notices (SRS FR-002, COMP-010)
  'rbac.restricted': 'Access Gated by Database RLS Policy',
  'rbac.voterMasked': 'Voter identities are masked for DPA Compliance.',
  'rbac.notesGated': 'Sensitive strategic notes are restricted to Candidate, CM, and Chief Strategist.',
} as const;

export type TranslationKey = keyof typeof en;
