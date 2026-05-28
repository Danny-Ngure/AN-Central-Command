import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  activities,
  committedSupporters,
  incidents,
  people,
  villageIssues,
  wards,
} from '@an/db';
import { ok, withAuth, withRlsTx } from '@/lib/api';

export const runtime = 'nodejs';

// GET /api/dashboard/summary
//
// Returns the rolled-up data the dashboard cards display. All queries are RLS-scoped
// through withRlsTx → setRequestContext → app_user role. Leadership sees the whole
// constituency; ward-scoped users see their ward; canvassers see almost nothing.
//
// Shape:
//   {
//     wards:       [{ id, name, registeredVoters, coveragePercent, topIssueCategory }],
//     kpis: {
//       registeredVoters, criticalIssues, activeIncidents,
//       committedSupporters, activeStaff, recentActivities
//     },
//     recentActivities: [{ id, title, type, scheduledAt, wardId }],
//   }

export const GET = withAuth(async (_req, { claims }) => {
  const summary = await withRlsTx(claims, async (tx) => {
    // Ward list — RLS filters: leadership/oversight see all; ward-scoped see all (read
    // policies on geography tables are open). The application could further filter on
    // the client, but the data set is small (5 rows) so we return everything.
    const wardRows = await tx
      .select({
        id: wards.id,
        name: wards.name,
        registeredVoters: wards.registeredVoters,
        coveragePercent: wards.coveragePercent,
        topIssueCategory: wards.topIssueCategory,
      })
      .from(wards);

    // KPIs.
    const totalVoters = wardRows.reduce((sum, w) => sum + (w.registeredVoters ?? 0), 0);

    const [{ value: criticalIssues }] = await tx
      .select({ value: count() })
      .from(villageIssues)
      .where(and(eq(villageIssues.severity, 'critical'), inArray(villageIssues.status, ['reported', 'investigating'])));

    const [{ value: activeIncidents }] = await tx
      .select({ value: count() })
      .from(incidents)
      .where(inArray(incidents.status, ['reported', 'investigating', 'escalated']));

    const [{ value: supporterCount }] = await tx
      .select({ value: count() })
      .from(committedSupporters)
      .where(eq(committedSupporters.withdrawn, false));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [{ value: activeStaff }] = await tx
      .select({ value: count() })
      .from(people)
      .where(and(eq(people.active, true), gte(people.lastActiveAt, sevenDaysAgo)));

    // Recent + upcoming activities (next 5 by scheduledAt asc starting today).
    const today = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const recentActivityRows = await tx
      .select({
        id: activities.id,
        title: activities.title,
        type: activities.type,
        scheduledAt: activities.scheduledAt,
        wardId: activities.wardId,
        status: activities.status,
      })
      .from(activities)
      .where(gte(activities.scheduledAt, today))
      .orderBy(activities.scheduledAt)
      .limit(5);

    return {
      wards: wardRows,
      kpis: {
        registeredVoters: totalVoters,
        criticalIssues: Number(criticalIssues),
        activeIncidents: Number(activeIncidents),
        committedSupporters: Number(supporterCount),
        activeStaff: Number(activeStaff),
        recentActivities: recentActivityRows.length,
      },
      recentActivities: recentActivityRows.map((a) => ({
        ...a,
        scheduledAt: a.scheduledAt.toISOString(),
      })),
    };
  });

  return ok(summary);
});
