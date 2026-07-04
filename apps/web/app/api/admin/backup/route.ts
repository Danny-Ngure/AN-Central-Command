import { spawn } from 'node:child_process';
import { getServerAuth } from '@/lib/server-auth';
import { isSuperAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/backup  → downloads a fresh Postgres dump of the whole database.
//
// SUPER ADMIN (Dan) ONLY — the dump contains voter PII and password hashes, so it is
// never a public link. Runs pg_dump inside the Docker container and streams the bytes
// back as a file download. Default = compressed custom format (.dump, restore with
// pg_restore); ?format=sql = plain SQL (larger, restore with psql).

const CONTAINER = 'alfayo-postgres';
const DB = 'alfayo_dev';
const USER = 'alfayo';

export async function GET(req: Request) {
  const claims = await getServerAuth();
  if (!claims) return new Response('Authentication required', { status: 401 });
  if (!(await isSuperAdmin(claims.sub))) {
    return new Response('Only the Super Admin (Dan) can download database backups.', { status: 403 });
  }

  const plain = new URL(req.url).searchParams.get('format') === 'sql';
  const fmtArgs = plain ? [] : ['-Fc'];
  const date = new Date().toISOString().slice(0, 10);
  const ext = plain ? 'sql' : 'dump';
  const filename = `alfayo_dev_${date}.${ext}`;

  const args = ['exec', CONTAINER, 'pg_dump', '-U', USER, '-d', DB, '--no-owner', '--no-privileges', ...fmtArgs];

  // Buffer the dump (compressed dump is ~15 MB) so we can return a clean error status
  // if pg_dump / docker fails, rather than a truncated download.
  const chunks: Buffer[] = [];
  let stderr = '';
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('docker', args, { windowsHide: true });
      child.on('error', reject); // e.g. docker not on PATH
      child.stdout.on('data', (c: Buffer) => chunks.push(c));
      child.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr || `pg_dump exited ${code}`))));
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Backup failed: ${msg}`, { status: 500 });
  }

  const body = Buffer.concat(chunks);
  return new Response(body, {
    headers: {
      'Content-Type': plain ? 'application/sql' : 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(body.length),
      'Cache-Control': 'no-store',
    },
  });
}
