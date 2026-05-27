import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  WARDS,
  POLLING_STATIONS,
  COMMUNITY_LEADERS,
  COMMUNITY_SITES,
  CAMPAIGN_PROGRAMS,
  COMMITTED_SUPPORTERS,
  CAMPAIGN_ISSUES,
  TEAM_MEMBERS,
  CAMPAIGN_ACTIVITIES,
  SEEDED_AUDIT_LOGS,
  SEEDED_INCIDENTS,
  WardInfo,
  PollingStation,
  CommunityLeader,
  CommunitySite,
  CampaignProgram,
  CommittedSupporter,
  CampaignIssue,
  TeamMember,
  CampaignActivity,
  AuditLog,
  IncidentReport
} from '../data/mockData';

// Swahili-English Translation Dictionary
const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
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
    
    // Countdown Widget
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
    
    // Issues controlled vocabulary
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
    
    // Access Control warnings
    'rbac.restricted': 'Access Gated by Database RLS Policy (Simulated)',
    'rbac.voterMasked': 'Voter identities are masked for DPA Compliance.',
    'rbac.notesGated': 'Sensitive strategic notes are restricted to Candidate, CM, and Chief Strategist.'
  },
  sw: {
    // Navigation
    'nav.dashboard': 'Dashibodi ya Zen',
    'nav.analytics': 'Uchambuzi wa Kura',
    'nav.community': 'Ujasusi wa Jamii',
    'nav.supporters': 'Mtandao wa Wafuasi',
    'nav.issues': 'Mfuatiliaji wa Shida',
    'nav.team': 'Saraka ya Timu',
    'nav.nyalitrack': 'Siku ya Kura (NyaliTrack)',
    'nav.audit': 'Kumbukumbu za Usalama',
    'nav.role': 'Jukumu Lako',
    'nav.language': 'Lugha',
    'nav.searchPlaceholder': 'Tafuta viongozi, maeneo, shida, vituo...',
    
    // Countdown Widget
    'countdown.title': 'MUDU WA KUELEKEA KURA',
    'countdown.days': 'Siku',
    'countdown.hours': 'Saa',
    'countdown.mins': 'Dakika',
    'countdown.secs': 'Sekunde',
    'countdown.reached': 'Siku ya Uchaguzi!',
    
    // Core KPIs
    'kpi.registeredVoters': 'Wapiga Kura Waliojiandikisha',
    'kpi.villageCoverage': 'Ufikiaji wa Vijiji',
    'kpi.warmLeaders': 'Viongozi wa Karibu',
    'kpi.criticalIssues': 'Shida Muhimu',
    'kpi.turnoutPace': 'Kasi ya Kupiga Kura',
    'kpi.incidents': 'Visa Amilifu',
    'kpi.supporters': 'Wafuasi Waliojitolea',
    'kpi.activeStaff': 'Wafanyakazi Amilifu',
    
    // Common Words
    'common.ward': 'Wadi',
    'common.village': 'Kijiji / Mtaa',
    'common.status': 'Hali',
    'common.severity': 'Uharaka',
    'common.category': 'Kundi',
    'common.date': 'Tarehe',
    'common.action': 'Kitendo',
    'common.details': 'Maelezo',
    'common.none': 'Hakuna',
    'common.save': 'Hifadhi',
    'common.cancel': 'Ghairi',
    'common.submit': 'Wasilisha',
    'common.delete': 'Futa',
    'common.search': 'Tafuta',
    'common.all': 'Zote',
    'common.active': 'Amilifu',
    'common.inactive': 'Isiyoamilifu',
    
    // Issues controlled vocabulary
    'issue.water': 'Ugavi wa Maji',
    'issue.sanitation': 'Usafi wa Mazingira',
    'issue.garbage': 'Uzoaji Taka',
    'issue.drainage': 'Mifereji / Mafuriko',
    'issue.roads': 'Mtandao wa Barabara',
    'issue.street_lighting': 'Taa za Barabarani',
    'issue.electricity': 'Stima ya Umeme',
    'issue.security': 'Usalama',
    'issue.drugs_substance_abuse': 'Matumizi ya Dawa za Kulevya',
    'issue.gbv': 'Ukatili wa Kijinsia',
    'issue.youth_unemployment': 'Ukosefu wa Kazi wa Vijana',
    'issue.education': 'Elimu / Hazina ya Bursary',
    'issue.healthcare': 'Huduma za Afya',
    'issue.land_disputes': 'Mizozo ya Ardhi',
    'issue.housing': 'Nyumba za Bei Nafuu',
    'issue.business_permits': 'Leseni / Ushuru wa Biashara',
    'issue.corruption': 'Ufisadi wa Kaunti',
    'issue.service_delivery': 'Utoaji Huduma za Umma',
    'issue.other': 'Malalamiko Mengine ya Mtaa',
    
    // Leader roles
    'role.imam': 'Imamu',
    'role.pastor': 'Mchungaji / Mhubiri',
    'role.boda_chairman': 'Mwenyekiti wa Boda Boda',
    'role.mama_kiongozi': 'Mama Kiongozi',
    'role.elder': 'Mzee wa Boma',
    'role.chief': 'Chifu / Naibu Chifu',
    
    // Dashboard & Map
    'dashboard.mapTitle': 'Kudhibiti Ramani ya Nyali',
    'dashboard.heatmapA': 'Heatmap A: Ufikiaji wa Hivi Karibuni',
    'dashboard.heatmapB': 'Heatmap B: Uzito wa Ushawishi',
    'dashboard.heatmapC': 'Heatmap C: Nafasi ya Ushawishi (Kura)',
    'dashboard.hexOverlay': 'Washa Mistari ya Hex',
    'dashboard.quickActions': 'Vitendo Vya Haraka vya Kampeni',
    'dashboard.logVisit': 'Rekodi Ziara ya Nyanjani',
    'dashboard.logIssue': 'Rekodi Shida ya Kijiji',
    'dashboard.scheduleMeeting': 'Ratibu Mkutano wa Viongozi',
    
    // Access Control warnings
    'rbac.restricted': 'Ufikiaji Umezuiwa na Sera ya Database RLS (Imeigwa)',
    'rbac.voterMasked': 'Majina ya wapigakura yamefichwa kufuata Sheria ya DPA.',
    'rbac.notesGated': 'Maelezo nyeti ya kimkakati yanaonekana tu kwa Mgombea, CM, na Sarah Strategist.'
  }
};

