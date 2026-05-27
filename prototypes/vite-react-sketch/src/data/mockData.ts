// Mock Data for Alfayo Nelson Central Command Web Application

export interface WardInfo {
  id: string;
  name: string;
  voters: number;
  population: number;
  topIssue: string;
  coverage: number; // percentage
  centroid: { x: number; y: number };
  color: string;
}

export const WARDS: WardInfo[] = [
  { id: 'kadzandani', name: 'Kadzandani', voters: 28450, population: 45000, topIssue: 'water', coverage: 65, centroid: { x: 35, y: 30 }, color: '#7A5CFF' },
  { id: 'kongowea', name: 'Kongowea', voters: 34120, population: 52000, topIssue: 'sanitation', coverage: 82, centroid: { x: 45, y: 55 }, color: '#00E5FF' },
  { id: 'mkomani', name: 'Mkomani', voters: 22800, population: 38000, topIssue: 'drainage', coverage: 74, centroid: { x: 65, y: 70 }, color: '#FF9F1C' },
  { id: 'frere_town', name: 'Frere Town', voters: 20150, population: 31000, topIssue: 'security', coverage: 58, centroid: { x: 75, y: 40 }, color: '#FFD700' },
  { id: 'ziwa_la_ngombe', name: 'Ziwa La Ng\'ombe', voters: 24800, population: 39000, topIssue: 'youth_unemployment', coverage: 69, centroid: { x: 30, y: 75 }, color: '#FF4D4D' }
];

export interface PollingStation {
  id: string;
  name: string;
  code: string;
  wardId: string;
  subLocation: string;
  registeredVoters: number;
  turnout2013: number; // percentage
  turnout2017: number;
  turnout2022: number;
  margin2022: number; // our votes minus opponent's votes (can be negative)
  targetTurnout: number; // target turnout for 2027
  agentCheckedIn: boolean;
  agentName?: string;
  checkInTime?: string;
  currentTurnoutCount?: number;
  lastReportTime?: string;
  incidentsCount: number;
}

