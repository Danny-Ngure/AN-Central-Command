// AUTO-GENERATED — Nyali churches from the IEBC church register, filtered to
// Nyali Constituency (plus-code geocoding + ward-polygon test) and mapped to ward
// + village. Rendered read-only on the ward page's Religious & Social Sites tab so
// the data reflects immediately. To persist into the DB, run tools/seed-nyali-churches.cjs.

export interface NyaliChurch {
  wardId: string; name: string; village: string | null;
  phone: string | null; voters: number | null; lat: number | null; lng: number | null;
}

export const NYALI_CHURCHES: NyaliChurch[] = [
  { wardId: '22222222-0000-4000-8000-000000000005', name: 'Breakthrough Chapel International', village: 'Kidogo Basi', phone: '0722659845', voters: 1759, lat: -4.03604, lng: 39.69902 },
  { wardId: '22222222-0000-4000-8000-000000000005', name: 'St. Francis Of Assisi Catholic Church - Nyali', village: 'Timboni', phone: '0724241754', voters: 2168, lat: -4.02621, lng: 39.71305 },
  { wardId: '22222222-0000-4000-8000-000000000003', name: 'Vineyard Church Mombasa', village: 'Nyali', phone: '0111 216216', voters: 1965, lat: null, lng: null },
  { wardId: '22222222-0000-4000-8000-000000000003', name: 'Prophetic embassy church of all nations', village: 'Mkomani', phone: '0715 229169', voters: 2069, lat: null, lng: null },
  { wardId: '22222222-0000-4000-8000-000000000003', name: 'Nyali Baptist Church', village: 'Nyali', phone: '0790 500005', voters: 2485, lat: null, lng: null },
  { wardId: '22222222-0000-4000-8000-000000000003', name: 'Christ Is The Answer Ministries (CITAM) Mombasa', village: 'Nyali', phone: '+254 721 512704', voters: 3514, lat: -4.05594, lng: 39.69969 },
  { wardId: '22222222-0000-4000-8000-000000000003', name: 'Nyali SDA church', village: 'Nyali', phone: '0714 603932', voters: 2587, lat: null, lng: null },
  { wardId: '22222222-0000-4000-8000-000000000003', name: 'African Prophetic Church In Kenya', village: 'Nyali', phone: '+254 722 311080', voters: 3451, lat: null, lng: null },
  { wardId: '22222222-0000-4000-8000-000000000003', name: 'Crossroads Fellowship, Nyali.', village: 'Sosiani', phone: '0727 593663', voters: 2480, lat: -4.03996, lng: 39.70473 },
  { wardId: '22222222-0000-4000-8000-000000000002', name: 'Inspiration Centre Deliverance Church International.', village: 'Kongowea', phone: '0734 817840', voters: 1254, lat: null, lng: null },
  { wardId: '22222222-0000-4000-8000-000000000002', name: 'Nyali Fellowship', village: 'Karama', phone: '+254 722 853412', voters: 3321, lat: -4.03846, lng: 39.6977 },
  { wardId: '22222222-0000-4000-8000-000000000002', name: 'Elim Evangelistic P.E.F.A Church Kongowea', village: 'Karama', phone: '+254 713 899777', voters: 2658, lat: null, lng: null },
  { wardId: '22222222-0000-4000-8000-000000000002', name: 'AIC Kongowea & Pwani Bible College', village: 'Masandukuni', phone: '0748 957068', voters: 1694, lat: -4.03989, lng: 39.6813 },
  { wardId: '22222222-0000-4000-8000-000000000001', name: 'CHRISTIAN CHURCH INTERNATIONAL-WORSHIP CENTRE', village: 'Bombolulu', phone: '0799 220929', voters: 2358, lat: null, lng: null },
  { wardId: '22222222-0000-4000-8000-000000000001', name: 'St. Martin de Pores Mbungoni, Marianist Church', village: 'Mwatamba Gorofani', phone: '7256978458', voters: 6350, lat: -4.01939, lng: 39.70092 },
];

// Site-shaped, read-only objects for the ward page's SiteCard list.
export function churchesForWard(wardId: string): any[] {
  return NYALI_CHURCHES.filter((c) => c.wardId === wardId).map((c, i) => ({
    id: `nyali-church-${wardId.slice(-2)}-${i}`,
    type: 'church',
    name: c.name,
    areaName: c.village,
    contactPhone: c.phone,
    contactRole: 'Pastor',
    estimatedSize: c.voters,
    visited: false,
    readOnly: true, // reference data — no visit toggle/log
  }));
}
