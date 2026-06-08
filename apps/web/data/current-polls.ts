// Current opinion polls — Nyali MP race for the 2027 election.
//
// Sources: published infographics from credentialed pollsters. Treat as snapshots
// in time; the campaign team should request raw cross-tabs from each pollster for
// verification before relying on these in strategic decisions.

export interface PollCandidate {
  name: string;
  percent: number;     // 0-100
  ourCandidate?: boolean;
}

export interface PollDemographics {
  gender?: { men: number; women: number };
  ageGroups?: Record<string, number>;  // band → percent (0-100)
}

export interface Poll {
  source: string;
  url?: string;
  publishedAt: string;     // ISO date
  sampleSize?: number;
  marginErrorPct?: number;
  confidenceLevelPct?: number;
  candidates: PollCandidate[];
  undecidedPct?: number;
  othersPct?: number;
  demographics?: PollDemographics;
  notes?: string[];
}

export const CURRENT_POLLS: Poll[] = [
  {
    source: 'Swiss Poll Int.',
    publishedAt: '2026-04-17',
    sampleSize: 1508,
    marginErrorPct: 3.5,
    confidenceLevelPct: 95,
    candidates: [
      { name: 'Nelson Alfayo',       percent: 64.6, ourCandidate: true },
      { name: 'Said Abdalla',        percent: 16.0 },
      { name: 'Abdulswamad Ali',     percent:  7.9 },
      { name: 'Eric Gitonga',        percent:  3.0 },
      { name: 'Abdikadir Dekow',     percent:  0.9 },
      { name: 'Protus Nyongesa',     percent:  0.3 },
      { name: 'Idris Abdirahaman',   percent:  0.3 },
    ],
    undecidedPct: 6.7,
    othersPct: 0.3,
    demographics: {
      gender: { men: 789, women: 719 },
      // From the Swiss infographic — pollster's sample composition.
      ageGroups: {
        '18-24': 8,
        '25-34': 45,
        '35-44': 33,
        '45-54': 6,
        '55+':   7,
      },
    },
    notes: [
      'If the Nyali Parliamentary election were held today, which candidate would you be most likely to vote for?',
    ],
  },
  {
    source: 'Politrack Africa',
    publishedAt: '2026-04-21',
    candidates: [
      { name: 'Nelson Alfayo',     percent: 68, ourCandidate: true },
      { name: 'Said Abdala',       percent: 21 },
      { name: 'Abdulswamad Ali',   percent:  7 },
      { name: 'Erick Gitonga',     percent:  2 },
      { name: 'Abdikadir Dekow',   percent:  1 },
    ],
    undecidedPct: 1,
    notes: [
      'Nyali Constituency residents — if the elections for Member of Parliament were held today, which candidate would you vote for?',
    ],
  },
];

// Cross-poll average (simple, no time-decay weighting).
export interface PollAverageEntry {
  name: string;
  averagePct: number;
  spread: number;          // max - min across polls (uncertainty signal)
  pollCount: number;
  ourCandidate?: boolean;
}

export function computePollAverage(polls: Poll[] = CURRENT_POLLS): PollAverageEntry[] {
  const buckets = new Map<string, { sum: number; min: number; max: number; n: number; ours: boolean }>();
  for (const p of polls) {
    for (const c of p.candidates) {
      const key = canonicalName(c.name);
      const b = buckets.get(key) ?? { sum: 0, min: Infinity, max: -Infinity, n: 0, ours: !!c.ourCandidate };
      b.sum += c.percent;
      b.min = Math.min(b.min, c.percent);
      b.max = Math.max(b.max, c.percent);
      b.n += 1;
      b.ours ||= !!c.ourCandidate;
      buckets.set(key, b);
    }
  }
  return Array.from(buckets.entries())
    .map(([name, b]) => ({
      name,
      averagePct: b.sum / b.n,
      spread: b.max - b.min,
      pollCount: b.n,
      ourCandidate: b.ours,
    }))
    .sort((a, b) => b.averagePct - a.averagePct);
}

// Collapse small-variation spellings to one bucket: 'Said Abdala' / 'Said Abdalla' / 'Said Abdallah'.
function canonicalName(raw: string): string {
  const map: Record<string, string> = {
    'Said Abdala':       'Said Abdalla',
    'Said Abdallah':     'Said Abdalla',
    'Erick Gitonga':     'Eric Gitonga',
    'Eric Gitonga Stanley': 'Eric Gitonga',
  };
  return map[raw] ?? raw;
}