// Generate ~35 realistic polling stations across the 5 wards for high-fidelity listing
export const POLLING_STATIONS: PollingStation[] = [
  // Kadzandani Wards
  { id: 'ps-kad-1', name: 'Kadzandani Primary School', code: '001', wardId: 'kadzandani', subLocation: 'Kadzandani', registeredVoters: 2500, turnout2013: 72, turnout2017: 75, turnout2022: 68, margin2022: 120, targetTurnout: 80, agentCheckedIn: true, agentName: "John Mwangi", checkInTime: "06:15", currentTurnoutCount: 1450, lastReportTime: "14:00", incidentsCount: 0 },
  { id: 'ps-kad-2', name: 'Mwakirunge Secondary School', code: '002', wardId: 'kadzandani', subLocation: 'Mwakirunge', registeredVoters: 1800, turnout2013: 68, turnout2017: 71, turnout2022: 64, margin2022: -45, targetTurnout: 75, agentCheckedIn: true, agentName: "Amina Yusuf", checkInTime: "06:22", currentTurnoutCount: 920, lastReportTime: "14:15", incidentsCount: 0 },
  { id: 'ps-kad-3', name: 'Vikwatani Nursery School', code: '003', wardId: 'kadzandani', subLocation: 'Vikwatani', registeredVoters: 1200, turnout2013: 74, turnout2017: 76, turnout2022: 70, margin2022: 180, targetTurnout: 82, agentCheckedIn: false, incidentsCount: 0 },
  { id: 'ps-kad-4', name: 'Kadzandani Social Hall', code: '004', wardId: 'kadzandani', subLocation: 'Kadzandani', registeredVoters: 3100, turnout2013: 65, turnout2017: 69, turnout2022: 60, margin2022: -210, targetTurnout: 72, agentCheckedIn: true, agentName: "Peter Ochieng", checkInTime: "06:05", currentTurnoutCount: 1210, lastReportTime: "13:45", incidentsCount: 1 },
  { id: 'ps-kad-5', name: 'Mtopanga Chief\'s Camp', code: '005', wardId: 'kadzandani', subLocation: 'Mtopanga', registeredVoters: 2200, turnout2013: 70, turnout2017: 73, turnout2022: 66, margin2022: 85, targetTurnout: 78, agentCheckedIn: true, agentName: "Grace Wanjiku", checkInTime: "06:10", currentTurnoutCount: 1100, lastReportTime: "14:05", incidentsCount: 0 },

  // Kongowea Wards
  { id: 'ps-kon-1', name: 'Kongowea Primary School', code: '011', wardId: 'kongowea', subLocation: 'Kongowea A', registeredVoters: 3500, turnout2013: 78, turnout2017: 80, turnout2022: 74, margin2022: 450, targetTurnout: 85, agentCheckedIn: true, agentName: "Hassan Ali", checkInTime: "05:55", currentTurnoutCount: 2240, lastReportTime: "14:10", incidentsCount: 0 },
  { id: 'ps-kon-2', name: 'Maweni Secondary School', code: '012', wardId: 'kongowea', subLocation: 'Maweni', registeredVoters: 2800, turnout2013: 75, turnout2017: 78, turnout2022: 71, margin2022: 320, targetTurnout: 82, agentCheckedIn: true, agentName: "Mary Atieno", checkInTime: "06:02", currentTurnoutCount: 1680, lastReportTime: "14:00", incidentsCount: 0 },
  { id: 'ps-kon-3', name: 'Karama Academy', code: '013', wardId: 'kongowea', subLocation: 'Kongowea B', registeredVoters: 1500, turnout2013: 70, turnout2017: 74, turnout2022: 68, margin2022: -15, targetTurnout: 78, agentCheckedIn: true, agentName: "David Mutua", checkInTime: "06:30", currentTurnoutCount: 750, lastReportTime: "13:50", incidentsCount: 0 },
  { id: 'ps-kon-4', name: 'Kongowea Market Social Hall', code: '014', wardId: 'kongowea', subLocation: 'Kongowea A', registeredVoters: 4200, turnout2013: 76, turnout2017: 79, turnout2022: 72, margin2022: 510, targetTurnout: 84, agentCheckedIn: true, agentName: "Fatuma Said", checkInTime: "06:01", currentTurnoutCount: 2310, lastReportTime: "14:20", incidentsCount: 2 },
  { id: 'ps-kon-5', name: 'Uwanja wa Mbuzi Grounds', code: '015', wardId: 'kongowea', subLocation: 'Maweni', registeredVoters: 2900, turnout2013: 81, turnout2017: 83, turnout2022: 77, margin2022: 620, targetTurnout: 88, agentCheckedIn: true, agentName: "James Kamau", checkInTime: "05:48", currentTurnoutCount: 1980, lastReportTime: "14:15", incidentsCount: 0 },

  // Mkomani Wards
  { id: 'ps-mko-1', name: 'Mkomani Primary School', code: '021', wardId: 'mkomani', subLocation: 'Mkomani', registeredVoters: 2400, turnout2013: 71, turnout2017: 73, turnout2022: 67, margin2022: 80, targetTurnout: 78, agentCheckedIn: true, agentName: "Salim Omar", checkInTime: "06:14", currentTurnoutCount: 1280, lastReportTime: "13:55", incidentsCount: 0 },
  { id: 'ps-mko-2', name: 'Nyali Baptist Church Hall', code: '022', wardId: 'mkomani', subLocation: 'Nyali', registeredVoters: 3100, turnout2013: 64, turnout2017: 67, turnout2022: 61, margin2022: -140, targetTurnout: 70, agentCheckedIn: true, agentName: "Jane Mshai", checkInTime: "06:18", currentTurnoutCount: 1420, lastReportTime: "14:02", incidentsCount: 0 },
  { id: 'ps-mko-3', name: 'Mombasa Academy', code: '023', wardId: 'mkomani', subLocation: 'Nyali', registeredVoters: 1600, turnout2013: 60, turnout2017: 62, turnout2022: 56, margin2022: -350, targetTurnout: 65, agentCheckedIn: false, incidentsCount: 0 },
  { id: 'ps-mko-4', name: 'Tudor Creek Nursery School', code: '024', wardId: 'mkomani', subLocation: 'Mkomani', registeredVoters: 1900, turnout2013: 73, turnout2017: 75, turnout2022: 69, margin2022: 155, targetTurnout: 80, agentCheckedIn: true, agentName: "George Otieno", checkInTime: "06:03", currentTurnoutCount: 1050, lastReportTime: "14:10", incidentsCount: 0 },

  // Frere Town Wards
  { id: 'ps-fre-1', name: 'Frere Town Primary School', code: '031', wardId: 'frere_town', subLocation: 'Frere Town', registeredVoters: 2700, turnout2013: 74, turnout2017: 77, turnout2022: 71, margin2022: 240, targetTurnout: 80, agentCheckedIn: true, agentName: "Zainab Salim", checkInTime: "06:07", currentTurnoutCount: 1540, lastReportTime: "14:05", incidentsCount: 0 },
  { id: 'ps-fre-2', name: 'Frere Town Community Hall', code: '032', wardId: 'frere_town', subLocation: 'Frere Town', registeredVoters: 2100, turnout2013: 72, turnout2017: 74, turnout2022: 68, margin2022: 110, targetTurnout: 78, agentCheckedIn: true, agentName: "Brian Juma", checkInTime: "06:21", currentTurnoutCount: 1080, lastReportTime: "13:58", incidentsCount: 1 },
  { id: 'ps-fre-3', name: 'Maweni Chief\'s Office', code: '033', wardId: 'frere_town', subLocation: 'Maweni', registeredVoters: 1800, turnout2013: 69, turnout2017: 72, turnout2022: 65, margin2022: 30, targetTurnout: 75, agentCheckedIn: false, incidentsCount: 0 },
  { id: 'ps-fre-4', name: 'Buxton Nursery School', code: '034', wardId: 'frere_town', subLocation: 'Frere Town', registeredVoters: 1400, turnout2013: 75, turnout2017: 78, turnout2022: 72, margin2022: 195, targetTurnout: 82, agentCheckedIn: true, agentName: "Mercy Chebet", checkInTime: "05:58", currentTurnoutCount: 880, lastReportTime: "14:12", incidentsCount: 0 },

  // Ziwa La Ng'ombe Wards
  { id: 'ps-ziw-1', name: 'Ziwa La Ng\'ombe Primary', code: '041', wardId: 'ziwa_la_ngombe', subLocation: 'Ziwa La Ng\'ombe', registeredVoters: 3200, turnout2013: 70, turnout2017: 73, turnout2022: 66, margin2022: 140, targetTurnout: 78, agentCheckedIn: true, agentName: "Robert Ndwiga", checkInTime: "06:12", currentTurnoutCount: 1690, lastReportTime: "14:04", incidentsCount: 0 },
  { id: 'ps-ziw-2', name: 'Ziwa La Ng\'ombe Social Hall', code: '042', wardId: 'ziwa_la_ngombe', subLocation: 'Ziwa La Ng\'ombe', registeredVoters: 2500, turnout2013: 68, turnout2017: 71, turnout2022: 64, margin2022: 50, targetTurnout: 75, agentCheckedIn: true, agentName: "Aswani Philip", checkInTime: "06:29", currentTurnoutCount: 1120, lastReportTime: "13:48", incidentsCount: 0 },
  { id: 'ps-ziw-3', name: 'Shanzu Teachers Training College', code: '043', wardId: 'ziwa_la_ngombe', subLocation: 'Shanzu', registeredVoters: 3900, turnout2013: 63, turnout2017: 65, turnout2022: 59, margin2022: -420, targetTurnout: 70, agentCheckedIn: true, agentName: "Leah Wanjala", checkInTime: "06:00", currentTurnoutCount: 1820, lastReportTime: "14:15", incidentsCount: 1 },
  { id: 'ps-ziw-4', name: 'Shanzu Primary School', code: '044', wardId: 'ziwa_la_ngombe', subLocation: 'Shanzu', registeredVoters: 2000, turnout2013: 71, turnout2017: 74, turnout2022: 68, margin2022: 120, targetTurnout: 80, agentCheckedIn: true, agentName: "Emmanuel Mwenda", checkInTime: "06:05", currentTurnoutCount: 1140, lastReportTime: "14:08", incidentsCount: 0 }
];

