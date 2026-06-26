// Historical MP election results for Nyali Constituency, 2013 / 2017 / 2022.
//
// VERIFIED against IEBC declarations + reputable Kenyan news (sources cited per
// cycle below). Principles:
//   • Where an official per-candidate tally could not be sourced, `votes` is
//     `null` — we do NOT estimate or invent numbers.
//   • A cycle is `complete` only when the FULL official slate is loaded; only
//     then is vote-share reliable.
//   • There is no published per-ward breakdown at MP level, so we don't show one.
//
// Earlier versions of this file contained fabricated candidates (e.g. Suleiman
// Shahbal — who actually ran for Mombasa Governor in 2013 — and Shariff Nassir,
// who died in 2005) and invented per-ward tallies. Those have been removed.

export interface HistoricalCandidate {
  name: string;
  party: string;
  votes: number | null;        // null = official tally not yet sourced
  isWinner?: boolean;
}

export interface HistoricalElection {
  year: number;
  candidates: HistoricalCandidate[];
  /** true when every candidate's official vote count is loaded (share is reliable) */
  complete: boolean;
  /** true when only the leading candidate(s) are itemised */
  partial?: boolean;
  source: string;              // primary source URL
  sourceLabel: string;
  notes: string[];
}

export const HISTORICAL_ELECTIONS: HistoricalElection[] = [
  {
    year: 2013,
    candidates: [
      { name: 'Hezron Awiti Bollo', party: 'WDM-K (Wiper)', votes: null, isWinner: true },
      { name: 'John Mcharo',        party: 'ODM',           votes: null },
    ],
    complete: false,
    partial: true,
    source: 'https://en.wikipedia.org/wiki/Hezron_Awiti_Bollo',
    sourceLabel: 'Wikipedia · The Star',
    notes: [
      'Hezron Awiti Bollo (Wiper / WDM-K) won the first-ever Nyali MP election.',
      'Runner-up was John Mcharo (ODM), former Mombasa deputy mayor — Awiti had lost the ODM primary to him and ran on Wiper.',
      'Official IEBC per-candidate vote tallies for 2013 are not yet loaded — only the confirmed winner and runner-up are shown.',
    ],
  },
  {
    year: 2017,
    candidates: [
      { name: 'Mohamed Ali (Jicho Pevu)', party: 'Independent', votes: 26798, isWinner: true },
      { name: 'Said Abdalla',             party: 'ODM',         votes: 16473 },
    ],
    complete: false,
    partial: true,
    source: 'https://www.kenyans.co.ke/news/mohamed-ali-quits-odm-vie-independent-candidate-nyali-parliamentary-seat-18876',
    sourceLabel: 'Kenyans.co.ke · The Star',
    notes: [
      'Mohamed Ali won as an Independent with 26,798 votes after losing the ODM primary to Said Abdalla.',
      'Said Abdalla (ODM) was runner-up with 16,473 votes.',
      'There were ~13 other minor candidates; their official tallies are not itemised here, so constituency vote-share is not computed for 2017.',
    ],
  },
  {
    year: 2022,
    candidates: [
      { name: 'Mohamed Ali (Jicho Pevu)', party: 'UDA',         votes: 32933, isWinner: true },
      { name: 'Said Abdallah',            party: 'ODM',         votes: 18642 },
      { name: 'Eric Gitonga Stanley',     party: 'Independent', votes:  1135 },
      { name: 'Millicent Atieno Odhiambo', party: 'Wiper',      votes:   904 },
      { name: 'Yasir Noor Mohamed',       party: 'Jubilee',     votes:   889 },
      { name: 'Japheth Marine Otieno',    party: 'Independent', votes:   601 },
      { name: 'Ferdinand Katana',         party: 'Kadu Asili',  votes:   264 },
      { name: 'Joshua Otieno Ndere',      party: 'Independent', votes:   166 },
      { name: 'Edward Mark Osewe',        party: 'PAA',         votes:   124 },
    ],
    complete: true,
    source: 'https://www.kenyanews.go.ke/nyali-mp-retains-his-seat-with-landslide-victory/',
    sourceLabel: 'Kenya News Agency (IEBC declaration)',
    notes: [
      'Mohamed Ali (UDA) retained the seat with 32,933 votes — ~59% of valid votes.',
      'Said Abdallah (ODM) was runner-up with 18,642.',
      'Full official 9-candidate slate as declared by the IEBC returning officer.',
    ],
  },
];

// ---- Strategic ward profile -------------------------------------------------
// Qualitative behaviour notes (not derived from vote tallies). Treat as field
// intelligence to validate, not as hard election data.

export interface WardProfile {
  name: string;
  behaviour: 'swing' | 'powerhouse' | 'odm_leaning' | 'mixed' | 'stable_middle';
  oneLiner: string;
  note: string;
}

export const WARD_PROFILES: WardProfile[] = [
  { name: 'Kongowea',        behaviour: 'powerhouse',    oneLiner: 'Vote powerhouse',         note: 'Largest, most populous ward — turnout here weighs heavily on the constituency result.' },
  { name: 'Frere Town',      behaviour: 'swing',         oneLiner: 'Swing ward',              note: 'Mixed, competitive ward — worth close attention in any campaign.' },
  { name: 'Ziwa La Ng\'ombe', behaviour: 'odm_leaning',  oneLiner: 'ODM-friendly',            note: 'Historically receptive to ODM messaging (qualitative — confirm on the ground).' },
  { name: 'Kadzandani',      behaviour: 'mixed',         oneLiner: 'Most politically mixed',  note: 'Cross-pressured ward where party loyalties are not fixed.' },
  { name: 'Mkomani',         behaviour: 'stable_middle', oneLiner: 'Stable middle ground',    note: 'Includes the Nyali estate; tends to track the overall constituency mood.' },
];

// ---- Constituency-wide aggregate trends -------------------------------------
// Computed ONLY for cycles with a complete official slate (so share is real).

export interface CycleTrend {
  year: number;
  totalValidVotes: number;
  winnerVotes: number;
  winnerShare: number;          // %
  runnerUpVotes: number;
  runnerUpShare: number;
  winningMargin: number;
}

export const CYCLE_TRENDS: CycleTrend[] = HISTORICAL_ELECTIONS
  .filter((e) => e.complete && e.candidates.every((c) => c.votes != null))
  .map((e) => {
    const cs = e.candidates as Array<HistoricalCandidate & { votes: number }>;
    const total = cs.reduce((s, c) => s + c.votes, 0);
    const sorted = [...cs].sort((a, b) => b.votes - a.votes);
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
