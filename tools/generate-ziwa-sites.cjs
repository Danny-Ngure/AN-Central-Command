// Generate tools/data/ziwa-sites.xlsx in the coordinator-PDF format.
// Source: Downloads/PROGRAM ZIWA WARD.docx
//
// 10 villages grouped under Ziwa La Ng'ombe ward:
//   Kisimani B · Ziwa Primary · Idd Kumbi/Kidogo Basi · VOK/Leisure ·
//   Ziwa Village · Kangi · Vienna · Mkunguni · Timboni · Kisimani A
// 5 mosques attached to their respective villages.

const path = require('path');
const fs = require('fs');
const XLSX = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'xlsx@0.18.5', 'node_modules', 'xlsx'));

// ── CHURCHES ────────────────────────────────────────────────────────────────

const kisimaniB = [
  { name: 'Salvation Church of Soul Ministry', leader: 'Pst. Rahel',          phone: '0715152832' },
  { name: 'Deliverance Church',                leader: 'Pst. Lawrence',       phone: '0780617050' },
  { name: 'Evangelistic Christ Church',        leader: 'Pst. Justus',         phone: '0720660139' },
  { name: 'Pillars of Ministry Church',        leader: 'Pst. Rose Odoyo',     phone: '0702852300' },
  { name: 'Morning Star School Church',        leader: 'Pst. Jane',           phone: '0716817880' },
];

const ziwaPrimary = [
  { name: 'The Upper Room Church',                       leader: 'Pst. Stephen',        phone: '0722532401' },
  { name: 'King of King Worship Church',                 leader: 'Bishop Edder',        phone: '0714118774' },
  { name: 'EAPCA Kisimani',                              leader: 'Rev. Phoebe / Robert Munyasya', phone: '0721555653' },
  { name: 'Evangelical Christ Church of Africa Sports',  leader: 'Pst. Felix',          phone: '0736018369' },
];

const iddKumbi = [
  { name: 'Ushindi Baptist Church',                      leader: 'Pst. Carolyn',        phone: '0799409935' },
  { name: 'New Family Church',                           leader: 'Pst. Noah Kimaiyo',   phone: '0723360858' },
  { name: 'Kisima Cha Roho Church',                      leader: 'Pst. Winny Moses',    phone: '0711629153' },
  { name: 'Msando Holy Ghost Church',                    leader: 'Pst. Fred',           phone: '0727823715' },
];

const vok = [
  { name: 'Pentecostal House of Worship Church',         leader: 'Pst. Sedrick Wafula', phone: '0725832269' },
  { name: 'Kidogo Basi SDA Church',                      leader: 'Pst. Momanyi',        phone: '0721415637' },
  { name: 'Agape Church Vok',                            leader: 'Pst. Jacob Ouko',     phone: '0790628453' },
  { name: 'Nomiya Pentecostal Church Maweni',            leader: 'Willis Omondi',       phone: '0724402585' },
  { name: 'Tumaini Church (Tumaini Academy)',            leader: 'Pst. Moses Kitula',   phone: '0724653023' },
];

const ziwaVillage = [
  { name: 'Holy Spirit Fellowship Church',               leader: 'Pst. Victor',         phone: '0725954019' },
  { name: 'Bombolulu SDA Church',                        leader: '',                    phone: '0710371336' },
  { name: 'AIPCA Nyali',                                 leader: 'Pst. Michael',        phone: '0714508039' },
  { name: 'GRC Church Ziwa',                             leader: 'Pst. Derick',         phone: '0758544686' },
];

const kangi = [
  { name: 'Mango m Mzuri Church',                        leader: 'Pst. Timothy Mafuaha',phone: '0731997541' },
  { name: 'Vosh Fellowship Penta Church',                leader: 'Pst. Jeremiah Ogoya', phone: '0723782705' },
];

const vienna = [
  { name: 'Cool Eden School Churches',                   leader: 'Pst. Peter Kahindi',  phone: '0787064832' },
  { name: 'Back to the Covenant Church',                 leader: 'Pst. Alex',           phone: '0724396149' },
  { name: 'Born Again Church',                           leader: 'Pst. Ben',            phone: '0786743363' },
  { name: 'Nazareth Deliverance Church',                 leader: 'Pst. Anastasia Mulwa',phone: '0727328390' },
  { name: 'Soul Rescue Center Church',                   leader: 'Pst. David Papa',     phone: '0720179441' },
  { name: 'Vision Apostolic Church',                     leader: 'Pst. Nicholas',       phone: '0712814546' },
  { name: 'House of Prayer Church',                      leader: 'Pst. Ponda',          phone: '0715009191' },
  { name: 'Disciples of Christ Church',                  leader: 'Pst. Michael Njoroge',phone: '0723756086' },
  { name: 'African Church of the Holy Spirit',           leader: 'Pst. Benard',         phone: '0701646380' },
  { name: 'The Sanctuary of Praise Church',              leader: 'Pst. Kamba',          phone: '0727544679' },
  { name: 'Olives Ministry Church',                      leader: 'Pst. Steve / Michael',phone: '0717830133' },
];