export interface CommunityLeader {
  id: string;
  fullName: string;
  phone?: string;
  whatsappPhone?: string;
  email?: string;
  roleTitle: string; // Imam, Pastor, Boda Chairman, Mama Kiongozi, Chief, Elder, etc.
  affiliatedSiteId?: string;
  village: string;
  wardId: string;
  influenceReach: 'small' | 'medium' | 'large' | 'unknown';
  politicalLean: 'supportive' | 'leaning_supportive' | 'neutral' | 'leaning_opposition' | 'opposition' | 'unknown';
  relationshipTemperature: 'warm' | 'cool' | 'cold' | 'hostile' | 'not_approached';
  ownedByPersonId: string;
  sensitiveNotes?: string;
  isQueuedForReview?: boolean;
}

export const COMMUNITY_LEADERS: CommunityLeader[] = [
  { id: 'ldr-1', fullName: 'Sheikh Abdalla Majid', phone: '+254711223344', whatsappPhone: '+254711223344', roleTitle: 'Imam (Kongowea Mosque)', village: 'Kongowea A', wardId: 'kongowea', influenceReach: 'large', politicalLean: 'supportive', relationshipTemperature: 'warm', ownedByPersonId: 'team-3', sensitiveNotes: 'Highly influential in Kongowea A. Supports Alfayo because of the water project. Keep him close.' },
  { id: 'ldr-2', fullName: 'Pastor Ezekiel Mulwa', phone: '+254722334455', roleTitle: 'Pastor (Nyali Baptist)', village: 'Nyali', wardId: 'mkomani', influenceReach: 'medium', politicalLean: 'leaning_supportive', relationshipTemperature: 'warm', ownedByPersonId: 'team-3', sensitiveNotes: 'Requested assistance with youth sports sponsorships. Receptive to our manifestos.' },
  { id: 'ldr-3', fullName: 'Mama Fatuma Jeneby', phone: '+254733445566', roleTitle: 'Mama Kiongozi (Women group)', village: 'Maweni', wardId: 'kongowea', influenceReach: 'large', politicalLean: 'supportive', relationshipTemperature: 'warm', ownedByPersonId: 'team-5', sensitiveNotes: 'Chama chairlady. Can mobilize over 200 active women voters.' },
  { id: 'ldr-4', fullName: 'Josephat Karisa', phone: '+254744556677', roleTitle: 'Boda Boda Chairman (Kadzandani Stage)', village: 'Kadzandani', wardId: 'kadzandani', influenceReach: 'large', politicalLean: 'neutral', relationshipTemperature: 'cool', ownedByPersonId: 'team-4', sensitiveNotes: 'Demanding support for boda shed construction. Flipped from opposition recently, needs monitoring.' },
  { id: 'ldr-5', fullName: 'Elder Mzee Benjamin Mwangi', phone: '+254755667788', roleTitle: 'Elder', village: 'Frere Town', wardId: 'frere_town', influenceReach: 'medium', politicalLean: 'leaning_opposition', relationshipTemperature: 'cold', ownedByPersonId: 'team-6', sensitiveNotes: 'Close to opponent\'s family. Open to dialogue but skeptical. Focus on local drainage issues during chats.' },
  { id: 'ldr-6', fullName: 'Reverend Agnes Kendi', phone: '+254701234567', roleTitle: 'Pastor (Methodist)', village: 'Ziwa La Ng\'ombe', wardId: 'ziwa_la_ngombe', influenceReach: 'medium', politicalLean: 'supportive', relationshipTemperature: 'warm', ownedByPersonId: 'team-7', sensitiveNotes: 'Very positive about our education bursary programs.' },
  { id: 'ldr-7', fullName: 'Hassan "Chura" Bakari', phone: '+254789654321', roleTitle: 'Boda Boda Chairman (Mkomani Stage)', village: 'Mkomani', wardId: 'mkomani', influenceReach: 'medium', politicalLean: 'opposition', relationshipTemperature: 'hostile', ownedByPersonId: 'team-4', sensitiveNotes: 'Hardliner supporter of opponent candidate. Attempts to engage have been rejected.' },

  // Queued for Review (submitted by field canvassers)
  { id: 'ldr-q1', fullName: 'Mama Sophia Ochola', phone: '+254712345678', roleTitle: 'Chama Coordinator', village: 'Mwakirunge', wardId: 'kadzandani', influenceReach: 'medium', politicalLean: 'unknown', relationshipTemperature: 'not_approached', ownedByPersonId: 'team-9', isQueuedForReview: true },
  { id: 'ldr-q2', fullName: 'Imam Ramadhan Athman', phone: '+254723456789', roleTitle: 'Imam', village: 'Vikwatani', wardId: 'kadzandani', influenceReach: 'large', politicalLean: 'leaning_supportive', relationshipTemperature: 'cool', ownedByPersonId: 'team-9', isQueuedForReview: true }
];

