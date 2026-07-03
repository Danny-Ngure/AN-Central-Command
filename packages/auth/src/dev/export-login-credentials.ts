// IMPORTANT: env-bootstrap first so dotenv runs before @an/db reads DATABASE_URL.
import './env-bootstrap';

import { db, people, wards } from '@an/db';
import { isNull } from 'drizzle-orm';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Exports every user's login details to a print-ready HTML file (open it and use
// "Print → Save as PDF"). Matches the credential scheme set by reset-passwords-to-id:
//   • Dan Ngure  → login "ADMIN001", password "ADMIN001"
//   • everyone else → login = phone (+254…), password = National ID number
//   • no National ID on file → password = the fallback (still able to log in)
//
// CONFIDENTIAL — this file contains everyone's password. Handle accordingly.

const ADMIN_NAMES = ['Alfayo Nelson', 'Benson Imoli', 'Dan Ngure', 'Irene Mkamburi'];
const ADMIN_LOGIN = 'ADMIN001';
const FALLBACK_PASSWORD = 'devpassword123!';

const ROLE_LABEL: Record<string, string> = {
  candidate: 'Aspirant', campaign_manager: 'Campaign Manager', chief_strategist: 'Chief Strategist',
  constituency_coordinator: 'Constituency Coordinator', ward_coordinator: 'Ward Representative',
  assistant_ward_coordinator: 'Assistant Ward Rep', polling_station_lead: 'Polling Station Lead',
  polling_agent: 'Polling Agent', canvasser: 'Canvasser', influence_liaison: 'Influence Liaison',
  media_head: 'Media Head', comms_head: 'Comms Head', patron_ceo: 'Patron / CEO', tech_lead: 'Tech Lead',
  finance_lead: 'Finance Lead',
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function main() {
  const wardRows = await db.select({ id: wards.id, name: wards.name }).from(wards);
  const wardName = new Map(wardRows.map((w) => [w.id, w.name]));

  const rows = await db
    .select({ fullName: people.fullName, role: people.role, phone: people.phone, wardId: people.wardId, nationalId: people.nationalId })
    .from(people)
    .where(isNull(people.deletedAt));

  type Cred = { name: string; role: string; ward: string; login: string; password: string; admin: boolean };
  const creds: Cred[] = rows.map((p) => {
    const isAdmin = ADMIN_NAMES.includes(p.fullName);
    const isDan = p.fullName === 'Dan Ngure';
    const nid = (p.nationalId ?? '').trim();
    return {
      name: p.fullName,
      role: ROLE_LABEL[p.role] ?? p.role,
      ward: p.wardId ? wardName.get(p.wardId) ?? '—' : '—',
      login: isDan ? ADMIN_LOGIN : (p.phone || '—'),
      password: isDan ? ADMIN_LOGIN : nid.length > 0 ? nid : `${FALLBACK_PASSWORD} (no ID on file)`,
      admin: isAdmin,
    };
  });

  // Admins first (in the fixed order), then everyone else alphabetically.
  const adminOrder = (n: string) => ADMIN_NAMES.indexOf(n);
  const admins = creds.filter((c) => c.admin).sort((a, b) => adminOrder(a.name) - adminOrder(b.name));
  const others = creds.filter((c) => !c.admin).sort((a, b) => a.name.localeCompare(b.name));

  const rowHtml = (c: Cred, i: number) => `
    <tr${c.admin ? ' class="admin"' : ''}>
      <td class="num">${i + 1}</td>
      <td>${esc(c.name)}${c.admin ? ' <span class="badge">ADMIN</span>' : ''}</td>
      <td>${esc(c.role)}</td>
      <td>${esc(c.ward)}</td>
      <td class="mono">${esc(c.login)}</td>
      <td class="mono">${esc(c.password)}</td>
    </tr>`;

  let n = 0;
  const body = [
    `<tr class="section"><td colspan="6">ADMINISTRATORS (${admins.length})</td></tr>`,
    ...admins.map((c) => rowHtml(c, n++)),
    `<tr class="section"><td colspan="6">ALL OTHER USERS (${others.length})</td></tr>`,
    ...others.map((c) => rowHtml(c, n++)),
  ].join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Login Credentials</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, sans-serif; color: #212120; }
  h1 { color: #025e73; margin: 0 0 2px; font-size: 20px; }
  .sub { color: #777; font-size: 12px; margin: 0 0 4px; }
  .warn { color: #b4530a; font-weight: bold; font-size: 12px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #025e73; color: #fff; text-align: left; padding: 7px 9px; }
  td { padding: 6px 9px; border-bottom: 1px solid #e2ddd3; }
  .num { color: #999; width: 26px; }
  .mono { font-family: 'Courier New', monospace; font-weight: bold; }
  .admin { background: #fdf0e6; }
  .section td { background: #f4f1eb; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #b4530a; font-size: 11px; }
  .badge { background: #ff6600; color: #fff; font-size: 9px; font-weight: bold; padding: 1px 5px; border-radius: 6px; }
</style></head>
<body>
  <h1>Login Credentials — Alfayo Nelson Central Command</h1>
  <p class="sub">Generated ${new Date().toLocaleString('en-KE')} · ${creds.length} users · login = phone (+254…) · password = National ID</p>
  <p class="warn">CONFIDENTIAL — contains every user's password. Print, distribute securely, then delete this file.</p>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Role</th><th>Ward</th><th>Login (phone)</th><th>Password</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <p class="sub" style="margin-top:12px">Everyone can change their password at /account/password. Users with no National ID on file use the fallback and can still sign in.</p>
</body></html>`;

  const out = join(process.cwd(), 'login-credentials.html');
  writeFileSync(out, html, 'utf8');
  console.log(`✓ Wrote ${creds.length} credentials to ${out}`);
  console.log('  Open it in a browser and use Print → Save as PDF.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to export credentials:', err);
    process.exit(1);
  });
