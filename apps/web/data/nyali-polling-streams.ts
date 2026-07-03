// AUTO-GENERATED — Nyali polling STREAMS from the IEBC 2022 Register of Voters.
// One entry per polling centre, keyed by a normalised station name so it matches
// regardless of spelling/case. Each number = registered voters in that stream.
// Source: IEBC 2022 register; per-stream figures via kenyayote.co.ke; centres
// cross-checked with blog.afro.co.ke/polling-stations/mombasa/nyali.
// Regenerate: see tools note. Streams are the desks a centre runs on election day.

export interface StationStreams {
  /** Canonical centre name. */ name: string;
  /** Ward the centre sits in. */ ward: string;
  /** Registered voters per stream, in IEBC order. */ streams: number[];
}

// key = name.toUpperCase().replace(/[^A-Z0-9]/g, '')
export const NYALI_POLLING_STREAMS: Record<string, StationStreams> = {
  'FRERETOWNPRIMARYSCHOOL': { name: 'Frere Town Primary School', ward: 'Frere Town', streams: [699, 698, 698, 698, 698, 698, 698, 698, 698] },
  'FRERETOWNSECONDARYSCHOOL': { name: 'Freretown Secondary School', ward: 'Frere Town', streams: [673, 672] },
  'KHADIJAPRIMARYSCHOOL': { name: 'Khadija Primary School', ward: 'Frere Town', streams: [650, 650, 650, 650, 650, 650, 650, 649] },
  'FADHILADHYMPRIMARYSCHOOL': { name: 'Fadhil-Adhym Primary School', ward: 'Frere Town', streams: [612, 612, 611] },
  'TEMANJUNIORACADEMY': { name: 'Teman Junior Academy', ward: 'Frere Town', streams: [610] },
  'SARAJEVOGROUNDS': { name: 'Sarajevo Grounds', ward: 'Frere Town', streams: [605, 604, 604, 604, 604] },
  'VICTORIABAPTISTPRIMARYSCHOOL': { name: 'Victoria Baptist Primary School', ward: 'Frere Town', streams: [587, 586, 586] },
  'MLALEOPRIMARYSCHOOL': { name: 'Mlaleo Primary School', ward: 'Frere Town', streams: [566, 565, 565, 565, 565] },
  'MWANDONIKADIRIAGROUNDS': { name: 'Mwandoni Kadiria Grounds', ward: 'Frere Town', streams: [535, 535, 534] },
  'KHADIJASECONDARYSCHOOL': { name: 'Khadija Secondary School', ward: 'Frere Town', streams: [489, 488] },
  'ZIWALANGOMBEPRIMARYSCHOOL': { name: 'Ziwa La Ng\'ombe Primary School', ward: 'Ziwa La Ng\'ombe', streams: [680, 680, 680, 680, 680, 680, 680, 680, 680, 680, 679, 679, 679, 679] },
  'KICODEPHALL': { name: 'KICODEP Hall', ward: 'Ziwa La Ng\'ombe', streams: [543, 543, 543] },
  'AZHARPRIMARYSCHOOL': { name: 'Azhar Primary School', ward: 'Ziwa La Ng\'ombe', streams: [472] },
  'MKOMANIGROUNDS': { name: 'Mkomani Grounds', ward: 'Mkomani', streams: [687, 687, 687, 687] },
  'MAWENIPRIMARYSCHOOL': { name: 'Maweni Primary School', ward: 'Mkomani', streams: [668, 668, 668, 668, 668, 667, 667, 667, 667, 667] },
  'MAWENIMIXEDSECONDARYSCHOOL': { name: 'Maweni Mixed Secondary School', ward: 'Mkomani', streams: [647, 647, 647, 647] },
  'ASKGROUNDGATEA': { name: 'ASK Ground - Gate \'A\'', ward: 'Mkomani', streams: [636, 636, 636, 636, 636, 636, 636, 636] },
  'KENGELENIPRIMARYSCHOOL': { name: 'Kengeleni Primary School', ward: 'Kongowea', streams: [693, 693, 693, 693, 693] },
  'KWAKARAMAGROUNDS': { name: 'Kwa Karama Grounds', ward: 'Kongowea', streams: [672, 672, 672, 672, 672, 671, 671, 671, 671, 671, 671] },
  'KONGOWEAPRIMARYSCHOOL': { name: 'Kongowea Primary School', ward: 'Kongowea', streams: [668, 668, 668, 667, 667, 667, 667, 667, 667, 667, 667, 667] },
  'MUNICIPALSOCIALHALLKONGOWEA': { name: 'Municipal Social Hall - Kongowea', ward: 'Kongowea', streams: [656, 656, 655, 655, 655, 655] },
  'METHODISTCHURCHKONGOWEA': { name: 'Methodist Church - Kongowea', ward: 'Kongowea', streams: [628, 628, 627, 627, 627, 627, 627, 627] },
  'KONGOWEASECONDARYSCHOOL': { name: 'Kongowea Secondary School', ward: 'Kongowea', streams: [519, 519] },
  'BASHIRPRIMARYSCHOOL': { name: 'Bashir Primary School', ward: 'Kadzandani', streams: [659, 658, 658, 658] },
  'MWATAMBAGROUNDS': { name: 'Mwatamba Grounds', ward: 'Kadzandani', streams: [627, 627, 627, 626, 626, 626] },
  'KADZANDANIPRIMARYSCHOOL': { name: 'Kadzandani Primary School', ward: 'Kadzandani', streams: [620, 619, 619, 619, 619, 619] },
  'SOWETOGROUNDS': { name: 'Soweto Grounds', ward: 'Kadzandani', streams: [562, 562, 562, 562, 562] },
  'MARIANISTPOLYTECHNIC': { name: 'Marianist Polytechnic', ward: 'Kadzandani', streams: [557, 557, 556] },
  'BAHAWANIPRIMARYSCHOOL': { name: 'Bahawani Primary School', ward: 'Kadzandani', streams: [539, 539, 538, 538] },
};

export function streamsForStation(stationName: string): StationStreams | null {
  const key = stationName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return NYALI_POLLING_STREAMS[key] ?? null;
}
