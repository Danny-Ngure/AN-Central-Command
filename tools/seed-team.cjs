// Seed the campaign organizational structure into the people table.
//
//   3 super-users:    Alfayo Nelson, Benson Imoli, Dan Ngure
//   6 executive/spec: Justine Katana, Cavins Omino, Arnold Baya,
//                      Irene Mkamburi, Javas Tindi, Ryan Siriba
//   10 ward team:     5 ward coordinators + 5 assistants
//                      (Frere Town has 2 assistants; Arnold doubles as
//                       Asst Campaign Director and Kadzandani assistant — captured
//                       in his title for display)
//
// Run with the dev DB up:
//   node tools/seed-team.cjs
//
// Idempotent: UPSERTs by phone. Re-running updates name/title/role/wardId.

const path = require('path');
const fs = require('fs');
const dotenv = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'dotenv@16.4.7', 'node_modules', 'dotenv'));
const postgres = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres'));

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Check apps/web/.env.local.');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false });

// Fixed ward IDs from the seed.
const WARD_IDS = {
  Frere_Town:      '22222222-0000-4000-8000-000000000004',
  Kadzandani:      '22222222-0000-4000-8000-000000000001',
  Kongowea:        '22222222-0000-4000-8000-000000000002',
  Mkomani:         '22222222-0000-4000-8000-000000000003',
  Ziwa_La_Ngombe:  '22222222-0000-4000-8000-000000000005',
};

const team = [
  // ─── Executive Leadership ─────────────────────────────────────────────
  { phone: '+254700000001', fullName: 'Alfayo Nelson',  role: 'candidate',                title: 'Patron / Aspirant',                 wardId: null,                    superUser: true  },
  { phone: '+254700000003', fullName: 'Benson Imoli',   role: 'chief_strategist',         title: 'CEO / Chief Campaign Strategist',   wardId: null,                    superUser: true  },

  // ─── Directorate of Operations & Field Coordination ───────────────────
  { phone: '+254700000020', fullName: 'Justine Katana', role: 'constituency_coordinator', title: 'Head of Protocol and Supervision',  wardId: null                                       },
  { phone: '+254700000021', fullName: 'Cavins Omino',   role: 'campaign_manager',         title: 'Director of Programs',              wardId: null                                       },
  { phone: '+254700000022', fullName: 'Arnold Baya',    role: 'campaign_manager',         title: 'Assistant Campaign Director · also Asst. Ward Rep for Kadzandani', wardId: null    },

  // ─── Specialized Departments ──────────────────────────────────────────
  { phone: '+254700000023', fullName: 'Irene Mkamburi', role: 'comms_head',               title: 'Events & Activity Planning Lead',   wardId: null                                       },
  { phone: '+254700000013', fullName: 'Dan Ngure',      role: 'tech_lead',                title: 'Tech & Media Lead',                 wardId: null,                    superUser: true  },
  { phone: '+254700000024', fullName: 'Javas Tindi',    role: 'media_head',               title: 'Media Team',                        wardId: null                                       },
  { phone: '+254700000025', fullName: 'Ryan Siriba',    role: 'media_head',               title: 'Media Team',                        wardId: null                                       },

  // ─── Frere Town ───────────────────────────────────────────────────────
  { phone: '+254700000030', fullName: 'Nafisa Kalondu', role: 'ward_coordinator',           title: 'Ward Representative',           wardId: WARD_IDS.Frere_Town      },
  { phone: '+254700000031', fullName: 'Wadede Hamisi',  role: 'assistant_ward_coordinator', title: 'Assistant Ward Representative', wardId: WARD_IDS.Frere_Town      },
  { phone: '+254700000032', fullName: 'Umi Njeri',      role: 'assistant_ward_coordinator', title: 'Assistant Ward Representative', wardId: WARD_IDS.Frere_Town      },

  // ─── Kadzandani ───────────────────────────────────────────────────────
  { phone: '+254700000040', fullName: 'Kofa Mohammed',  role: 'ward_coordinator',           title: 'Ward Representative',           wardId: WARD_IDS.Kadzandani      },
  // Arnold Baya (above) is also the Kadzandani Asst Ward Rep — captured in his title.

  // ─── Ziwa La Ng'ombe ──────────────────────────────────────────────────
  { phone: '+254700000050', fullName: 'Taura',          role: 'ward_coordinator',           title: 'Ward Representative',           wardId: WARD_IDS.Ziwa_La_Ngombe  },
  { phone: '+254700000051', fullName: 'Damah',          role: 'assistant_ward_coordinator', title: 'Assistant Ward Representative', wardId: WARD_IDS.Ziwa_La_Ngombe  },

  // ─── Mkomani ──────────────────────────────────────────────────────────
  { phone: '+254700000060', fullName: 'Lucy Ogutu',     role: 'ward_coordinator',           title: 'Ward Representative',           wardId: WARD_IDS.Mkomani         },
  { phone: '+254700000061', fullName: 'Sammy Otega',    role: 'assistant_ward_coordinator', title: 'Assistant Ward Representative', wardId: WARD_IDS.Mkomani         },

  // ─── Kongowea ─────────────────────────────────────────────────────────
  { phone: '+254700000070', fullName: 'Salma Khalef',   role: 'ward_coordinator',           title: 'Ward Representative',           wardId: WARD_IDS.Kongowea        },
  { phone: '+254700000071', fullName: 'Jilo Mohammed',  role: 'assistant_ward_coordinator', title: 'Assistant Ward Representative', wardId: WARD_IDS.Kongowea        },
];

(async () => {
  try {
    let inserted = 0, updated = 0;
    for (const p of team) {
      const result = await sql`
        INSERT INTO people (phone, full_name, role, title, ward_id, active)
        VALUES (${p.phone}, ${p.fullName}, ${p.role}, ${p.title}, ${p.wardId}, true)
        ON CONFLICT (phone) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            role      = EXCLUDED.role,
            title     = EXCLUDED.title,
            ward_id   = EXCLUDED.ward_id,
            updated_at = now()
        RETURNING (xmax = 0) AS inserted
      `;
      if (result[0]?.inserted) inserted++;
      else updated++;
      console.log('  ' + (result[0]?.inserted ? '+' : '~') + ' ' + p.fullName + ' (' + p.role + (p.superUser ? ' ★ super-user' : '') + ')');
    }
    console.log('');
    console.log('Done. Inserted: ' + inserted + ', Updated: ' + updated + ', Total: ' + team.length);
    console.log('Super-users with full access: Alfayo Nelson, Benson Imoli, Dan Ngure');
    console.log('  (their roles candidate / chief_strategist / tech_lead are already in PRIVILEGED_ROLES)');
  } catch (e) {
    console.error('SEED FAILED:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();
