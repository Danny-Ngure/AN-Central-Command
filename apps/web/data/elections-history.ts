// Historical MP election results for Nyali Constituency, 2013 / 2017 / 2022.
// Source: IEBC official tallies; per-ward breakdowns from
//   docs/Nyali MP Results 2013-2022.pdf
//
// All figures are official except where the PDF source explicitly approximates
// ("~5,400" etc.) — flagged with `approximate: true` and rendered with the
// "~" prefix in the UI to keep our presentation honest.

export interface HistoricalCandidate {
  name: string;
  party: string;
  votes: number;
  isWinner?: boolean;
}

export interface HistoricalWardResult {
  // Vote totals per ward — approximate per the source PDF.
  Frere_Town:      { winner: number; runnerUp: number; others: number };
  Ziwa_La_Ngombe:  { winner: number; runnerUp: number; others: number };
  Mkomani:         { winner: number; runnerUp: number; others: number };
  Kongowea:        { winner: number; runnerUp: number; others: number };
  Kadzandani:      { winner: number; runnerUp: number; others: number };
}

export interface HistoricalElection {
  year: number;
  candidates: HistoricalCandidate[];
  perWard: HistoricalWardResult;
  perWardApproximate: true;  // PDF source uses "~" approximations
  summary: string[];
}

export const HISTORICAL_ELECTIONS: HistoricalElection[] = [
  {
    year: 2013,
    candidates: [
      { name: 'Hezron Awiti Bollo',      party: 'WDM-K',       votes: 19903, isWinner: true },
      { name: 'Suleiman Shahbal',        party: 'URP',         votes: 15804 },
      { name: 'Omar Mwinyi Shimbwa',     party: 'ODM',         votes: 10485 },
      { name: 'Mohammed Amir Khamis',    party: 'TNA',         votes:  7154 },
      { name: 'Saido Hamisi Mwaruwa',    party: 'Independent', votes:  2742 },
      { name: 'Mbarak Juma Mbarak',      party: 'KNC',         votes:  1126 },
      { name: 'Shariff Nassir Ali',      party: 'Independent', votes:   803 },
      { name: 'Hassan Mwangeka Charo',   party: 'Independent', votes:   393 },
    ],
    perWardApproximate: true,
    perWard: {
      Frere_Town:     { winner: 4200, runnerUp: 3100, others: 1500 },
      Ziwa_La_Ngombe: { winner: 3600, runnerUp: 2800, others: 1500 }, // PDF: "ODM split vote among others"
      Mkomani:        { winner: 4000, runnerUp: 2900, others: 1200 },
      Kongowea:       { winner: 5200, runnerUp: 3400, others: 1800 },
      Kadzandani:     { winner: 2900, runnerUp: 3600, others: 1000 }, // runnerUp (Shahbal) actually won this ward
    },
    summary: [
      'Closest race in Nyali history.',
      'Kadzandani leaned anti-incumbent (Shahbal/URP strong).',
      'Awiti won overall through Frere Town + Kongowea strength.',
    ],
  },
  {
    year: 2017,
    candidates: [
      { name: 'Mohamed Ali (Jicho Pevu)', party: 'Independent', votes: 26798, isWinner: true },
      { name: 'Said Abdalla Salim',       party: 'ODM',         votes: 13986 },
      { name: 'Ashraf Hassan Awadh',      party: 'Jubilee',     votes:  9735 },
      { name: 'John Charles Mcharo',      party: 'Wiper',       votes:  2938 },
      { name: "Daniel Ongong'a Abwao",    party: 'Independent', votes:  1143 },
    ],
    perWardApproximate: true,
    perWard: {
      Frere_Town:     { winner: 5400, runnerUp: 2900, others: 1000 },
      Ziwa_La_Ngombe: { winner: 4800, runnerUp: 2600, others:  900 },
      Mkomani:        { winner: 5100, runnerUp: 2700, others:  800 },
      Kongowea:       { winner: 7500, runnerUp: 3200, others: 1200 },
      Kadzandani:     { winner: 4000, runnerUp: 1900, others:  500 }, // PDF doesn't list others, estimated
    },
    summary: [
      'Mohamed Ali dominated all wards as an Independent.',
      'Kongowea gave him the largest margin.',
      'Jubilee took a strong third — Awadh ~9.7k across the constituency.',
    ],
  },
  {
    year: 2022,
    candidates: [
      { name: 'Mohamed Ali (Jicho Pevu)', party: 'UDA',     votes: 32933, isWinner: true },
      { name: 'Said Abdallah',            party: 'ODM',     votes: 18642 },
      { name: 'Eric Gitonga Stanley',     party: 'Independent', votes:  1135 },
      { name: 'Millicent Atieno Odhiambo', party: 'Wiper',  votes:   904 },
      { name: 'Yasir Noor Mohamed',       party: 'Jubilee', votes:   889 },
    ],
    perWardApproximate: true,
    perWard: {
      Frere_Town:     { winner: 6800, runnerUp: 4100, others: 300 },
      Ziwa_La_Ngombe: { winner: 5900, runnerUp: 3600, others: 250 },
      Mkomani:        { winner: 6400, runnerUp: 3700, others: 300 },
      Kongowea:       { winner: 9200, runnerUp: 4900, others: 400 },
      Kadzandani:     { winner: 4600, runnerUp: 2300, others: 200 },
    },
    summary: [
      'Strongest UDA ward: Kongowea.',
      'Most competitive: Frere Town & Mkomani.',
      'ODM strongest in Ziwa la Ng\'ombe relative share.',
    ],
  },
];

