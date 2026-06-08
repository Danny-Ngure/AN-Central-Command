// Generate tools/data/freretown-sites.xlsx in the coordinator-PDF format
// that the smart sites parser auto-recognises.
//
// Run from monorepo root:
//   node tools/generate-freretown-sites.cjs

const path = require('path');
const fs = require('fs');
const XLSX = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'xlsx@0.18.5', 'node_modules', 'xlsx'));

const mosques = [
  { name: 'Masjid Marhab',       location: 'BAKARANI VILLAGE',  leader: 'Ustadh Ramadhan',  phone: '0727779630' },
  { name: 'Masjid Hairati',      location: 'BAKARANI VILLAGE',  leader: 'Mzee Mwinyi',      phone: '0723521743' },
  { name: 'Masjid Asale',        location: 'BAKARANI VILLAGE',  leader: 'Said Kofa',        phone: '0797656159' },
  { name: 'Masjid Answer Sunna', location: 'BAKARANI VILLAGE',  leader: 'Ahmed Karafuu',    phone: '' },
  { name: 'Masjid Raudwa',       location: 'BAKARANI VILLAGE',  leader: 'Sheikh Samir',     phone: '0724341350' },
  { name: 'Masjid Raudhwa',      location: 'MBUNGONI VILLAGE',  leader: 'Abubakar Abdalla', phone: '0792160041' },
  { name: 'Masjid Raudha',       location: 'HADIJA VILLAGE',    leader: 'Fauz Abubakar',    phone: '0710596238' },
  { name: 'Masjid Munnawar',     location: 'MAJENGO MAPYA',     leader: 'Yusuf',            phone: '0759951525' },
  { name: 'Masjid Noor',         location: 'MAJENGO MAPYA',     leader: '',                 phone: '' },
  { name: 'Masjid Swalihina',    location: 'MAJENGO MAPYA',     leader: 'Mohamed Ali',      phone: '0721477176' },
  { name: 'Masjid Munawar',      location: 'KADIRIA VILLAGE',   leader: 'Juma Ali',         phone: '0748855813' },
  { name: 'Masjid Kadiria',      location: 'KADIRIA VILLAGE',   leader: '',                 phone: '' },
  { name: 'Masjid Tauhid',       location: 'SARAJEVO VILLAGE',  leader: 'Ismael Salim',     phone: '0729851374' },
  { name: 'Masjid Aman',         location: 'BARSHEBA VILLAGE',  leader: 'Mahmoud',          phone: '0722665582' },
  { name: 'Masjid Ulheir',       location: 'SHELEMBA VILLAGE',  leader: 'Ismail Haidar',    phone: '0746758307' },
  { name: 'Masjid Sofia',        location: 'HAKIKA VILLAGE',    leader: 'Haidar Malawi',    phone: '0728102861' },
  { name: 'Masjid Rahma',        location: 'FRERETOWN',         leader: 'Hamisi Shambi',    phone: '0734899930' },
];