const mkunguni = [
  { name: 'IFC Church',                                  leader: 'Bishop Francis Charo',phone: '0711259662' },
  { name: 'Bethel Church',                               leader: 'Pst. Kilonzo',        phone: '0726644380' },
];

const timboni = [
  { name: 'Gates of Holiness Church',                    leader: 'Pst. Moses Masiga',   phone: '0722305835' },
  { name: 'Flames of Revival Church',                    leader: 'Pst. Jonathan',       phone: '0720068999' },
];

const kisimaniA = [
  { name: 'Church of God 7th Day Kisimani',              leader: '',                    phone: '0724269626' },
  { name: 'Africa Inland Church Kisimani',               leader: 'Pst. James',          phone: '0707428007' },
  { name: 'Gospel of Peace Kisimani',                    leader: '',                    phone: '0712532333' },
  { name: 'Ruwe Holy Ghost Church',                      leader: 'Pst. Joel Juma',      phone: '0733558025' },
  { name: 'Upendo Evangelism Church',                    leader: 'Pst. Mathias',        phone: '0723453037' },
  { name: 'Valley of Restoration Church',                leader: 'Pst. Francis Katana', phone: '0729398277' },
];

const churches = [
  ...kisimaniB.map((c)   => ({ ...c, location: 'KISIMANI B' })),
  ...ziwaPrimary.map((c) => ({ ...c, location: 'ZIWA PRIMARY' })),
  ...iddKumbi.map((c)    => ({ ...c, location: 'IDD KUMBI / KIDOGO BASI' })),
  ...vok.map((c)         => ({ ...c, location: 'VOK / LEISURE' })),
  ...ziwaVillage.map((c) => ({ ...c, location: 'ZIWA LA NGOMBE VILLAGE' })),
  ...kangi.map((c)       => ({ ...c, location: 'KANGI' })),
  ...vienna.map((c)      => ({ ...c, location: 'VIENNA' })),
  ...mkunguni.map((c)    => ({ ...c, location: 'MKUNGUNI' })),
  ...timboni.map((c)     => ({ ...c, location: 'TIMBONI' })),
  ...kisimaniA.map((c)   => ({ ...c, location: 'KISIMANI A' })),
];

// ── MOSQUES ─────────────────────────────────────────────────────────────────

const mosques = [
  { name: 'Masjid Kibas',      location: 'IDD KUMBI',  leader: 'Ustadh Iddi Mambo',  phone: '0722833155' },
  { name: 'Masjid Salam',      location: 'VIENNA',     leader: 'Bishar Abdi',        phone: '0723031693' },
  { name: 'Masjid Mujahideen', location: 'MKUNGUNI',   leader: 'Ustadh Shee',        phone: '0702140113' },
  { name: 'Masjid Bhoth',      location: 'MKUNGUNI',   leader: 'Baresa',             phone: '0705187540' },
  { name: 'Masjid Anwar',      location: 'MKUNGUNI',   leader: '',                   phone: '' },
];

// ── Build the sheet ─────────────────────────────────────────────────────────

const aoa = [];
aoa.push(['', "ZIWA LA NG'OMBE", '', '']);
aoa.push(['NAME OF MOSQUE', 'LOCATION', 'LEADERSHIP', 'TELEPHONE']);
for (const m of mosques) aoa.push([m.name, m.location, m.leader, m.phone]);
aoa.push(['', '', '', '']);
aoa.push(['', "ZIWA LA NG'OMBE", '', '']);
aoa.push(['NAME OF CHURCH', 'LOCATION', 'LEADERSHIP', 'TELEPHONE']);
for (const c of churches) aoa.push([c.name, c.location, c.leader, c.phone]);

const ws = XLSX.utils.aoa_to_sheet(aoa);
ws['!cols'] = [{ wch: 46 }, { wch: 26 }, { wch: 34 }, { wch: 14 }];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Ziwa La Ng'ombe");

const outPath = path.join(__dirname, 'data', 'ziwa-sites.xlsx');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
XLSX.writeFile(wb, outPath);

console.log('OK — wrote ' + outPath);
console.log('  Mosques: ' + mosques.length);
console.log('  Churches: ' + churches.length);
console.log('    Kisimani B: ' + kisimaniB.length);
console.log('    Ziwa Primary: ' + ziwaPrimary.length);
console.log('    Idd Kumbi: ' + iddKumbi.length);
console.log('    VOK / Leisure: ' + vok.length);
console.log('    Ziwa Village: ' + ziwaVillage.length);
console.log('    Kangi: ' + kangi.length);
console.log('    Vienna: ' + vienna.length);
console.log('    Mkunguni: ' + mkunguni.length);
console.log('    Timboni: ' + timboni.length);
console.log('    Kisimani A: ' + kisimaniA.length);
console.log('  Total: ' + (mosques.length + churches.length));