export interface CommunitySite {
  id: string;
  name: string;
  type: string; // church, mosque, school, market, boda_stage, chama, community_hall, etc.
  wardId: string;
  village: string;
  estimatedSize: number; // capacity / active users
  meetingSchedule?: string;
  keyContactId?: string; // Links to CommunityLeader
  politicalClimate: string;
  lastVisitedAt?: string;
  visitHistoryCount: number;
}

export const COMMUNITY_SITES: CommunitySite[] = [
  { id: 'site-1', name: 'Kongowea Central Mosque', type: 'mosque', wardId: 'kongowea', village: 'Kongowea A', estimatedSize: 1200, meetingSchedule: 'Fridays 13:00', keyContactId: 'ldr-1', politicalClimate: 'Highly supportive, warm reception during candidates\' visits.', lastVisitedAt: '2026-05-15', visitHistoryCount: 4 },
  { id: 'site-2', name: 'Nyali Baptist Church', type: 'church', wardId: 'mkomani', village: 'Nyali', estimatedSize: 800, meetingSchedule: 'Sundays 09:00 & 11:00', keyContactId: 'ldr-2', politicalClimate: 'Polite, neutral/receptive. Strategic spot for youth engagements.', lastVisitedAt: '2026-05-10', visitHistoryCount: 2 },
  { id: 'site-3', name: 'Kongowea Open Air Market', type: 'market', wardId: 'kongowea', village: 'Kongowea B', estimatedSize: 5000, meetingSchedule: 'Daily', politicalClimate: 'Mixed. Very critical of county service delivery. Strong business permit grievances.', lastVisitedAt: '2026-05-20', visitHistoryCount: 6 },
  { id: 'site-4', name: 'Kadzandani Junction Boda Stage', type: 'boda_stage', wardId: 'kadzandani', village: 'Kadzandani', estimatedSize: 80, keyContactId: 'ldr-4', politicalClimate: 'Flipped to supportive after campaign funded the stage shelter repairs.', lastVisitedAt: '2026-05-18', visitHistoryCount: 5 },
  { id: 'site-5', name: 'Frere Town Community Hall', type: 'community_hall', wardId: 'frere_town', village: 'Frere Town', estimatedSize: 300, politicalClimate: 'Neutral. Location of many multi-party public barazas.', lastVisitedAt: '2026-04-28', visitHistoryCount: 1 }
];

