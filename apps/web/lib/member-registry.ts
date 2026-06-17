// Canonical member-ID registry.
//
// One human → ONE Member ID + ONE Agent ID, no matter how many crews they appear
// in (Executive, ward leadership, ward field team, Warembo, Alfayo Flames, …).
//
// IDs are WARD / CREW prefixed, e.g.:
//   KAD / MKM / KON / FRT / ZIW   → ward teams (and ward leadership)
//   WMK / WAKD / WAKO / …         → Warembo per ward
//   ALF                           → Alfayo Flames crew
//
// Two rules:
//   1. STICKY — if a person already holds a DB-assigned ID (e.g. Lucy = MKM002),
//      she keeps it everywhere, even inside the Flames crew.
//   2. HIERARCHY — a person's ID comes from their most senior membership. Bands:
//        1 Executive · 2 Coordinators · 3 Technical · 4 Area leaders · 5 Members.
//      Generated numbers are handed out per-prefix in that priority order, and
//      continue AFTER the highest existing number already used for that prefix.
//
// De-duplication is union-find over phone (last 9 digits), National ID, and full
// name (2+ tokens), so "Lucy Agutu"/"Lucy Ogutu" (shared phone) and the two
// "Salma Khalef" entries (shared name) each collapse to a single person/ID.

export type Band = 1 | 2 | 3 | 4 | 5;

export type RegInput = {
  name: string;
  phone?: string | null;
  nationalId?: string | null;
  photoSrc?: string | null;
  band: Band;
  prefix: string; // ward / crew prefix for THIS membership
  existingId?: string | null; // DB-assigned ID that should stick
  crewRank?: number; // tie-break for which prefix wins within a band (lower = preferred)
};

export type Resolved = { memberId: string; agentId: string; photoSrc: string | null; band: Band };

function digits(s?: string | null): string {
  return (s ?? '').replace(/\D/g, '');
}
function phoneKey(p?: string | null): string {
  const d = digits(p);
  return d.length >= 9 ? 'p:' + d.slice(-9) : '';
}
function nidKey(n?: string | null): string {
  const d = digits(n);
  return d ? 'n:' + d : '';
}
function nameKey(n: string): string {
  const t = (n ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return t.length >= 2 ? 'm:' + t.join(' ') : '';
}
function signals(i: RegInput): string[] {
  return [phoneKey(i.phone), nidKey(i.nationalId), nameKey(i.name)].filter(Boolean);
}
function agentFromMember(memberId: string): string {
  const m = memberId.match(/^([A-Za-z]+)(.*)$/);
  return m ? `${m[1]}-A${m[2]}` : `${memberId}-A`;
}

export class MemberRegistry {
  private byKey = new Map<string, Resolved>();

  constructor(inputs: RegInput[]) {
    // ── union-find to merge same-person entries ──
    const parent = inputs.map((_, i) => i);
    const find = (x: number): number => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    const union = (a: number, b: number) => {
      parent[find(a)] = find(b);
    };
    const firstSeen = new Map<string, number>();
    inputs.forEach((inp, i) => {
      for (const s of signals(inp)) {
        const prev = firstSeen.get(s);
        if (prev === undefined) firstSeen.set(s, i);
        else union(i, prev);
      }
    });

    const groups = new Map<number, number[]>();
    inputs.forEach((_, i) => {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r)!.push(i);
    });

    const bySeniority = (a: RegInput, b: RegInput) =>
      a.band - b.band || (a.crewRank ?? 0) - (b.crewRank ?? 0);

    type Person = {
      band: Band;
      name: string;
      photoSrc: string | null;
      sigs: Set<string>;
      fixedId: string | null;
      genPrefix: string;
    };
    const persons: Person[] = [...groups.values()].map((idxs) => {
      const ms = idxs.map((i) => inputs[i]);
      const band = Math.min(...ms.map((m) => m.band)) as Band;
      const name = ms.map((m) => m.name).sort((a, b) => b.length - a.length)[0];
      const photoSrc = ms.map((m) => m.photoSrc).find(Boolean) ?? null;
      const sigs = new Set<string>();
      idxs.forEach((i) => signals(inputs[i]).forEach((s) => sigs.add(s)));
      // Sticky ID from the most senior membership that already has one.
      const withId = ms.filter((m) => m.existingId).sort(bySeniority);
      const fixedId = withId.length ? withId[0].existingId! : null;
      // Otherwise the prefix of the most senior membership wins.
      const primary = [...ms].sort(bySeniority)[0];
      return { band, name, photoSrc, sigs, fixedId, genPrefix: primary.prefix };
    });

    // Highest existing number per prefix → generated IDs continue after it.
    const maxNum = new Map<string, number>();
    for (const p of persons) {
      if (!p.fixedId) continue;
      const m = p.fixedId.match(/^([A-Za-z]+)(\d+)$/);
      if (!m) continue;
      maxNum.set(m[1], Math.max(maxNum.get(m[1]) ?? 0, parseInt(m[2], 10)));
    }

    // Sticky people first (so their numbers are reserved), then generate the rest
    // per prefix in priority order (band, then name).
    const register = (p: Person, memberId: string) => {
      const res: Resolved = { memberId, agentId: agentFromMember(memberId), photoSrc: p.photoSrc, band: p.band };
      for (const s of p.sigs) this.byKey.set(s, res);
    };
    for (const p of persons) if (p.fixedId) register(p, p.fixedId);

    const counter = new Map<string, number>();
    persons
      .filter((p) => !p.fixedId)
      .sort((a, b) => a.band - b.band || a.name.localeCompare(b.name))
      .forEach((p) => {
        const start = maxNum.get(p.genPrefix) ?? 0;
        const c = (counter.get(p.genPrefix) ?? 0) + 1;
        counter.set(p.genPrefix, c);
        register(p, `${p.genPrefix}${String(start + c).padStart(3, '0')}`);
      });
  }

  resolve(name: string, phone?: string | null, nationalId?: string | null): Resolved | null {
    return (
      this.byKey.get(phoneKey(phone)) ??
      this.byKey.get(nidKey(nationalId)) ??
      this.byKey.get(nameKey(name)) ??
      null
    );
  }
}