export type CampaignRole = 'candidate' | 'manager' | 'strategist' | 'coordinator' | 'canvasser' | 'agent';

interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
}

interface CampaignContextType {
  // Config
  language: 'en' | 'sw';
  setLanguage: (lang: 'en' | 'sw') => void;
  activeRole: CampaignRole;
  setActiveRole: (role: CampaignRole) => void;
  activeSystem: 'command' | 'data_entry';
  setActiveSystem: (system: 'command' | 'data_entry') => void;
  t: (key: string) => string;
  
  // Data lists (gated by RLS filters dynamically)
  wards: WardInfo[];
  pollingStations: PollingStation[];
  leaders: CommunityLeader[];
  sites: CommunitySite[];
  programs: CampaignProgram[];
  supporters: CommittedSupporter[];
  issues: CampaignIssue[];
  teamMembers: TeamMember[];
  activities: CampaignActivity[];
  incidents: IncidentReport[];
  auditLogs: AuditLog[];
  notifications: InAppNotification[];
  dismissNotification: (id: string) => void;

  // Actions / Mutations
  addIssue: (issue: Omit<CampaignIssue, 'id' | 'lastVerifiedAt' | 'verified'>) => void;
  addLeader: (leader: Omit<CommunityLeader, 'id' | 'isQueuedForReview'>) => void;
  approveLeader: (id: string) => void;
  addSiteCheckIn: (siteId: string, notes: string) => void;
  addCommittedSupporter: (supporter: Omit<CommittedSupporter, 'id' | 'consentCapturedAt' | 'lastVerifiedDate' | 'withdrawn'>) => { success: boolean; error?: string };
  withdrawSupporterConsent: (id: string, hardDelete: boolean) => void;
  submitPollingStationReport: (stationId: string, turnoutCount: number) => void;
  submitIncident: (incident: Omit<IncidentReport, 'id' | 'timestamp' | 'status'>) => void;
  addCampaignActivity: (activity: Omit<CampaignActivity, 'id' | 'status'>) => void;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export const CampaignProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<'en' | 'sw'>('en');
  const [activeRole, setActiveRole] = useState<CampaignRole>('manager'); // Defaults to Campaign Manager for complete dashboard testing
  const [activeSystem, setActiveSystemState] = useState<'command' | 'data_entry'>('command');