export interface CampaignProgram {
  id: string;
  name: string;
  type: string; // bursary, harambee, water_project, sanitation_project, women_group_support, youth_program, medical_support, etc.
  wardScope: string[]; // wardIds
  leadCoordinatorId: string; // team member id
  beneficiaryCount: number;
  activeDates: string;
  description: string;
}

export const CAMPAIGN_PROGRAMS: CampaignProgram[] = [
  { id: 'prog-1', name: 'Alfayo Nelson Education Bursary', type: 'bursary', wardScope: ['kadzandani', 'kongowea', 'mkomani', 'frere_town', 'ziwa_la_ngombe'], leadCoordinatorId: 'team-3', beneficiaryCount: 450, activeDates: 'Jan 2026 - Present', description: 'School fees subsidies targeting needy secondary and university students in Nyali.' },
  { id: 'prog-2', name: 'Kongowea Clean Water Borehole Initiative', type: 'water_project', wardScope: ['kongowea'], leadCoordinatorId: 'team-5', beneficiaryCount: 2500, activeDates: 'Mar 2026 - May 2026', description: 'Drilling and plumbing of public solar-powered water borehole kiosks at Maweni and Kongowea B.' },
  { id: 'prog-3', name: 'Nyali Youth Sports Kits & Sponsorship', type: 'youth_program', wardScope: ['mkomani', 'ziwa_la_ngombe'], leadCoordinatorId: 'team-7', beneficiaryCount: 300, activeDates: 'Feb 2026 - Present', description: 'Providing sports equipment, jerseys, and tournament cash prizes to local youth soccer and volleyball clubs.' },
  { id: 'prog-4', name: 'Chama Seed Capital Support', type: 'women_group_support', wardScope: ['kadzandani', 'frere_town'], leadCoordinatorId: 'team-6', beneficiaryCount: 180, activeDates: 'Apr 2026 - Present', description: 'Table banking booster funds for registered women self-help chamas to expand market trading.' }
];

export interface CommittedSupporter {
  id: string;
  fullName: string;
  nationalIdMasked: string;
  pollingStationId: string;
  communityProgramId: string;
  commitmentTier: 'strong_commit' | 'likely' | 'probable' | 'unverified';
  registeringPersonId: string;
  consentMethod: 'verbal_witnessed' | 'written_signed' | 'sms_confirmed' | 'in_person_app';
  consentCapturedAt: string;
  lastVerifiedDate: string;
  notes?: string;
  withdrawn: boolean;
  withdrawnAt?: string;
}

