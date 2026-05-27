// Swahili translations.
// Ported from prototypes/vite-react-sketch/src/context/CampaignContext.tsx TRANSLATIONS.sw.
// MUST stay in lockstep with en.ts — every key in en.ts MUST exist here (SRS NFR-031).
// Swahili-native speaker review required before each major release.

import type { TranslationKey } from './en';

export const sw: Record<TranslationKey, string> = {
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

  // Issue controlled vocabulary
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

  // Access Control notices
  'rbac.restricted': 'Ufikiaji Umezuiwa na Sera ya Database RLS',
  'rbac.voterMasked': 'Majina ya wapigakura yamefichwa kufuata Sheria ya DPA.',
  'rbac.notesGated': 'Maelezo nyeti ya kimkakati yanaonekana tu kwa Mgombea, CM, na Sarah Strategist.',
};
