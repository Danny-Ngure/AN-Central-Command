// Generate tools/data/mkomani-sites.xlsx in the coordinator-PDF format.
// Source 1: Downloads/CHURCHES.pdf (MKOMANI WARD CHURCH)
// Source 2: handwritten MSKITI note (transcribed below — verify spellings against original)
//
// 4 sub-areas for churches: Maweni · Shauri Yako · Mnazi Moja · Showground
// 10 mosques from the handwritten list (numbers 8, 9, 10 missing in source).

const path = require('path');
const fs = require('fs');
const XLSX = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'xlsx@0.18.5', 'node_modules', 'xlsx'));

// ────────────────────────────────────────────────────────────────────────────
// MOSQUES — from handwritten "MSKITI" note. Names prefixed with "Masjid"
// for consistency with the other ward files.
// Entries 8, 9, 10 not present in the source — kept as a gap intentionally.
// Entry 7 phone "07422 7049" was incomplete (9 digits); padded to 0742270049.
// Entries 5 and 11 share phone 0742383599 in the source — preserved as written.
// ────────────────────────────────────────────────────────────────────────────
const mosques = [
  { name: 'Masjid Ijaba',          location: 'MAWENI',           leader: '', phone: '0710558385' },
  { name: 'Masjid Rahma Akasha',   location: 'NYALI BEACH',      leader: '', phone: '0723948348' },
  { name: 'Masjid Faith Mkomani',  location: 'SHOW GROUND',      leader: '', phone: '0722316672' },
  { name: 'Masjid Noor',           location: 'SHAURI YAKO',      leader: '', phone: '0727736722' },
  { name: 'Masjid Saad',           location: 'NYALI POLICE',     leader: '', phone: '0742383599' },
  { name: 'Masjid Prayer Hadi',    location: 'NYALI',            leader: '', phone: '0799854096' },
  { name: 'Masjid Answar',         location: 'LINKS ROAD',       leader: '', phone: '0742270049' },
  { name: 'Masjid Taid',           location: 'LINKS ROAD',       leader: '', phone: '0742383599' },
  { name: 'Masjid Buraq',          location: 'NYALI BEACH',      leader: '', phone: '0707275071' },
  { name: 'Masjid Sara Fauq',      location: 'NDANI YA POLICE',  leader: '', phone: '0702149113' },
];

// ────────────────────────────────────────────────────────────────────────────
// CHURCHES — from Downloads/CHURCHES.pdf (4 sub-areas)
// ────────────────────────────────────────────────────────────────────────────
const maweni = [
  { name: 'SDA Maweni',                       leader: 'Pst. Elija Ogot',    phone: '0727048218' },
  { name: 'Calvary Church',                   leader: 'Pst. Ken',           phone: '0722165019' },
  { name: 'P.A.G Church',                     leader: 'Pst. Timothy',       phone: '0729525533' },
  { name: 'New Life Church',                  leader: 'R. Eddy Wekesa',     phone: '0712353250' },
  { name: 'I.F.C Church Maweni',              leader: 'Pst. Andrew Mwavasa',phone: '0726152606' },
  { name: 'A.C.K Church',                     leader: 'Rev. Juliet Olando', phone: '0722434630' },
  { name: 'New Revival Church',               leader: 'Rev. Susan Maliva',  phone: '0712871596' },
  { name: 'Roho Msanda Church',               leader: 'Benjamin Adino',     phone: '0727823715' },
  { name: 'Holy Pentecostal Church',          leader: 'Francis Opana',      phone: '0727787079' },
  { name: 'Roho Msanda Holy Ghost',           leader: 'Fred Odhiambo',      phone: '0724128307' },
  { name: 'Freedom of Worshipping Church',    leader: 'Rev. Protas Barasa', phone: '0714444708' },
  { name: 'Gospel Outreach Restoration',      leader: 'Pst. Gladys Wanjiru',phone: '0724593832' },
  { name: 'Mowar Israel Church',              leader: 'Daniel Oracha',      phone: '0722798822' },
  { name: 'Paramount Jesus Christ',           leader: 'P. Alfred Mtua',     phone: '0108779374' },
  { name: 'Valley of Miracle Church',         leader: 'P. Nzamba',          phone: '0725947999' },
  { name: 'P.A.G Maweni',                     leader: 'Robert Barasa',      phone: '0726882480' },
  { name: 'God Evarlasting Church',           leader: 'Walter Ayoma',       phone: '0726223055' },
  { name: 'Salvation Sellers International',  leader: 'Edmund Baraza',      phone: '0720643999' },
  { name: 'Back to Bible',                    leader: 'David Aura / Erick Bukach', phone: '' },
  { name: "God's Covenant Church",            leader: 'Moses Omondi',       phone: '' },
  { name: 'Holy Ghost Church',                leader: 'James Wambua',       phone: '' },
  { name: 'One Faith Church',                 leader: 'Evans Omondi',       phone: '' },
  { name: 'St. Paul Roho Msalaba',            leader: 'Samuel Ogonyo',      phone: '' },
  { name: 'East Africa Mowar Roho Church',    leader: '',                   phone: '' },
];