export const COMMITTED_SUPPORTERS: CommittedSupporter[] = [
  { id: 'sup-1', fullName: 'David Kiprop Cheruiyot', nationalIdMasked: '*****849', pollingStationId: 'ps-kad-1', communityProgramId: 'prog-1', commitmentTier: 'strong_commit', registeringPersonId: 'team-4', consentMethod: 'written_signed', consentCapturedAt: '2026-03-12 11:30:00', lastVerifiedDate: '2026-05-10', notes: 'Parent of bursary beneficiary. Actively campaigning for us in Kadzandani.', withdrawn: false },
  { id: 'sup-2', fullName: 'Halima Suleiman Bakari', nationalIdMasked: '*****204', pollingStationId: 'ps-kon-1', communityProgramId: 'prog-2', commitmentTier: 'strong_commit', registeringPersonId: 'team-5', consentMethod: 'verbal_witnessed', consentCapturedAt: '2026-04-18 15:45:00', lastVerifiedDate: '2026-04-18', notes: 'Kiosk vendor. Extremely grateful for the borehole project.', withdrawn: false },
  { id: 'sup-3', fullName: 'Kevin Omwamba Nyairo', nationalIdMasked: '*****517', pollingStationId: 'ps-ziw-3', communityProgramId: 'prog-3', commitmentTier: 'likely', registeringPersonId: 'team-7', consentMethod: 'in_person_app', consentCapturedAt: '2026-02-28 17:15:00', lastVerifiedDate: '2026-02-28', notes: 'Captain of Ziwa Stars FC. Supports Alfayo but team has some members split.', withdrawn: false },
  { id: 'sup-4', fullName: 'Mary Mutheu Nzomo', nationalIdMasked: '*****932', pollingStationId: 'ps-fre-1', communityProgramId: 'prog-4', commitmentTier: 'probable', registeringPersonId: 'team-6', consentMethod: 'verbal_witnessed', consentCapturedAt: '2026-05-02 09:20:00', lastVerifiedDate: '2026-05-02', notes: 'Chama member. Received booster seed fund.', withdrawn: false },
  { id: 'sup-5', fullName: 'Athman Omar Mwafondo', nationalIdMasked: '*****115', pollingStationId: 'ps-kon-2', communityProgramId: 'prog-2', commitmentTier: 'unverified', registeringPersonId: 'team-5', consentMethod: 'sms_confirmed', consentCapturedAt: '2026-01-20 12:00:00', lastVerifiedDate: '2026-01-20', notes: 'Stale record (>90 days since verification). Needs re-verification.', withdrawn: false }
];

export interface CampaignIssue {
  id: string;
  villageId: string;
  villageName: string;
  wardId: string;
  category: string;
  title: string;
  description: string;
  severity: 'minor' | 'moderate' | 'serious' | 'critical';
  affectsEstimatedVoters: number;
  status: 'reported' | 'investigating' | 'addressed' | 'resolved';
  adminResponsiveness: 'unresponsive' | 'slow' | 'cooperative';
  candidatePosition: string;
  verified: boolean;
  lastVerifiedAt: string;
}

