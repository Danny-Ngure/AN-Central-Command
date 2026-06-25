// Alfayo Flames crew — the women's flame crew. This is the leadership / in-charge
// roster (partial; rank-and-file to follow). Each member gets an auto-generated
// Member ID and Agent ID (FLM prefix) in the same style as the ward teams and
// Warembo. National IDs aren't supplied yet, so polling-station matching is
// deferred until they're added.

export type FlamesMember = {
  name: string;
  title?: string; // portfolio / office (Matron, Chairlady, ward, Security, …)
  phone?: string;
};

export const FLAMES_PREFIX = 'FLM';

export const FLAMES_CREW: FlamesMember[] = [
  { name: 'Lucy Agutu', title: 'Matron', phone: '0702816974' },
  { name: 'Judith Asienga', title: 'Chairlady', phone: '0754266365' },
  { name: 'Edith Kiengah', title: 'Secretary', phone: '0710251823' },
  { name: 'Mercy Okuoga', title: 'Treasurer', phone: '0708192632' },
  { name: 'Elizabeth Oloo', title: 'Kadzandani', phone: '0722772991' },
  { name: 'Elizabeth Mwatete', title: 'Frere Town', phone: '0715488749' },
  { name: 'Susan Adhiambo', title: 'Mkomani', phone: '0754591090' },
  { name: "Hawaa Musasula", title: "Ziwa La Ng'ombe", phone: '0723818052' },
  { name: 'Achola', title: 'Kidogo Basi' },
  { name: 'Winnie Meshack', title: 'Security', phone: '0790629109' },
  { name: 'Sharon Onyango', title: 'Security', phone: '0716686577' },
  { name: 'Jane', title: 'Kadzandani', phone: '0718689283' },
  { name: 'Everlyn Ngoto', title: 'Single Mothers', phone: '0708832006' },
  { name: 'Purity Grecious', title: 'Media', phone: '0706830976' },
];

// ── Rank-and-file Alfayo Flames crew, grouped by ward ───────────────────────
// The full per-ward membership roster (the leadership above are the office
// bearers). Same shape as the Warembo roster; phones kept in local format.
// IEBC voter cross-match (by phone/name) is surfaced separately on the /flames
// page; here National IDs aren't supplied so polling-station linkage is deferred.

export type FlamesRosterMember = { name: string; phone?: string };
export type FlamesWardGroup = { ward: string; members: FlamesRosterMember[] };