// ---- Strategic ward profile -------------------------------------------------
// Derived from the 2013-2022 dataset — captures how each ward behaves politically.

export interface WardProfile {
  name: string;
  behaviour: 'swing' | 'powerhouse' | 'odm_leaning' | 'mixed' | 'stable_middle';
  oneLiner: string;
  note: string;
}

export const WARD_PROFILES: WardProfile[] = [
  { name: 'Kongowea',        behaviour: 'powerhouse',    oneLiner: 'Vote powerhouse',         note: 'Largest swing ward — turnout here decides the constituency. Top vote-getter every cycle.' },
  { name: 'Frere Town',      behaviour: 'swing',         oneLiner: 'Swing ward',              note: 'Margins narrow. Where the campaign is won or lost.' },
  { name: 'Ziwa La Ng\'ombe', behaviour: 'odm_leaning',  oneLiner: 'ODM-friendly',            note: 'Highest ODM share relative to constituency average across all three cycles.' },
  { name: 'Kadzandani',      behaviour: 'mixed',         oneLiner: 'Most politically mixed',  note: 'Flipped between URP (2013) and UDA (2017+). Cross-pressure ward — economic + ethnic axes both active.' },
  { name: 'Mkomani',         behaviour: 'stable_middle', oneLiner: 'Stable middle ground',    note: 'Most predictable ward. Tracks the constituency winner without big swings.' },
];

// ---- Constituency-wide aggregate trends -------------------------------------

export interface CycleTrend {
  year: number;
  totalValidVotes: number;     // sum of candidates' votes
  winnerVotes: number;
  winnerShare: number;          // %
  runnerUpVotes: number;
  runnerUpShare: number;
  winningMargin: number;
}

export const CYCLE_TRENDS: CycleTrend[] = HISTORICAL_ELECTIONS.map((e) => {
  const total = e.candidates.reduce((s, c) => s + c.votes, 0);
  const sorted = [...e.candidates].sort((a, b) => b.votes - a.votes);
  return {
    year: e.year,
    totalValidVotes: total,
    winnerVotes: sorted[0]!.votes,
    winnerShare: (sorted[0]!.votes / total) * 100,
    runnerUpVotes: sorted[1]!.votes,
    runnerUpShare: (sorted[1]!.votes / total) * 100,
    winningMargin: sorted[0]!.votes - sorted[1]!.votes,
  };
});