export const CAMPAIGN_ISSUES: CampaignIssue[] = [
  { id: 'iss-1', villageId: 'vil-kon-1', villageName: 'Maweni', wardId: 'kongowea', category: 'sanitation', title: 'Open burst sewage pipe in Maweni settlement', description: 'Burst sewer line near Maweni clinic flowing open on the street for 3 weeks. Creating high cholera risk. Local county admin unresponsive.', severity: 'critical', affectsEstimatedVoters: 1200, status: 'reported', adminResponsiveness: 'unresponsive', candidatePosition: 'Alfayo has raised this to water services department and pledged to allocate ward emergency funds to block it if the county fails to act by Friday.', verified: true, lastVerifiedAt: '2026-05-20' },
  { id: 'iss-2', villageId: 'vil-kad-1', villageName: 'Vikwatani', wardId: 'kadzandani', category: 'water', title: 'High water prices by local water vendor cartels', description: 'Piped water cut off since Feb. Cartels charging 50 Shillings per 20L jerrycan, which is unaffordable for residents.', severity: 'serious', affectsEstimatedVoters: 2500, status: 'investigating', adminResponsiveness: 'slow', candidatePosition: 'We are mapping sites to sink 2 clean water borehole kiosks in Vikwatani to bypass the water cartel monopoly.', verified: true, lastVerifiedAt: '2026-05-18' },
  { id: 'iss-3', villageId: 'vil-mko-1', villageName: 'Mkomani Flat area', wardId: 'mkomani', category: 'drainage', title: 'Clogged drainage channels causing flooding', description: 'Main stormwater drains choked with plastic waste. Heavy rainfall triggers flooding inside houses in the flat estates.', severity: 'serious', affectsEstimatedVoters: 800, status: 'addressed', adminResponsiveness: 'cooperative', candidatePosition: 'Alfayo sponsored a youth cleaning drive last weekend which cleared the plastic blockages. Sponsoring dustbins installation next.', verified: true, lastVerifiedAt: '2026-05-24' },
  { id: 'iss-4', villageId: 'vil-ziw-1', villageName: 'Ziwa La Ng\'ombe village', wardId: 'ziwa_la_ngombe', category: 'youth_unemployment', title: 'Lack of vocational jobs forcing youth into crime', description: 'High concentration of idle youth at Ziwa center. Incidence of petty theft on the rise near Shanzu border.', severity: 'serious', affectsEstimatedVoters: 1500, status: 'reported', adminResponsiveness: 'slow', candidatePosition: 'Advocating for establishing a Youth Empowerment center with tailoring and computer training booths.', verified: false, lastVerifiedAt: '2026-03-01' } // Stale issue (>90 days since verification)
];

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  wardId?: string;
  reportsToId?: string;
  activeStatus: boolean; // Active if used app in last 7 days
  imageUrl?: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'team-1', name: 'Alfayo Nelson', role: 'Aspirant (Candidate)', phone: '+254700000001', email: 'alfayo@alfayonelson.campaign', activeStatus: true },
  { id: 'team-2', name: 'Julius Mwawana', role: 'Campaign Manager', phone: '+254700000002', email: 'julius@alfayonelson.campaign', reportsToId: 'team-1', activeStatus: true },
  { id: 'team-3', name: 'Dr. Sarah Kilonzo', role: 'Chief Strategist', phone: '+254700000003', email: 'sarah@alfayonelson.campaign', reportsToId: 'team-2', activeStatus: true },
  { id: 'team-4', name: 'Commander Mike Ndurya', role: 'Constituency Coordinator', phone: '+254700000004', email: 'mike@alfayonelson.campaign', reportsToId: 'team-2', activeStatus: true },
  { id: 'team-5', name: 'Gladys Atieno', role: 'Ward Coordinator (Kongowea)', phone: '+254700000005', email: 'gladys.kon@alfayonelson.campaign', wardId: 'kongowea', reportsToId: 'team-4', activeStatus: true },
  { id: 'team-6', name: 'Bernard Mwanzia', role: 'Ward Coordinator (Frere Town)', phone: '+254700000006', email: 'bernard.fre@alfayonelson.campaign', wardId: 'frere_town', reportsToId: 'team-4', activeStatus: true },
  { id: 'team-7', name: 'Ali Athman', role: 'Ward Coordinator (Mkomani)', phone: '+254700000007', email: 'ali.mko@alfayonelson.campaign', wardId: 'mkomani', reportsToId: 'team-4', activeStatus: true },
  { id: 'team-8', name: 'Sila Kadenge', role: 'Ward Coordinator (Kadzandani)', phone: '+254700000008', email: 'sila.kad@alfayonelson.campaign', wardId: 'kadzandani', reportsToId: 'team-4', activeStatus: false },
  { id: 'team-9', name: 'Esther Chepkwony', role: 'Ward Coordinator (Ziwa La Ng\'ombe)', phone: '+254700000009', email: 'esther.ziw@alfayonelson.campaign', wardId: 'ziwa_la_ngombe', reportsToId: 'team-4', activeStatus: true }
];

export interface CampaignActivity {
  id: string;
  title: string;
  type: string; // rally, baraza, community_meeting, town_hall, mosque_visit, church_visit, etc.
  scheduledAt: string;
  location: string;
  wardId: string;
  village: string;
  expectedAttendance?: number;
  actualAttendance?: number;
  ownerId: string;
  status: 'planned' | 'confirmed' | 'completed' | 'cancelled';
  candidateAttended: boolean;
  outcomeNotes?: string;
  followUpRequired: boolean;
  attendedLeadersIds?: string[];
}