export const FLAMES_ROSTER: FlamesWardGroup[] = [
  {
    ward: 'Kadzandani Ward',
    members: [
      { name: 'Judith Asienga', phone: '0796697137' },
      { name: 'Elizabeth Aloo', phone: '0722772991' },
      { name: 'Jane Okeyo', phone: '0718689283' },
      { name: 'Purity', phone: '0727399341' },
      { name: 'Tima Mohamed', phone: '0711919277' },
      { name: 'Ramla Hamadi', phone: '0704849572' },
      { name: 'Salma Odongo', phone: '0745361334' },
      { name: 'Rashida Abdalla', phone: '0710123707' },
      { name: 'Jamila Kimwinyi', phone: '0729753685' },
      { name: 'Mishi Katana', phone: '0741083929' },
      { name: 'Winnie Mwambaru', phone: '0792811602' },
      { name: 'Josephine Mwenda', phone: '0722660181' },
    ],
  },
  {
    ward: 'Frere Town Ward',
    members: [
      { name: 'Edith A. Kienga', phone: '0710251823' },
      { name: 'Elizabeth Dama', phone: '0715488749' },
      { name: 'Winnie Meshack', phone: '0790629109' },
      { name: 'Pauline Adhiambo', phone: '0700652904' },
      { name: 'Jackline John', phone: '0701932522' },
      { name: 'Olivia Anyango', phone: '0745833489' },
      { name: 'Sharon Onyango', phone: '0716686577' },
      { name: 'Racheal Awuor', phone: '0740347207' },
      { name: 'Ann Macharia', phone: '0713666899' },
      { name: 'Phenistus Munania', phone: '0716746365' },
      { name: 'Jane Mwende' },
      { name: 'Josphine Otieno', phone: '0715890428' },
      { name: 'Charleen Awuor', phone: '0793535792' },
      { name: 'Metrin Wanyama', phone: '0740555824' },
      { name: 'Lucy Odongo', phone: '0113342960' },
      { name: 'Seraphine Akello', phone: '0746331980' },
      { name: 'Zainabu Kalama', phone: '0702148701' },
      { name: 'Fatma Shee', phone: '0706686518' },
      { name: 'Mwanamkuu Abdalla', phone: '0703246837' },
      { name: 'Saumu Saidi', phone: '0758439496' },
      { name: 'Amina Kazungu', phone: '0701386173' },
      { name: 'Mary Katana', phone: '0792866322' },
      { name: 'Juliana' },
      { name: 'Prisca Karisa', phone: '0718702208' },
      { name: 'Banistray Omondi', phone: '0791958270' },
      { name: 'Florence Dunell', phone: '0704973881' },
      { name: 'Mariam Omar', phone: '0725573422' },
      { name: 'Rukia Musa', phone: '0741775194' },
      { name: 'Lilian Adhiambo', phone: '0790302609' },
      { name: 'Ruth Kache', phone: '0701795832' },
      { name: 'Mapenzi Rachael', phone: '0792681893' },
      { name: 'Jane Mtawali', phone: '0700317604' },
      { name: 'Zawadi Williams', phone: '0718841552' },
      { name: 'Faith Mwikali', phone: '0710115754' },
      { name: 'Uba Mohammad', phone: '0715803527' },
    ],
  },
  {
    ward: "Ziwa La Ng'ombe Ward",
    members: [
      { name: 'Everlyn Obuya', phone: '0713687429' },
      { name: 'Millicent Ochika', phone: '0701591002' },
      { name: 'Jackline Edira', phone: '0790334432' },
      { name: 'Hawaa Muhamed', phone: '0762009945' },
      { name: 'Mwanaisha Kaure', phone: '0712449262' },
      { name: 'Joan Rose', phone: '0740786184' },
      { name: 'Zeitun Masha', phone: '0111635563' },
      { name: 'Subira Iddi', phone: '0712898686' },
      { name: 'Asia Salim', phone: '0111876269' },
      { name: 'Idah Adhiambo', phone: '0142290089' },
      { name: 'Winnie Awuor', phone: '0793940665' },
      { name: 'Rose Ogongo', phone: '0720720463' },
      { name: 'Vivian Sen', phone: '0114410621' },
      { name: 'Zeddy Chepkoech', phone: '0704328530' },
      { name: 'Mariam Ali', phone: '0704209899' },
      { name: 'Mara Mghendi', phone: '0712533268' },
      { name: 'Zubedq Swaleh', phone: '0795845170' },
      { name: 'Margret Ochola', phone: '0713304642' },
      { name: 'Bipopo Masha', phone: '0703147693' },
      { name: 'Martina', phone: '0701932614' },
      { name: 'Mariam Issa', phone: '0790633162' },
      { name: 'Eunice Luka', phone: '0717226610' },
      { name: 'Mwanamkuu Abdalla', phone: '0705201790' },
      { name: 'Grace Makena', phone: '0708227281' },
      { name: 'Christine Njema', phone: '0714226898' },
      { name: 'Everline Nanda', phone: '0723557958' },
      { name: 'Molly Kitoto', phone: '0715034070' },
      { name: 'Caroline Awuor', phone: '0727605066' },
      { name: 'Caroline Msili', phone: '0746332809' },
      { name: 'Anna Kasendi', phone: '0700193274' },
    ],
  },
  {
    ward: 'Mkomani Ward',
    members: [
      { name: 'Purity Mukoko', phone: '0706830976' },
      { name: 'Lucy Agutu', phone: '0750419496' },
      { name: 'Susan Athiambo', phone: '0754591090' },
      { name: 'Fridah Akoth', phone: '0703224617' },
      { name: 'Neema Joseph', phone: '0718621911' },
      { name: 'Martha Shihemi', phone: '0792842391' },
      { name: 'Rose Ajema', phone: '0795910045' },
      { name: 'Jackline Dan', phone: '0731662379' },
      { name: 'Mary Atieno', phone: '0745709939' },
      { name: 'Fatuma Kulola', phone: '0790574094' },
      { name: 'Julian Akinyi', phone: '0796463976' },
      { name: 'Philgona Azwon', phone: '0707707883' },
      { name: 'Zawadi William', phone: '0718841552' },
      { name: 'Sofia Tukimia', phone: '0743253184' },
      { name: 'Grace Awuor', phone: '0704017831' },
      { name: 'Purity Rose', phone: '0759840380' },
      { name: 'Everline Ngoto', phone: '070882006' },
      { name: 'Dina Nahumicha', phone: '0741644487' },
      { name: 'Grace Musembi', phone: '0743076232' },
      { name: 'Lilian Muchewa', phone: '0701342199' },
      { name: 'Martha Chao', phone: '0716152832' },
      { name: 'Janet Akoth', phone: '0751912740' },
      { name: 'Winnie Achieng', phone: '0716368744' },
      { name: 'Irine Akinyi', phone: '0114231028' },
      { name: 'Jackline Oyie', phone: '0790334432' },
      { name: 'Fatuma Matano', phone: '0111337644' },
      { name: 'Maureen Akinyi' },
      { name: 'Halima Musa' },
      { name: 'Celestine Awino', phone: '0768334793' },
      { name: 'Joan Rose', phone: '0740786184' },
      { name: 'Mildred Akinyi', phone: '0705566406' },
      { name: 'Catherine Awino' },
    ],
  },
  {
    ward: 'Kongowea Ward',
    members: [
      { name: 'Mercy Akinyi', phone: '0708192632' },
      { name: 'Lilian Nyakundi', phone: '0701758881' },
      { name: 'Eunice Nduko', phone: '0717110616' },
      { name: 'Rose Chimosi', phone: '0725164144' },
      { name: 'Ruth Ratemo', phone: '0725532854' },
      { name: 'Recho Mumbi', phone: '0712951195' },
      { name: 'Josphine Joel', phone: '0712552114' },
      { name: 'Gojine Nyagilo', phone: '0790909866' },
      { name: 'Joyce Onyancha', phone: '0748405005' },
      { name: 'Firdhaus Oloo', phone: '0703224617' },
      { name: 'Aisha Khamisi', phone: '0758534393' },
      { name: 'Aphline', phone: '0799765384' },
      { name: 'Florence Nyatwori', phone: '0703490278' },
      { name: 'Sara Okeyo', phone: '074899853' },
      { name: 'Jane Nganga', phone: '0746997422' },
      { name: 'Susan', phone: '0714761881' },
      { name: 'Grace', phone: '0720282534' },
      { name: 'Magret', phone: '0702906385' },
      { name: 'Moraa', phone: '0746312899' },
      { name: 'Everlyne Kerubo', phone: '0792374550' },
      { name: 'Zipporah Kwamboka', phone: '0721119118' },
      { name: 'Jackline Asiago', phone: '0718685072' },
      { name: 'Emily Dinga', phone: '0719552001' },
      { name: 'Eunine Kemunto', phone: '0701543058' },
      { name: 'Caro Mariango', phone: '0741790377' },
      { name: 'Ruth Moraa', phone: '07255532854' },
      { name: 'Angelina Ngira', phone: '07255532853' },
    ],
  },
];

export const FLAMES_ROSTER_COUNT = FLAMES_ROSTER.reduce((n, g) => n + g.members.length, 0);

// Per-ward Member-ID prefixes for the Flames rank-and-file (fire crew + ward).
export const FLAMES_WARD_PREFIX: Record<string, string> = {
  'Kadzandani Ward': 'FLKD',
  'Frere Town Ward': 'FLFT',
  "Ziwa La Ng'ombe Ward": 'FLZW',
  'Mkomani Ward': 'FLMK',
  'Kongowea Ward': 'FLKO',
};
