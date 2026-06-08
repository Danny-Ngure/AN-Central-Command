// Generate tools/data/kongowea-sites.xlsx in the coordinator-PDF format.
// Source: Downloads/Kongowea Ward Churches and Mosques.pdf

const path = require('path');
const fs = require('fs');
const XLSX = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'xlsx@0.18.5', 'node_modules', 'xlsx'));

// Phones already normalised to 0XXXXXXXXX (removed +254 prefix + spaces).
const churches = [
  { name: 'Tumaini Roho Na Kweli Church',          location: 'KONGOWEA',          leader: 'Bishop Imelda Sebi',    phone: '0702998910' },
  { name: 'Overflow of Love Church',               location: 'KONGOWEA',          leader: '',                       phone: '0722444971' },
  { name: 'PEFA Church',                           location: 'KONGOWEA',          leader: 'Pst John',               phone: '0724565686' },
  { name: 'Methodist Church',                      location: 'KONGOWEA',          leader: 'Haron Kyalo',            phone: '0734611406' },
  { name: 'Glorious River Church',                 location: 'KONGOWEA',          leader: 'Bishop Ekombe',          phone: '0727667925' },
  { name: 'AIC Kongowea',                          location: 'KENGELENI',         leader: 'Raphael Munyasa',        phone: '0720678711' },
  { name: 'Overflow of Love Ministry',             location: 'KONGOWEA MAKUTANO', leader: 'Pst. Atenya',            phone: '0722444971' },
  { name: 'Revival Church',                        location: 'JERUSALEM',         leader: 'Pst Rodgers Bakari',     phone: '0711990382' },
  { name: 'Friends Church',                        location: 'JOCHAM',            leader: '',                       phone: '0724561242' },
  { name: 'Curtis Baptist Church',                 location: 'KONGOWEA',          leader: 'Rev. Bosco Aketch',      phone: '0722246146' },
  { name: 'Our Lady of Fatima',                    location: 'KONGOWEA',          leader: '',                       phone: '0796095910' },
  { name: 'Kongowea Catholic',                     location: 'KONGOWEA',          leader: 'Pst. Hannington',        phone: '' },
  { name: 'Power Of The Word Church',              location: 'UWANJA WA MBUZI',   leader: 'Betty Mwakio',           phone: '0720081183' },
  { name: 'God Covenant Ministry Kisauni',         location: 'MAWENI BAR',        leader: 'Pastor Lukeman',         phone: '0727707464' },
  { name: 'Pentecostal Church',                    location: 'KONGOWEA',          leader: 'Rev. Tom Mboya',         phone: '' },
  { name: 'Friends Church Kongowea',               location: 'KWA CHIEF',         leader: '',                       phone: '0724561242' },
  { name: 'Safina Church Kongowea',                location: 'MWAMBA ACADEMY',    leader: 'Pastor Joseph',          phone: '0710454287' },
  { name: 'Harambee African Prophet Church',       location: 'KONGOWEA',          leader: 'Pst Charles Wafula',     phone: '0725708125' },
  { name: 'Global Methodist Church',               location: 'MWAMBA ACADEMY',    leader: 'Rev. Stephen / Rev. Sammy', phone: '0720764273' },
  { name: 'Jesus Gospel Miracle Church',           location: 'MLIMANI BAR',       leader: 'Bishop Josephine',       phone: '0796238385' },
  { name: 'Spring Holiness and Worship Centre',    location: 'MLIMANI BAR',       leader: 'Wandera',                phone: '0112348084' },
  { name: 'Resurrection Church',                   location: 'MLIMANI BAR',       leader: 'Pastor Charles',         phone: '0724750742' },
  { name: 'Gospel Tabernacle Church',              location: 'AFRICAN BAR',       leader: 'Pastor Kirima',          phone: '0724764473' },
  { name: 'Matendo Spiritual Church',              location: 'AFRICAN BAR',       leader: 'Rev. Jane / Pastor Christopher', phone: '0722555704' },
  { name: 'End Time Gathering Church',             location: 'AFRICAN BAR',       leader: 'Pastor Nelson',          phone: '0705773584' },
  { name: 'ADC Kongowea Church',                   location: 'AFRICAN BAR',       leader: 'Pst Julius',             phone: '0723262262' },
  { name: 'Eagles Church',                         location: 'HARAMBEE',          leader: 'Pst Joseph',             phone: '0727988136' },
  { name: 'IPC Kongowea',                          location: "CHIEF'S GATE",      leader: 'Rev. Amalemba',          phone: '0707118470' },
  { name: 'PAG Kisauni',                           location: 'FLORIST',           leader: 'Secretary Wafula',       phone: '0721421200' },
  { name: 'Bethel House Of Prayer',                location: 'FLORIST',           leader: 'Bishop David',           phone: '0752365540' },
  { name: 'Jesus Power & Repentance Church',       location: 'FLORIST',           leader: 'Mwakesi',                phone: '0757701870' },
  { name: 'Kisauni PAG',                           location: 'HARAMBEE',          leader: '',                       phone: '0722994970' },
  { name: 'Jesus Deliverance Church',              location: 'HARAMBEE',          leader: '',                       phone: '0738123119' },
  { name: 'PEFA Cathedral',                        location: 'KARAMA',            leader: '',                       phone: '0745498031' },
  { name: 'The Lutheran Orthodox Church',          location: 'KONGOWEA',          leader: 'Rev. Samuel Munabo',     phone: '0726212852' },
  { name: 'Global Vision Church',                  location: 'KONGOWEA',          leader: '',                       phone: '' },
  { name: 'Glory of Christ',                       location: 'KONGOWEA',          leader: 'Pst Titus Munuve',       phone: '0745114911' },
  { name: 'Church Mt. Kenya',                      location: 'MT. KENYA',         leader: 'Barack Macheso',         phone: '0706016527' },
];