  const setActiveSystem = (system: 'command' | 'data_entry') => {
    setActiveSystemState(system);
    // Automate default roles simulator mapping
    if (system === 'command') {
      setActiveRole('manager');
    } else {
      setActiveRole('canvasser');
    }
  };
  
  // Database States
  const [leadersList, setLeadersList] = useState<CommunityLeader[]>(COMMUNITY_LEADERS);
  const [sitesList, setSitesList] = useState<CommunitySite[]>(COMMUNITY_SITES);
  const [supportersList, setSupportersList] = useState<CommittedSupporter[]>(COMMITTED_SUPPORTERS);
  const [issuesList, setIssuesList] = useState<CampaignIssue[]>(CAMPAIGN_ISSUES);
  const [activitiesList, setActivitiesList] = useState<CampaignActivity[]>(CAMPAIGN_ACTIVITIES);
  const [stationsList, setStationsList] = useState<PollingStation[]>(POLLING_STATIONS);
  const [incidentsList, setIncidentsList] = useState<IncidentReport[]>(SEEDED_INCIDENTS);
  const [auditList, setAuditList] = useState<AuditLog[]>(SEEDED_AUDIT_LOGS);
  
  // App Notifications
  const [notifications, setNotifications] = useState<InAppNotification[]>([
    { id: 'notif-1', title: 'Critical Incident', message: 'Intimidation reported at Frere Town Community Hall!', type: 'critical', timestamp: new Date().toLocaleTimeString() }
  ]);

  // Current Logged-In User Mock
  const getCurrentUser = () => {
    switch (activeRole) {
      case 'candidate': return TEAM_MEMBERS[0];
      case 'manager': return TEAM_MEMBERS[1];
      case 'strategist': return TEAM_MEMBERS[2];
      case 'coordinator': return TEAM_MEMBERS[4]; // Gladys (Kongowea coordinator)
      case 'canvasser': return { id: 'team-99', name: 'Canvasser Joe', role: 'Canvasser', wardId: 'kongowea' };
      case 'agent': return { id: 'team-100', name: 'Agent John', role: 'Polling Agent', wardId: 'frere_town' };
    }
  };

  const currentUser = getCurrentUser();

  // Helper translation function
  const t = (key: string): string => {
    return TRANSLATIONS[language][key] || key;
  };

