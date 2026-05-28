import { eq, sql } from 'drizzle-orm';
import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import {
  constituencies,
  wards,
  subLocations,
  villages,
  pollingStations,
  people,
  communityLeaders,
  communitySites,
  villageIssues,
  activities,
  visits,
  meetings,
  communityPrograms,
  committedSupporters,
  consentLog,
  stationReports,
  incidents,
} from '../schema/index';

// Seed the local dev database with a coherent slice of Nyali Constituency data.
//
// Runs as the DB owner (superuser) → bypasses RLS, can insert into every table.
// Skips entirely if Nyali constituency already exists (idempotent re-run).
//
// Data scale (intentionally small but coherent):
//   - 1 constituency (Nyali)
//   - 5 wards with approximate centroids
//   - 5 sub-locations
//   - 5 villages
//   - 10 polling stations (2 per ward)
//   - 15 people covering most CampaignRole values
//   - 5 community sites + 5 community leaders + 3 village issues
//   - 3 activities + 5 visits + 1 meeting
//   - 1 community program + 3 committed supporters + corresponding consent_log
//   - 2 station reports + 1 critical incident
//
// All IDs are stable UUIDs hardcoded below so FK references between rows work
// without coordinating inserts. Future seed runs against the same DB are no-ops.

config({ path: '.env.local' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);

// ---------------------------------------------------------------------------
// Stable UUIDs (UUIDv4 generated once, hardcoded so re-runs reference the same rows).
// ---------------------------------------------------------------------------

const ID = {
  nyali: '11111111-0000-4000-8000-000000000001',
  ward: {
    kadzandani:     '22222222-0000-4000-8000-000000000001',
    kongowea:       '22222222-0000-4000-8000-000000000002',
    mkomani:        '22222222-0000-4000-8000-000000000003',
    frereTown:      '22222222-0000-4000-8000-000000000004',
    ziwaLaNgombe:   '22222222-0000-4000-8000-000000000005',
  },
  subLocation: {
    kadzandani:     '33333333-0000-4000-8000-000000000001',
    kongoweaA:      '33333333-0000-4000-8000-000000000002',
    nyali:          '33333333-0000-4000-8000-000000000003',
    frereTown:      '33333333-0000-4000-8000-000000000004',
    shanzu:         '33333333-0000-4000-8000-000000000005',
  },
  village: {
    kadzandani:     '44444444-0000-4000-8000-000000000001',
    kongoweaA:      '44444444-0000-4000-8000-000000000002',
    nyali:          '44444444-0000-4000-8000-000000000003',
    frereTown:      '44444444-0000-4000-8000-000000000004',
    shanzu:         '44444444-0000-4000-8000-000000000005',
  },
  station: {
    kad1: '55555555-0000-4000-8000-000000000001',
    kad2: '55555555-0000-4000-8000-000000000002',
    kon1: '55555555-0000-4000-8000-000000000003',
    kon2: '55555555-0000-4000-8000-000000000004',
    mko1: '55555555-0000-4000-8000-000000000005',
    mko2: '55555555-0000-4000-8000-000000000006',
    fre1: '55555555-0000-4000-8000-000000000007',
    fre2: '55555555-0000-4000-8000-000000000008',
    ziw1: '55555555-0000-4000-8000-000000000009',
    ziw2: '55555555-0000-4000-8000-00000000000a',
  },
  person: {
    candidate:      '66666666-0000-4000-8000-000000000001',  // Alfayo Nelson
    manager:        '66666666-0000-4000-8000-000000000002',
    strategist:     '66666666-0000-4000-8000-000000000003',
    constCoord:     '66666666-0000-4000-8000-000000000004',
    coordKad:       '66666666-0000-4000-8000-000000000005',
    coordKon:       '66666666-0000-4000-8000-000000000006',
    coordMko:       '66666666-0000-4000-8000-000000000007',
    coordFre:       '66666666-0000-4000-8000-000000000008',
    coordZiw:       '66666666-0000-4000-8000-000000000009',
    canvasserKon:   '66666666-0000-4000-8000-00000000000a',
    agentFre:       '66666666-0000-4000-8000-00000000000b',
    influenceKad:   '66666666-0000-4000-8000-00000000000c',
    techLead:       '66666666-0000-4000-8000-00000000000d',
    patron:         '66666666-0000-4000-8000-00000000000e',
    finance:        '66666666-0000-4000-8000-00000000000f',
  },
  leader: {
    sheikh:         '77777777-0000-4000-8000-000000000001',
    pastor:         '77777777-0000-4000-8000-000000000002',
    mamaKiongozi:   '77777777-0000-4000-8000-000000000003',
    bodaChairman:   '77777777-0000-4000-8000-000000000004',
    elder:          '77777777-0000-4000-8000-000000000005',
  },
  site: {
    kongoweaMosque: '88888888-0000-4000-8000-000000000001',
    nyaliBaptist:   '88888888-0000-4000-8000-000000000002',
    mawenaWomen:    '88888888-0000-4000-8000-000000000003',
    kadzandaniBoda: '88888888-0000-4000-8000-000000000004',
    frereTownHall:  '88888888-0000-4000-8000-000000000005',
  },
  issue: {
    waterKad:       '99999999-0000-4000-8000-000000000001',
    drainageMko:    '99999999-0000-4000-8000-000000000002',
    securityFre:    '99999999-0000-4000-8000-000000000003',
  },
  activity: {
    konBaraza:      'aaaaaaaa-0000-4000-8000-000000000001',
    kadDoorToDoor:  'aaaaaaaa-0000-4000-8000-000000000002',
    frereRally:     'aaaaaaaa-0000-4000-8000-000000000003',
  },
  meeting: {
    strategy1:      'bbbbbbbb-0000-4000-8000-000000000001',
  },
  program: {
    bursary:        'cccccccc-0000-4000-8000-000000000001',
  },
  supporter: {
    s1: 'dddddddd-0000-4000-8000-000000000001',
    s2: 'dddddddd-0000-4000-8000-000000000002',
    s3: 'dddddddd-0000-4000-8000-000000000003',
  },
  incident: {
    frereIntimidation: 'eeeeeeee-0000-4000-8000-000000000001',
  },
} as const;

// PostGIS WKT POINT helper. Lat/lon for Nyali Constituency (Mombasa, Kenya).
// WKT format is POINT(longitude latitude) — note order.
const point = (lng: number, lat: number) => sql`ST_GeomFromText('POINT(${sql.raw(String(lng))} ${sql.raw(String(lat))})', 4326)`;

async function main() {
  // Idempotency gate.
  const existing = await db
    .select({ id: constituencies.id })
    .from(constituencies)
    .where(eq(constituencies.iebcCode, '028'));
  if (existing.length > 0) {
    console.log('Nyali constituency already seeded — exiting without changes.');
    return;
  }

  console.log('Seeding Nyali Constituency dev data...');

  // ---- Geography ----------------------------------------------------------
  await db.insert(constituencies).values({
    id: ID.nyali,
    iebcCode: '028',
    name: 'Nyali',
    countyName: 'Mombasa',
    registeredVoters: 130320,
    centroid: sql`ST_GeomFromText('POINT(39.71 -4.00)', 4326)` as any,
  });
  console.log('  ✓ 1 constituency');

  await db.insert(wards).values([
    { id: ID.ward.kadzandani,   constituencyId: ID.nyali, iebcCode: '0141', name: 'Kadzandani',     registeredVoters: 28450, populationEstimate: 45000, centroid: point(39.685, -4.005) as any },
    { id: ID.ward.kongowea,     constituencyId: ID.nyali, iebcCode: '0142', name: 'Kongowea',       registeredVoters: 34120, populationEstimate: 52000, centroid: point(39.700, -4.020) as any },
    { id: ID.ward.mkomani,      constituencyId: ID.nyali, iebcCode: '0143', name: 'Mkomani',        registeredVoters: 22800, populationEstimate: 38000, centroid: point(39.715, -4.045) as any },
    { id: ID.ward.frereTown,    constituencyId: ID.nyali, iebcCode: '0144', name: 'Frere Town',     registeredVoters: 20150, populationEstimate: 31000, centroid: point(39.720, -3.985) as any },
    { id: ID.ward.ziwaLaNgombe, constituencyId: ID.nyali, iebcCode: '0145', name: 'Ziwa La Ng\'ombe', registeredVoters: 24800, populationEstimate: 39000, centroid: point(39.730, -3.970) as any },
  ]);
  console.log('  ✓ 5 wards');

  await db.insert(subLocations).values([
    { id: ID.subLocation.kadzandani, wardId: ID.ward.kadzandani,   name: 'Kadzandani',   centroid: point(39.685, -4.005) as any },
    { id: ID.subLocation.kongoweaA,  wardId: ID.ward.kongowea,     name: 'Kongowea A',   centroid: point(39.700, -4.020) as any },
    { id: ID.subLocation.nyali,      wardId: ID.ward.mkomani,      name: 'Nyali',        centroid: point(39.715, -4.045) as any },
    { id: ID.subLocation.frereTown,  wardId: ID.ward.frereTown,    name: 'Frere Town',   centroid: point(39.720, -3.985) as any },
    { id: ID.subLocation.shanzu,     wardId: ID.ward.ziwaLaNgombe, name: 'Shanzu',       centroid: point(39.730, -3.970) as any },
  ]);
  console.log('  ✓ 5 sub-locations');

  await db.insert(villages).values([
    { id: ID.village.kadzandani, wardId: ID.ward.kadzandani,   subLocationId: ID.subLocation.kadzandani, name: 'Kadzandani',  populationEstimate: 8000,  centroid: point(39.685, -4.005) as any },
    { id: ID.village.kongoweaA,  wardId: ID.ward.kongowea,     subLocationId: ID.subLocation.kongoweaA,  name: 'Kongowea A',  populationEstimate: 12000, centroid: point(39.700, -4.020) as any },
    { id: ID.village.nyali,      wardId: ID.ward.mkomani,      subLocationId: ID.subLocation.nyali,      name: 'Nyali',       populationEstimate: 9000,  centroid: point(39.715, -4.045) as any },
    { id: ID.village.frereTown,  wardId: ID.ward.frereTown,    subLocationId: ID.subLocation.frereTown,  name: 'Frere Town',  populationEstimate: 7500,  centroid: point(39.720, -3.985) as any },
    { id: ID.village.shanzu,     wardId: ID.ward.ziwaLaNgombe, subLocationId: ID.subLocation.shanzu,     name: 'Shanzu',      populationEstimate: 9500,  centroid: point(39.730, -3.970) as any },
  ]);
  console.log('  ✓ 5 villages');

  await db.insert(pollingStations).values([
    { id: ID.station.kad1, wardId: ID.ward.kadzandani,   iebcCode: '028-001', name: 'Kadzandani Primary School',  registeredVoters: 2500, turnout2013: 72, turnout2017: 75, turnout2022: 68, margin2022: 120,  targetTurnout: 80, location: point(39.685, -4.005) as any },
    { id: ID.station.kad2, wardId: ID.ward.kadzandani,   iebcCode: '028-002', name: 'Mwakirunge Secondary',       registeredVoters: 1800, turnout2013: 68, turnout2017: 71, turnout2022: 64, margin2022: -45,  targetTurnout: 75, location: point(39.690, -4.010) as any },
    { id: ID.station.kon1, wardId: ID.ward.kongowea,     iebcCode: '028-011', name: 'Kongowea Primary',           registeredVoters: 3500, turnout2013: 78, turnout2017: 80, turnout2022: 74, margin2022: 450,  targetTurnout: 85, location: point(39.700, -4.020) as any },
    { id: ID.station.kon2, wardId: ID.ward.kongowea,     iebcCode: '028-012', name: 'Maweni Secondary',           registeredVoters: 2800, turnout2013: 75, turnout2017: 78, turnout2022: 71, margin2022: 320,  targetTurnout: 82, location: point(39.705, -4.025) as any },
    { id: ID.station.mko1, wardId: ID.ward.mkomani,      iebcCode: '028-021', name: 'Mkomani Primary',            registeredVoters: 2400, turnout2013: 71, turnout2017: 73, turnout2022: 67, margin2022: 80,   targetTurnout: 78, location: point(39.715, -4.045) as any },
    { id: ID.station.mko2, wardId: ID.ward.mkomani,      iebcCode: '028-022', name: 'Nyali Baptist Church Hall',  registeredVoters: 3100, turnout2013: 64, turnout2017: 67, turnout2022: 61, margin2022: -140, targetTurnout: 70, location: point(39.717, -4.043) as any },
    { id: ID.station.fre1, wardId: ID.ward.frereTown,    iebcCode: '028-031', name: 'Frere Town Primary',         registeredVoters: 2700, turnout2013: 74, turnout2017: 77, turnout2022: 71, margin2022: 240,  targetTurnout: 80, location: point(39.720, -3.985) as any },
    { id: ID.station.fre2, wardId: ID.ward.frereTown,    iebcCode: '028-032', name: 'Frere Town Community Hall',  registeredVoters: 2100, turnout2013: 72, turnout2017: 74, turnout2022: 68, margin2022: 110,  targetTurnout: 78, location: point(39.722, -3.987) as any },
    { id: ID.station.ziw1, wardId: ID.ward.ziwaLaNgombe, iebcCode: '028-041', name: 'Ziwa La Ng\'ombe Primary',    registeredVoters: 3200, turnout2013: 70, turnout2017: 73, turnout2022: 66, margin2022: 140,  targetTurnout: 78, location: point(39.730, -3.970) as any },
    { id: ID.station.ziw2, wardId: ID.ward.ziwaLaNgombe, iebcCode: '028-042', name: 'Shanzu TTC',                 registeredVoters: 3900, turnout2013: 63, turnout2017: 65, turnout2022: 59, margin2022: -420, targetTurnout: 70, location: point(39.733, -3.973) as any },
  ]);
  console.log('  ✓ 10 polling stations');

  // ---- Identity -----------------------------------------------------------
  // Insert without auth_credentials — those are added when a user actually
  // sets a password / enrols TOTP. For now, just the directory.
  await db.insert(people).values([
    { id: ID.person.candidate,    phone: '+254700000001', email: 'alfayo@example.test',   fullName: 'Alfayo Nelson',        role: 'candidate' },
    { id: ID.person.manager,      phone: '+254700000002', email: 'manager@example.test',  fullName: 'Sarah Manager',        role: 'campaign_manager' },
    { id: ID.person.strategist,   phone: '+254700000003', email: 'strategy@example.test', fullName: 'Joseph Strategist',    role: 'chief_strategist' },
    { id: ID.person.constCoord,   phone: '+254700000004', email: 'coord@example.test',    fullName: 'Diana Coordinator',    role: 'constituency_coordinator' },
    { id: ID.person.coordKad,     phone: '+254700000005', fullName: 'Peter Mwangi',         role: 'ward_coordinator', wardId: ID.ward.kadzandani },
    { id: ID.person.coordKon,     phone: '+254700000006', fullName: 'Grace Wanjiku',        role: 'ward_coordinator', wardId: ID.ward.kongowea },
    { id: ID.person.coordMko,     phone: '+254700000007', fullName: 'Salim Omar',           role: 'ward_coordinator', wardId: ID.ward.mkomani },
    { id: ID.person.coordFre,     phone: '+254700000008', fullName: 'Mercy Chebet',         role: 'ward_coordinator', wardId: ID.ward.frereTown },
    { id: ID.person.coordZiw,     phone: '+254700000009', fullName: 'Robert Ndwiga',        role: 'ward_coordinator', wardId: ID.ward.ziwaLaNgombe },
    { id: ID.person.canvasserKon, phone: '+254700000010', fullName: 'Canvasser Joe',        role: 'canvasser',         wardId: ID.ward.kongowea },
    { id: ID.person.agentFre,     phone: '+254700000011', fullName: 'Brian Juma',           role: 'polling_agent',     wardId: ID.ward.frereTown },
    { id: ID.person.influenceKad, phone: '+254700000012', fullName: 'Amani Faraj',          role: 'influence_liaison', wardId: ID.ward.kadzandani },
    { id: ID.person.techLead,     phone: '+254700000013', email: 'tech@example.test',     fullName: 'Tech Lead',            role: 'tech_lead' },
    { id: ID.person.patron,       phone: '+254700000014', fullName: 'Patron / CEO',         role: 'patron_ceo' },
    { id: ID.person.finance,      phone: '+254700000015', fullName: 'Finance Lead',         role: 'finance_lead' },
  ]);
  console.log('  ✓ 15 people');

  // ---- Community sites ----------------------------------------------------
  await db.insert(communitySites).values([
    { id: ID.site.kongoweaMosque, type: 'mosque',         name: 'Kongowea Mosque',           wardId: ID.ward.kongowea,     villageId: ID.village.kongoweaA, location: point(39.701, -4.021) as any, estimatedSize: 800, meetingSchedule: 'Friday afternoons' },
    { id: ID.site.nyaliBaptist,   type: 'church',         name: 'Nyali Baptist Church',      wardId: ID.ward.mkomani,      villageId: ID.village.nyali,     location: point(39.716, -4.044) as any, estimatedSize: 400, meetingSchedule: 'Sunday mornings' },
    { id: ID.site.mawenaWomen,    type: 'chama',          name: 'Maweni Women Chama',        wardId: ID.ward.kongowea,     villageId: ID.village.kongoweaA, location: point(39.703, -4.022) as any, estimatedSize: 200, meetingSchedule: 'Wednesdays' },
    { id: ID.site.kadzandaniBoda, type: 'boda_stage',     name: 'Kadzandani Boda Stage',     wardId: ID.ward.kadzandani,   villageId: ID.village.kadzandani, location: point(39.686, -4.006) as any, estimatedSize: 80 },
    { id: ID.site.frereTownHall,  type: 'community_hall', name: 'Frere Town Community Hall', wardId: ID.ward.frereTown,    villageId: ID.village.frereTown,  location: point(39.722, -3.987) as any, estimatedSize: 300 },
  ]);
  console.log('  ✓ 5 community sites');

  // ---- Community leaders --------------------------------------------------
  await db.insert(communityLeaders).values([
    { id: ID.leader.sheikh,       fullName: 'Sheikh Abdalla Majid',    phone: '+254711223344', roleTitle: 'Imam (Kongowea Mosque)',         wardId: ID.ward.kongowea,     villageId: ID.village.kongoweaA, affiliatedSiteId: ID.site.kongoweaMosque, influenceReach: 'large',  politicalLean: 'supportive',         relationshipTemperature: 'warm', ownedByPersonId: ID.person.strategist, sensitiveNotes: 'Highly influential in Kongowea A. Supports Alfayo because of the water project.' },
    { id: ID.leader.pastor,       fullName: 'Pastor Ezekiel Mulwa',    phone: '+254722334455', roleTitle: 'Pastor (Nyali Baptist)',          wardId: ID.ward.mkomani,      villageId: ID.village.nyali,     affiliatedSiteId: ID.site.nyaliBaptist,   influenceReach: 'medium', politicalLean: 'leaning_supportive', relationshipTemperature: 'warm', ownedByPersonId: ID.person.strategist, sensitiveNotes: 'Requested assistance with youth sports sponsorships.' },
    { id: ID.leader.mamaKiongozi, fullName: 'Mama Fatuma Jeneby',      phone: '+254733445566', roleTitle: 'Mama Kiongozi (Women group)',     wardId: ID.ward.kongowea,     villageId: ID.village.kongoweaA, affiliatedSiteId: ID.site.mawenaWomen,    influenceReach: 'large',  politicalLean: 'supportive',         relationshipTemperature: 'warm', ownedByPersonId: ID.person.coordKon,    sensitiveNotes: 'Chama chairlady. Can mobilize over 200 active women voters.' },
    { id: ID.leader.bodaChairman, fullName: 'Josephat Karisa',         phone: '+254744556677', roleTitle: 'Boda Boda Chairman',              wardId: ID.ward.kadzandani,   villageId: ID.village.kadzandani, affiliatedSiteId: ID.site.kadzandaniBoda, influenceReach: 'large',  politicalLean: 'neutral',            relationshipTemperature: 'cool', ownedByPersonId: ID.person.influenceKad, sensitiveNotes: 'Demanding support for boda shed construction. Flipped from opposition recently.' },
    { id: ID.leader.elder,        fullName: 'Mzee Benjamin Mwangi',    phone: '+254755667788', roleTitle: 'Elder',                            wardId: ID.ward.frereTown,    villageId: ID.village.frereTown, influenceReach: 'medium', politicalLean: 'leaning_opposition', relationshipTemperature: 'cold', ownedByPersonId: ID.person.coordFre,    sensitiveNotes: 'Close to opponent\'s family. Open to dialogue but skeptical.' },
  ]);
  console.log('  ✓ 5 community leaders');

  // ---- Village issues -----------------------------------------------------
  await db.insert(villageIssues).values([
    { id: ID.issue.waterKad,     villageId: ID.village.kadzandani, wardId: ID.ward.kadzandani, category: 'water',    title: 'Burst water main on Kadzandani road', severity: 'critical', status: 'reported',     verified: true,  lastVerifiedAt: '2026-05-20', reportedByPersonId: ID.person.coordKad, affectsEstimatedVoters: 800 },
    { id: ID.issue.drainageMko,  villageId: ID.village.nyali,      wardId: ID.ward.mkomani,    category: 'drainage', title: 'Recurring flooding on Nyali link road', severity: 'serious', status: 'investigating', verified: true,  lastVerifiedAt: '2026-05-15', reportedByPersonId: ID.person.coordMko, affectsEstimatedVoters: 500 },
    { id: ID.issue.securityFre,  villageId: ID.village.frereTown,  wardId: ID.ward.frereTown,  category: 'security', title: 'Increased street robberies in Frere Town', severity: 'serious', status: 'reported',     verified: false, lastVerifiedAt: '2026-05-25', reportedByPersonId: ID.person.coordFre, affectsEstimatedVoters: 1200 },
  ]);
  console.log('  ✓ 3 village issues');

  // ---- Activities, visits, meetings ---------------------------------------
  await db.insert(activities).values([
    { id: ID.activity.konBaraza,     title: 'Kongowea community baraza',   type: 'baraza',       scheduledAt: new Date('2026-06-10T16:00:00Z'), wardId: ID.ward.kongowea,  villageId: ID.village.kongoweaA, ownerPersonId: ID.person.coordKon,  status: 'planned', expectedAttendance: 200 },
    { id: ID.activity.kadDoorToDoor, title: 'Kadzandani door-to-door sweep', type: 'door_to_door', scheduledAt: new Date('2026-06-12T09:00:00Z'), wardId: ID.ward.kadzandani, ownerPersonId: ID.person.coordKad, status: 'confirmed', expectedAttendance: 50 },
    { id: ID.activity.frereRally,    title: 'Frere Town rally',             type: 'rally',        scheduledAt: new Date('2026-06-15T15:00:00Z'), wardId: ID.ward.frereTown,  ownerPersonId: ID.person.constCoord, status: 'planned', expectedAttendance: 1500, candidateAttended: false },
  ]);
  console.log('  ✓ 3 activities');

  // Visits — append-only; use stable IDs so re-runs don't dupe (we skip on idempotency gate anyway).
  await db.insert(visits).values([
    { id: '11111111-1111-4000-8000-000000000001', visitingPersonId: ID.person.coordKon,     location: point(39.701, -4.021) as any, villageId: ID.village.kongoweaA, purpose: 'leader_meeting',  engagementCount: 1,  notes: 'Met Sheikh Abdalla, confirmed mosque visit slot.' },
    { id: '11111111-1111-4000-8000-000000000002', visitingPersonId: ID.person.canvasserKon, location: point(39.702, -4.022) as any, villageId: ID.village.kongoweaA, purpose: 'door_to_door',    engagementCount: 12, notes: 'East side of Kongowea A. Mostly receptive.' },
    { id: '11111111-1111-4000-8000-000000000003', visitingPersonId: ID.person.coordKad,     location: point(39.686, -4.006) as any, villageId: ID.village.kadzandani, purpose: 'site_assessment', engagementCount: 1,  notes: 'Boda stage; spoke with chairman Karisa.' },
    { id: '11111111-1111-4000-8000-000000000004', visitingPersonId: ID.person.coordMko,     location: point(39.716, -4.044) as any, villageId: ID.village.nyali,      purpose: 'leader_meeting',  engagementCount: 1,  notes: 'Pastor Ezekiel — open to youth sports sponsorship.' },
    { id: '11111111-1111-4000-8000-000000000005', visitingPersonId: ID.person.coordFre,     location: point(39.722, -3.987) as any, villageId: ID.village.frereTown,  purpose: 'courtesy_call',   engagementCount: 1,  notes: 'Mzee Benjamin — long conversation. Still skeptical.' },
  ]);
  console.log('  ✓ 5 visits');

  await db.insert(meetings).values([
    { id: ID.meeting.strategy1, title: 'Weekly campaign sync', type: 'internal_strategy', scheduledAt: new Date('2026-06-08T09:00:00Z'), location: 'Campaign office', agenda: 'Coverage review; D-Day rehearsal planning', ownerPersonId: ID.person.manager, inviteePersonIds: [ID.person.candidate, ID.person.strategist, ID.person.constCoord] },
  ]);
  console.log('  ✓ 1 meeting');

  // ---- Supporters (RESTRICTED) -------------------------------------------
  await db.insert(communityPrograms).values({
    id: ID.program.bursary,
    name: 'Nyali Youth Bursary 2026',
    type: 'bursary',
    description: 'Secondary school fee support for 50 students across Nyali.',
    wardScope: [ID.ward.kadzandani, ID.ward.kongowea, ID.ward.mkomani, ID.ward.frereTown, ID.ward.ziwaLaNgombe],
    leadCoordinatorPersonId: ID.person.manager,
    estimatedBeneficiaryCount: 50,
    startedAt: '2026-01-15',
  });
  console.log('  ✓ 1 community program');

  await db.insert(committedSupporters).values([
    { id: ID.supporter.s1, fullName: 'Mary Wanjiku',  nationalIdMasked: '2345****', phone: '+254700111001', pollingStationId: ID.station.kon1, wardId: ID.ward.kongowea,   villageId: ID.village.kongoweaA, communityProgramId: ID.program.bursary, commitmentTier: 'strong_commit', registeringPersonId: ID.person.coordKon, consentCaptureMethod: 'verbal_witnessed', consentCapturedAt: new Date('2026-04-10T11:30:00Z'), lastVerifiedDate: '2026-05-25' },
    { id: ID.supporter.s2, fullName: 'David Kibet',   nationalIdMasked: '3456****', phone: '+254700111002', pollingStationId: ID.station.kad1, wardId: ID.ward.kadzandani, villageId: ID.village.kadzandani, communityProgramId: ID.program.bursary, commitmentTier: 'likely',        registeringPersonId: ID.person.coordKad, consentCaptureMethod: 'verbal_witnessed', consentCapturedAt: new Date('2026-04-15T14:00:00Z'), lastVerifiedDate: '2026-05-20' },
    { id: ID.supporter.s3, fullName: 'Sarah Achieng', nationalIdMasked: '4567****', phone: '+254700111003', pollingStationId: ID.station.fre1, wardId: ID.ward.frereTown,  villageId: ID.village.frereTown, communityProgramId: ID.program.bursary, commitmentTier: 'probable',      registeringPersonId: ID.person.canvasserKon, consentCaptureMethod: 'in_person_app', consentCapturedAt: new Date('2026-05-01T10:00:00Z'), lastVerifiedDate: '2026-05-22' },
  ]);
  console.log('  ✓ 3 committed supporters');

  await db.insert(consentLog).values([
    { id: 'fa000000-0000-4000-8000-000000000001', supporterId: ID.supporter.s1, eventType: 'capture', method: 'verbal_witnessed', actorPersonId: ID.person.coordKon },
    { id: 'fa000000-0000-4000-8000-000000000002', supporterId: ID.supporter.s2, eventType: 'capture', method: 'verbal_witnessed', actorPersonId: ID.person.coordKad },
    { id: 'fa000000-0000-4000-8000-000000000003', supporterId: ID.supporter.s3, eventType: 'capture', method: 'in_person_app',    actorPersonId: ID.person.canvasserKon },
  ]);
  console.log('  ✓ 3 consent log entries');

  // ---- Election-day data --------------------------------------------------
  await db.insert(stationReports).values([
    { id: 'fb000000-0000-4000-8000-000000000001', pollingStationId: ID.station.fre2, agentPersonId: ID.person.agentFre, reportType: 'check_in', source: 'app' },
    { id: 'fb000000-0000-4000-8000-000000000002', pollingStationId: ID.station.fre2, agentPersonId: ID.person.agentFre, reportType: 'hourly_turnout', turnoutCount: 320, source: 'app' },
  ]);
  console.log('  ✓ 2 station reports');

  await db.insert(incidents).values([
    {
      id: ID.incident.frereIntimidation,
      pollingStationId: ID.station.fre2,
      reportedByPersonId: ID.person.agentFre,
      category: 'voter_intimidation',
      severity: 'critical',
      description: 'Group of 5 men in matching shirts loitering near the queue, photographing voters and apparently pressuring them.',
      location: point(39.722, -3.987) as any,
      status: 'escalated',
      escalatedAt: new Date('2026-05-26T17:08:30Z'),
    },
  ]);
  console.log('  ✓ 1 critical incident');

  console.log('\nSeed complete. RLS verification examples in packages/db/README.md.');
}

main()
  .then(() => client.end())
  .catch((err) => {
    console.error('\nSeed failed:', err);
    client.end();
    process.exit(1);
  });