const churches = [
  { name: 'Soul Harvest Ministries',         location: 'HADIJA',           leader: 'Pastor Mwanza',              phone: '0722596890' },
  { name: 'S.D.A Hadija Church',             location: 'HADIJA',           leader: 'Pastor Rose Bela',           phone: '0729869863' },
  { name: 'Nomia Church',                    location: 'HADIJA',           leader: 'Pastor Evernce Arika',       phone: '0707834192' },
  { name: 'Elim Evangelism',                 location: 'MBUNGONI VILLAGE', leader: 'Pastor Hannington Ulugwayo', phone: '0722831998' },
  { name: 'Victoria B. Church',              location: 'MBUNGONI VILLAGE', leader: 'Pastor Randu Kithi',         phone: '0722737647' },
  { name: 'Royall Sence Church',             location: 'MBUNGONI VILLAGE', leader: 'Pastor John Mwaringa',       phone: '0711281017' },
  { name: 'ACK St. Philip',                  location: 'MBUNGONI VILLAGE', leader: 'Pastor Agnes Apondo',        phone: '0722700160' },
  { name: 'JBL Apostol Ministries',          location: 'MBUNGONI VILLAGE', leader: 'Pastor Kipkorir Marinade',   phone: '0720227220' },
  { name: 'The Ark Of Glory',                location: 'MBUNGONI VILLAGE', leader: '',                           phone: '' },
  { name: 'Word Of Grace',                   location: 'MBUNGONI VILLAGE', leader: 'Pastor Kamwana',             phone: '0725933130' },
  { name: 'International Gospel',            location: 'KATISHA VILLAGE',  leader: 'Pastor David Musyoka',       phone: '0790016255' },
  { name: 'Apostol Church',                  location: 'BOMBOLULU VILLAGE',leader: 'Pastor Grece Madhenge',      phone: '0721669374' },
  { name: 'PEFA Church',                     location: 'BOMBOLULU VILLAGE',leader: 'Pastor Mercy Nyambu',        phone: '0726961241' },
  { name: 'Deliverance Church',              location: 'HAKIKA',           leader: 'Pastor Rono',                phone: '0720901007' },
  { name: 'S.D.A Mgongeni',                  location: 'HAKIKA',           leader: 'Pastor Omondi',              phone: '0721690148' },
  { name: 'Kingdom Worship Church',          location: 'FRERETOWN',        leader: 'Pastor James Kombe',         phone: '0722400247' },
  { name: 'Free Methodist Church',           location: 'FRERETOWN',        leader: 'Pastor Daniel Chanzu',       phone: '0721648054' },
  { name: 'Nyota Deliverance',               location: 'FRERETOWN',        leader: 'Pastor Joshua Mwasumbuko',   phone: '0705835599' },
  { name: 'The Generation Praise Worship',   location: 'FRERETOWN',        leader: 'Pastor Kusono',              phone: '0719579138' },
  { name: 'S.D.A Freretown',                 location: 'FRERETOWN',        leader: 'Pastor Dickson Kinara',      phone: '0724539720' },
  { name: 'New Testament',                   location: 'FRERETOWN',        leader: 'Pastor Kaingu',              phone: '0736065720' },
  { name: 'Power Of The Word',               location: 'FRERETOWN',        leader: 'Pastor John',                phone: '0723975299' },
  { name: 'P.I.G Malaleo Church',            location: 'FRERETOWN',        leader: 'Pastor Angelin Novega',      phone: '0703283079' },
  { name: 'African Brotherhood',             location: 'FRERETOWN',        leader: 'Pastor Miriam Kimya',        phone: '0707748993' },
  { name: 'Power Of Faith',                  location: 'FRERETOWN',        leader: '',                           phone: '' },
];

const aoa = [];
aoa.push(['', 'FRERE TOWN', '', '']);
aoa.push(['NAME OF MOSQUE', 'LOCATION', 'LEADERSHIP', 'TELEPHONE']);
for (const m of mosques) aoa.push([m.name, m.location, m.leader, m.phone]);
aoa.push(['', '', '', '']);
aoa.push(['', 'FRERE TOWN', '', '']);
aoa.push(['NAME OF CHURCH', 'LOCATION', 'LEADERSHIP', 'TELEPHONE']);
for (const c of churches) aoa.push([c.name, c.location, c.leader, c.phone]);

const ws = XLSX.utils.aoa_to_sheet(aoa);
ws['!cols'] = [{ wch: 36 }, { wch: 24 }, { wch: 28 }, { wch: 14 }];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Frere Town');

const outPath = path.join(__dirname, 'data', 'freretown-sites.xlsx');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
XLSX.writeFile(wb, outPath);

console.log('OK — wrote ' + outPath);
console.log('  Mosques: ' + mosques.length);
console.log('  Churches: ' + churches.length);
console.log('  Total rows: ' + (mosques.length + churches.length));