  // Helper to add audit logs (append-only)
  const addAudit = (action: string, entityType: string, entityId?: string, before?: string, after?: string) => {
    const user = currentUser;
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actorId: user.id,
      actorName: user.name,
      role: user.role,
      action,
      entityType,
      entityId,
      beforeValue: before,
      afterValue: after,
      ipAddress: '197.248.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255)
    };
    setAuditList(prev => [newLog, ...prev]);
  };

  // Dynamic Row-Level Security (RLS) Filter Simulation
  // Applies filters to state lists based on the active role's permissions
  const filterByRLS = <T extends { wardId?: string; wardScope?: string[] }>(list: T[]): T[] => {
    // Ward Coordinators, Canvassers, and Agents can only read data associated with their assigned ward
    if (activeRole === 'coordinator' || activeRole === 'canvasser' || activeRole === 'agent') {
      const userWard = (currentUser as any).wardId;
      if (userWard) {
        return list.filter(item => {
          if (item.wardId) return item.wardId === userWard;
          if (item.wardScope) return item.wardScope.includes(userWard);
          return true;
        });
      }
    }
    return list;
  };

  const getFilteredLeaders = () => filterByRLS(leadersList);
  const getFilteredSites = () => filterByRLS(sitesList);
  const getFilteredIssues = () => filterByRLS(issuesList);
  const getFilteredActivities = () => filterByRLS(activitiesList);
  
  // Gated Polling Stations: Agents only see their station, Coordinators see their ward, Leadership sees all
  const getFilteredStations = () => {
    if (activeRole === 'agent') {
      // agent is in Frere Town (ps-fre-2)
      return stationsList.filter(s => s.id === 'ps-fre-2');
    }
    if (activeRole === 'coordinator' || activeRole === 'canvasser') {
      const userWard = (currentUser as any).wardId;
      return stationsList.filter(s => s.wardId === userWard);
    }
    return stationsList;
  };

  // Committed Supporters masking:
  // - Gated to Ward Coordinator and above for their ward
  // - Canvassers see only their own registered supporters
  // - Polling Agents cannot access supporters list (returns empty)
  const getFilteredSupporters = () => {
    if (activeRole === 'agent') {
      return []; // RLS returns empty
    }
    let list = supportersList.filter(s => !s.withdrawn);
    if (activeRole === 'canvasser') {
      return list.filter(s => s.registeringPersonId === currentUser.id);
    }
    if (activeRole === 'coordinator') {
      const userWard = (currentUser as any).wardId;
      // Get polling stations in coordinator's ward
      const wardStationIds = stationsList.filter(s => s.wardId === userWard).map(s => s.id);
      list = list.filter(s => wardStationIds.includes(s.pollingStationId));
    }
    return list;
  };

  // Mutations / Actions
  const addIssue = (newIssueData: Omit<CampaignIssue, 'id' | 'lastVerifiedAt' | 'verified'>) => {
    const newIssue: CampaignIssue = {
      ...newIssueData,
      id: `iss-${Date.now()}`,
      verified: true,
      lastVerifiedAt: new Date().toISOString().substring(0, 10)
    };
    
    setIssuesList(prev => [newIssue, ...prev]);
    addAudit('CREATE_ISSUE', 'issue', newIssue.id, undefined, JSON.stringify(newIssue));

    if (newIssue.severity === 'critical') {
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Critical Issue Logged!',
          message: `${newIssue.title} (Severity: Critical) in ${newIssue.villageName} village.`,
          type: 'critical',
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev
      ]);
    }
  };

  const addLeader = (newLeaderData: Omit<CommunityLeader, 'id' | 'isQueuedForReview'>) => {
    // Canvassers submit to review queue, coordinators+ enter directly
    const isQueued = activeRole === 'canvasser';
    const newLeader: CommunityLeader = {
      ...newLeaderData,
      id: `ldr-${Date.now()}`,
      isQueuedForReview: isQueued
    };

    setLeadersList(prev => [newLeader, ...prev]);
    addAudit(isQueued ? 'SUBMIT_LEADER_QUEUE' : 'CREATE_LEADER', 'leader', newLeader.id, undefined, JSON.stringify(newLeader));
  };

  const approveLeader = (id: string) => {
    setLeadersList(prev => prev.map(ldr => ldr.id === id ? { ...ldr, isQueuedForReview: false } : ldr));
    addAudit('APPROVE_LEADER', 'leader', id, 'status: queued', 'status: active');
  };

  const addSiteCheckIn = (siteId: string, notes: string) => {
    setSitesList(prev => prev.map(site => {
      if (site.id === siteId) {
        const count = site.visitHistoryCount + 1;
        const lastVisited = new Date().toISOString().substring(0, 10);
        return { ...site, lastVisitedAt: lastVisited, visitHistoryCount: count, politicalClimate: notes };
      }
      return site;
    }));
    addAudit('LOG_VISIT', 'site', siteId, undefined, notes);
  };

  const addCommittedSupporter = (supporterData: Omit<CommittedSupporter, 'id' | 'consentCapturedAt' | 'lastVerifiedDate' | 'withdrawn'>) => {
    // Enforce consent metadata capture (BR-130.1)
    if (!supporterData.consentMethod) {
      return { success: false, error: 'Consent capture metadata is required (SUPPORTER_CONSENT_REQUIRED).' };
    }

    const newSupporter: CommittedSupporter = {
      ...supporterData,
      id: `sup-${Date.now()}`,
      consentCapturedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      lastVerifiedDate: new Date().toISOString().substring(0, 10),
      withdrawn: false
    };

    setSupportersList(prev => [newSupporter, ...prev]);
    addAudit('REGISTER_SUPPORTER', 'supporter', newSupporter.id, undefined, JSON.stringify(newSupporter));
    return { success: true };
  };

  const withdrawSupporterConsent = (id: string, hardDelete: boolean) => {
    const original = supportersList.find(s => s.id === id);
    if (!original) return;

    if (hardDelete) {
      // Hard delete: Null PII fields, retain record only as a count for metrics (DPA §26)
      setSupportersList(prev => prev.map(s => s.id === id ? {
        ...s,
        fullName: 'ANONYMOUS_VOTER',
        nationalIdMasked: '********',
        notes: undefined,
        withdrawn: true,
        withdrawnAt: new Date().toISOString()
      } : s));
      addAudit('HARD_ERASE_SUPPORTER', 'supporter', id, JSON.stringify(original), 'Anonymized');
    } else {
      // Soft delete: flag withdrawn
      setSupportersList(prev => prev.map(s => s.id === id ? {
        ...s,
        withdrawn: true,
        withdrawnAt: new Date().toISOString()
      } : s));
      addAudit('WITHDRAW_CONSENT', 'supporter', id, 'active', 'withdrawn');
    }
  };

  const submitPollingStationReport = (stationId: string, turnoutCount: number) => {
    let target = 0;
    let oldTurnout = 0;
    
    setStationsList(prev => prev.map(s => {
      if (s.id === stationId) {
        target = s.targetTurnout;
        oldTurnout = s.currentTurnoutCount || 0;
        const lastReport = new Date().toLocaleTimeString().substring(0, 5);
        return {
          ...s,
          currentTurnoutCount: turnoutCount,
          lastReportTime: lastReport
        };
      }
      return s;
    }));

    addAudit('SUBMIT_TURNOUT_REPORT', 'station', stationId, `voted: ${oldTurnout}`, `voted: ${turnoutCount}`);

    // If turnout pace falls > 20% below target
    const currentPercent = (turnoutCount / target) * 100;
    if (currentPercent < 40) { // arbitrary threshold for simulation trigger
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Low Turnout Alert',
          message: `Station ${stationsList.find(s => s.id === stationId)?.name} pace is 25% below target!`,
          type: 'warning',
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev
      ]);
    }
  };

  const submitIncident = (incidentData: Omit<IncidentReport, 'id' | 'timestamp' | 'status'>) => {
    const newIncident: IncidentReport = {
      ...incidentData,
      id: `inc-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'reported'
    };

    setIncidentsList(prev => [newIncident, ...prev]);
    
    // Update stations list count
    setStationsList(prev => prev.map(s => s.id === incidentData.stationId ? { ...s, incidentsCount: s.incidentsCount + 1 } : s));

    addAudit('REPORT_INCIDENT', 'incident', newIncident.id, undefined, JSON.stringify(newIncident));

    // Send high-priority alert if critical severity
    if (newIncident.severity === 'critical') {
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'CRITICAL ELECTION DAY INCIDENT',
          message: `${newIncident.category.replace('_', ' ').toUpperCase()} reported at ${newIncident.stationName}!`,
          type: 'critical',
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev
      ]);
    }
  };

  const addCampaignActivity = (activityData: Omit<CampaignActivity, 'id' | 'status'>) => {
    const newActivity: CampaignActivity = {
      ...activityData,
      id: `act-${Date.now()}`,
      status: 'planned'
    };
    setActivitiesList(prev => [newActivity, ...prev]);
    addAudit('CREATE_ACTIVITY', 'activity', newActivity.id, undefined, JSON.stringify(newActivity));
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Perform audit logs access control logs on initial role mount
  useEffect(() => {
    addAudit('SWITCH_ROLE', 'auth', currentUser.id, undefined, `Role: ${activeRole}`);
  }, [activeRole]);

  return (
    <CampaignContext.Provider value={{
      language,
      setLanguage,
      activeRole,
      setActiveRole,
      activeSystem,
      setActiveSystem,
      t,
      wards: WARDS,
      pollingStations: getFilteredStations(),
      leaders: getFilteredLeaders(),
      sites: getFilteredSites(),
      programs: filterByRLS(CAMPAIGN_PROGRAMS),
      supporters: getFilteredSupporters(),
      issues: getFilteredIssues(),
      teamMembers: TEAM_MEMBERS,
      activities: getFilteredActivities(),
      incidents: incidentsList,
      auditLogs: auditList,
      notifications,
      dismissNotification,
      addIssue,
      addLeader,
      approveLeader,
      addSiteCheckIn,
      addCommittedSupporter,
      withdrawSupporterConsent,
      submitPollingStationReport,
      submitIncident,
      addCampaignActivity
    }}>
      {children}
    </CampaignContext.Provider>
  );
};

export const useCampaign = () => {
  const context = useContext(CampaignContext);
  if (!context) throw new Error('useCampaign must be used within CampaignProvider');
  return context;
};