const mosques = [
  { name: 'Haram Msikiti',  location: 'TOGO',     leader: 'Ustadhi Kunguru',         phone: '0786740208' },
  { name: 'Msikiti Tauba',  location: 'KONGOWEA', leader: 'Ostadhi Bahati',          phone: '0716118006' },
  { name: 'Masjid Buraaq',  location: 'KONGOWEA', leader: 'Mzee Abdallah',           phone: '0725965724' },
  { name: 'Masjid Mullah',  location: 'KONGOWEA', leader: 'Sheikh Abu Umar Kassim',  phone: '0736964041' },
  { name: 'Masjid Rahma',   location: 'KONGOWEA', leader: 'Ustadh Abubakar',         phone: '0721837551' },
  { name: 'Masjid Bahrain', location: 'KONGOWEA', leader: 'Ustadh Salim',            phone: '0728451999' },
  { name: 'Twaif Musa',     location: 'KONGOWEA', leader: 'Mwinyikombo',             phone: '0727638810' },
  { name: 'Qadiria',        location: 'KONGOWEA', leader: 'Ustadha Mahmoud',         phone: '0702654347' },
];

const aoa = [];
aoa.push(['', 'KONGOWEA', '', '']);
aoa.push(['NAME OF MOSQUE', 'LOCATION', 'LEADERSHIP', 'TELEPHONE']);
for (const m of mosques) aoa.push([m.name, m.location, m.leader, m.phone]);
aoa.push(['', '', '', '']);
aoa.push(['', 'KONGOWEA', '', '']);
aoa.push(['NAME OF CHURCH', 'LOCATION', 'LEADERSHIP', 'TELEPHONE']);
for (const c of churches) aoa.push([c.name, c.location, c.leader, c.phone]);

const ws = XLSX.utils.aoa_to_sheet(aoa);
ws['!cols'] = [{ wch: 40 }, { wch: 22 }, { wch: 34 }, { wch: 14 }];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Kongowea');

const outPath = path.join(__dirname, 'data', 'kongowea-sites.xlsx');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
XLSX.writeFile(wb, outPath);

console.log('OK — wrote ' + outPath);
console.log('  Mosques: ' + mosques.length);
console.log('  Churches: ' + churches.length);
console.log('  Total rows: ' + (mosques.length + churches.length));