export const CAMPAIGN_ACTIVITIES: CampaignActivity[] = [
  { id: 'act-1', title: 'Kongowea Market Baraza', type: 'baraza', scheduledAt: '2026-05-20 10:00:00', location: 'Kongowea Market Stage', wardId: 'kongowea', village: 'Kongowea B', expectedAttendance: 500, actualAttendance: 650, ownerId: 'team-5', status: 'completed', candidateAttended: true, outcomeNotes: 'Successful baraza. Addressed small business permit charges. Flipped 2 chama leaders.', followUpRequired: true, attendedLeadersIds: ['ldr-1', 'ldr-3'] },
  { id: 'act-2', title: 'Vikwatani Village Stakeholder Meeting', type: 'community_meeting', scheduledAt: '2026-05-24 14:00:00', location: 'Vikwatani Nursery grounds', wardId: 'kadzandani', village: 'Vikwatani', expectedAttendance: 80, actualAttendance: 95, ownerId: 'team-8', status: 'completed', candidateAttended: false, outcomeNotes: 'Discussed clean water boreholes project scope. Josephat Karisa confirmed support.', followUpRequired: false, attendedLeadersIds: ['ldr-4'] },
  { id: 'act-3', title: 'Nyali Baptist Youth Rally', type: 'youth_event', scheduledAt: '2026-05-30 15:00:00', location: 'Nyali Baptist Grounds', wardId: 'mkomani', village: 'Nyali', expectedAttendance: 300, ownerId: 'team-7', status: 'confirmed', candidateAttended: true, followUpRequired: true },
  { id: 'act-4', title: 'Frere Town Church Courtesy Call', type: 'church_visit', scheduledAt: '2026-05-28 09:30:00', location: 'ACK St. Emmanuel Frere Town', wardId: 'frere_town', village: 'Frere Town', expectedAttendance: 50, ownerId: 'team-6', status: 'confirmed', candidateAttended: true, followUpRequired: false }
];

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  role: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeValue?: string;
  afterValue?: string;
  ipAddress: string;
}

export const SEEDED_AUDIT_LOGS: AuditLog[] = [
  { id: 'aud-1', timestamp: '2026-05-26 09:00:15', actorId: 'team-2', actorName: 'Julius Mwawana', role: 'Campaign Manager', action: 'LOGIN', entityType: 'auth', ipAddress: '197.248.32.10' },
  { id: 'aud-2', timestamp: '2026-05-26 09:12:44', actorId: 'team-2', actorName: 'Julius Mwawana', role: 'Campaign Manager', action: 'LOOKUP_VOTER', entityType: 'voter', entityId: 'sup-1', ipAddress: '197.248.32.10' },
  { id: 'aud-3', timestamp: '2026-05-26 10:05:00', actorId: 'team-3', actorName: 'Dr. Sarah Kilonzo', role: 'Chief Strategist', action: 'LOGIN', entityType: 'auth', ipAddress: '41.89.20.105' },
  { id: 'aud-4', timestamp: '2026-05-26 11:30:12', actorId: 'team-5', actorName: 'Gladys Atieno', role: 'Ward Coordinator', action: 'REGISTER_SUPPORTER', entityType: 'supporter', entityId: 'sup-2', ipAddress: '102.22.45.66' },
  { id: 'aud-5', timestamp: '2026-05-26 13:45:20', actorId: 'team-3', actorName: 'Dr. Sarah Kilonzo', role: 'Chief Strategist', action: 'EXPORT_PDF_WARD_BRIEF', entityType: 'analytics', entityId: 'kadzandani', ipAddress: '41.89.20.105' }
];

export interface IncidentReport {
  id: string;
  stationId: string;
  stationName: string;
  category: 'voter_intimidation' | 'agent_obstruction' | 'ballot_issue' | 'materials_shortage' | 'violence' | 'dispute' | 'technical_failure' | 'other';
  severity: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  gps?: { lat: number; lng: number };
  timestamp: string;
  reportedBy: string;
  status: 'reported' | 'investigating' | 'resolved';
}

export const SEEDED_INCIDENTS: IncidentReport[] = [
  { id: 'inc-1', stationId: 'ps-kad-4', stationName: 'Kadzandani Social Hall', category: 'materials_shortage', severity: 'moderate', description: 'KIEMS kit failing to scan fingerprints. Queue delaying.', timestamp: '2026-05-26 09:30:00', reportedBy: 'Peter Ochieng', status: 'resolved' },
  { id: 'inc-2', stationId: 'ps-fre-2', stationName: 'Frere Town Community Hall', category: 'voter_intimidation', severity: 'critical', description: 'Group of youth crowding entrance intimidating voters. Police alerted.', timestamp: '2026-05-26 12:15:00', reportedBy: 'Brian Juma', status: 'investigating' },
  { id: 'inc-3', stationId: 'ps-ziw-3', stationName: 'Shanzu Teachers Training College', category: 'technical_failure', severity: 'serious', description: 'Power blackout inside the voting center. Running on lantern backups.', timestamp: '2026-05-26 13:50:00', reportedBy: 'Leah Wanjala', status: 'reported' }
];