const shauriYako = [
  { name: 'Global Church',                    leader: 'Rev. Stephene Nyango', phone: '0724557309' },
  { name: 'Jesus Online Ministries',          leader: 'Rev. Kennedy / Thomas Madara', phone: '0723897387' },
  { name: 'Miracle Land Church',              leader: 'Fraco Ogada',        phone: '0720954076' },
  { name: 'St. Peter Yesu Neni',              leader: 'P. Kennedy',         phone: '0724494827' },
  { name: 'Free Methodist Church',            leader: 'Joshua Size',        phone: '0780736544' },
  { name: 'Shauri Moyo Pentecostal',          leader: 'Stephene Tuko',      phone: '0797264234' },
  { name: 'Mombasa Light House',              leader: 'John',               phone: '0702007892' },
  { name: 'Nyali Lutheran Church',            leader: '',                   phone: '' },
  { name: 'Alfa and Omega',                   leader: 'Sore Calistus',      phone: '0702007892' },
  { name: "True God's Blessing Church",       leader: 'Rose',               phone: '0721485875' },
  { name: 'Gospel of Peace',                  leader: 'Agrey Jirogo',       phone: '0722627285' },
  { name: 'AIC Shauri Yako',                  leader: 'Halisa Msumbi',      phone: '0720300645' },
  { name: 'Ulinzi Church',                    leader: 'Pst. Evalastus Kulabi', phone: '0712258260' },
];

const mnaziMoja = [
  { name: 'New Pentecostal International Mombasa', leader: 'Rev. Protus',   phone: '0720557406' },
  { name: 'Bethel Celebration Church International', leader: 'Bsp. Jacob',  phone: '0724586180' },
  { name: 'Shekemu Church',                   leader: 'Rev. Peter',         phone: '0734975930' },
  { name: 'Oasis of Revival Restoration Church', leader: 'Rev. Steve Ambare', phone: '0712262798' },
  { name: 'Get of Hollinness',                leader: 'Rev. Peterson',      phone: '0706339342' },
  { name: 'Hope Pentecostal Church',          leader: 'Rev. John',          phone: '0762650996' },
  { name: 'HTCA Kongowea Mwalimu Buda',       leader: 'Mwalimu Buda',       phone: '0722591943' },
  { name: 'Jesus M Line Ministry',            leader: 'Rev. Paulo',         phone: '' },
  { name: 'Africa Church Holy Spirit Maweni', leader: 'Rev. Josephat Shinanga', phone: '' },
  { name: 'Glory Tabernacle Church',          leader: 'GT Pastor Chege',    phone: '' },
  { name: 'Medical Ass. Church PEFA',         leader: 'Rev. Evans',         phone: '' },
  { name: 'Witnesses of Christ Church',       leader: 'Pst. Sharon',        phone: '' },
  { name: 'Christ Favor Church',              leader: 'Derick',             phone: '' },
  { name: 'Imani Baptist Church',             leader: 'Rev. Timothy',       phone: '' },
  { name: 'Salvation Army Church',            leader: 'Capt. Ragi',         phone: '' },
  { name: 'Elim Church',                      leader: 'Pst. Kipruto',       phone: '' },
  { name: 'African Devine Church',            leader: 'Rev. Busaka',        phone: '' },
  { name: 'Mt. Zion Worship Centre',          leader: 'Bshp George',        phone: '' },
];

const showground = [
  { name: 'P.A.G',                            leader: 'Rev. Opanda',        phone: '0724226978' },
];

const churches = [
  ...maweni.map((c)      => ({ ...c, location: 'MAWENI' })),
  ...shauriYako.map((c)  => ({ ...c, location: 'SHAURI YAKO' })),
  ...mnaziMoja.map((c)   => ({ ...c, location: 'MNAZI MOJA' })),
  ...showground.map((c)  => ({ ...c, location: 'SHOWGROUND' })),
];

// ────────────────────────────────────────────────────────────────────────────
// Build the coordinator-PDF style two-section sheet.
// ────────────────────────────────────────────────────────────────────────────
const aoa = [];
aoa.push(['', 'MKOMANI', '', '']);
aoa.push(['NAME OF MOSQUE', 'LOCATION', 'LEADERSHIP', 'TELEPHONE']);
for (const m of mosques) aoa.push([m.name, m.location, m.leader, m.phone]);
aoa.push(['', '', '', '']);
aoa.push(['', 'MKOMANI', '', '']);
aoa.push(['NAME OF CHURCH', 'LOCATION', 'LEADERSHIP', 'TELEPHONE']);
for (const c of churches) aoa.push([c.name, c.location, c.leader, c.phone]);

const ws = XLSX.utils.aoa_to_sheet(aoa);
ws['!cols'] = [{ wch: 44 }, { wch: 18 }, { wch: 34 }, { wch: 14 }];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Mkomani');

const outPath = path.join(__dirname, 'data', 'mkomani-sites.xlsx');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
XLSX.writeFile(wb, outPath);

console.log('OK — wrote ' + outPath);
console.log('  Mosques: ' + mosques.length);
console.log('  Churches: ' + churches.length);
console.log('    Maweni: ' + maweni.length);
console.log('    Shauri Yako: ' + shauriYako.length);
console.log('    Mnazi Moja: ' + mnaziMoja.length);
console.log('    Showground: ' + showground.length);
console.log('  Total: ' + (mosques.length + churches.length));
