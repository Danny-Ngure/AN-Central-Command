// @an/types — single source of truth for domain entity shapes.
//
// Phase 2 deliverable: this file gets replaced by types inferred from the Drizzle schema
// in @an/db (`InferSelectModel`, `InferInsertModel`). Until then, this is a placeholder.
//
// The 19 entities to be modelled here trace to the ARC §6 ERD:
//   People, Wards, SubLocations, Villages, PollingStations,
//   CommunityLeaders, CommunitySites, CampaignPrograms,
//   CampaignActivities, Visits, Meetings, VillageIssues,
//   CommittedSupporters (RESTRICTED), ConsentLog (RESTRICTED, append-only),
//   StationReports, Incidents, AuditLog (APPEND-ONLY, NFR-050),
//   Sessions, AuthCredentials.
//
// Reference shapes (interface-only) already authored in:
//   ../../prototypes/vite-react-sketch/src/data/mockData.ts
//
// Do not hand-author these in this package — they must be inferred from the Drizzle schema
// so that the TypeScript types and the database schema cannot drift.

export type CampaignRole =
  | 'candidate'
  | 'campaign_manager'
  | 'chief_strategist'
  | 'constituency_coordinator'
  | 'media_head'
  | 'comms_head'
  | 'patron_ceo'
  | 'ward_coordinator'
  | 'assistant_ward_coordinator'
  | 'polling_station_lead'
  | 'polling_agent'
  | 'canvasser'
  | 'influence_liaison'
  | 'tech_lead'
  | 'finance_lead';

// SRS §5.3 — every API response is wrapped in this envelope.
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
