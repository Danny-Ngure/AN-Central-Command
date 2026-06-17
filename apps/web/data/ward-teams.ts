// Per-ward field team rosters (grassroots members beyond the leadership cards).
//
// These members are "very special" — they each carry a Member ID and an Agent ID
// (auto-generated here in the ward's prefix style, e.g. KON001 / KON-A001, until
// the campaign assigns official ones). Where a member matches the IEBC voter
// register (by National ID), the team page attaches their polling station.
//
// `ward` must match the wards.name value in the DB (without the trailing " Ward").

export type WardTeamMember = {
  name: string;
  id?: string; // National ID
  phone?: string;
  village?: string;
};

export type WardTeam = {
  ward: string; // e.g. 'Kongowea' — matches wards.name
  prefix: string; // ID prefix for generated Member/Agent IDs
  members: WardTeamMember[];
};

export const WARD_TEAMS: WardTeam[] = [
  {
    ward: 'Kongowea',
    prefix: 'KON',
    members: [
      { name: 'Jilo Bakari', id: '23596353', phone: '0727515280', village: 'Karama' },
      { name: 'Tabitha Onyango', id: '28203661', phone: '0793662843', village: 'Matopeni / Masandukuni' },
      { name: 'Salma Khalef', id: '22072371', phone: '0708924624', village: 'Telaviv' },
      { name: 'Mercy Akinyi Okuoga', id: '34121683', phone: '0708192632', village: 'Kambi Kikuyu Mbuyuni' },
      { name: 'Billy Bengi', id: '28849976', phone: '0724621025', village: 'Aljebra' },
      { name: 'Sandra Mambire', id: '22689114', phone: '0719302435', village: 'Kitaruni' },
      { name: 'Bibi Omar', id: '29529866', phone: '0717430959', village: 'Tauba' },
      { name: 'Felix Nyangone', id: '36028977', phone: '0741436014', village: 'Jerusalem' },
      { name: 'Rehema Wanjala', id: '28621941', phone: '0728289371', village: 'Karama' },
      { name: 'Ali Shatur', id: '29686931', phone: '0705833724', village: 'Sokoni Kongowea' },
      { name: 'William Tabu', id: '8620739', phone: '0725542499', village: 'Harambee' },
    ],
  },
  {
    ward: 'Frere Town',
    prefix: 'FRT',
    members: [
      { name: 'James Modi', id: '30350171', phone: '0104909553', village: 'Frere Town' },
      // Same person as the Frere Town Assistant Rep "Wadede Hamisi" (a.k.a. Hamisi Said Wadede).
      { name: 'Wadede Hamisi', id: '27349987', phone: '0726790872', village: 'Katisha' },
      { name: 'Faith Mwaura', id: '22978033', phone: '0768762055', village: 'Barsheba' },
      { name: 'Khadija Abdalla', id: '11227554', phone: '0724172493', village: 'Barsheba' },
      { name: 'Metrine Wanyama', id: '35646775', phone: '0740555824', village: 'Barsheba Phase 5' },
      { name: 'Henry Juma', id: '28424037', phone: '0723356858', village: 'Frere Town' },
      { name: 'Edith Kiengah', id: '24487822', phone: '0710251823', village: 'Mgongeni' },
      { name: 'Lillian Okoth', id: '11810228', phone: '0721649018', village: 'Junda' },
      { name: 'Lilian Atieno', id: '30942240', phone: '0729717107', village: 'Mubugoni' },
      { name: 'Christopher Mwangi', id: '22490152', phone: '0115905850', village: 'Barsheba Phase 5' },
      { name: 'George Okelo', id: '23282104', phone: '0715865248', village: 'Sarajevo' },
      // Same person as the Frere Town Ward Representative "Nafisa Kalondu".
      { name: 'Nafisa Kalondu', id: '29257902', phone: '0754702216', village: 'Marhaba' },
    ],
  },
];

// Index by ward name for O(1) lookup in the team page.
export const WARD_TEAM_BY_NAME: Record<string, WardTeam> = Object.fromEntries(
  WARD_TEAMS.map((t) => [t.ward, t]),
);
