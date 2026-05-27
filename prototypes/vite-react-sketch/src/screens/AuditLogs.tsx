import React from 'react';
import { useCampaign } from '../context/CampaignContext';
import { ShieldAlert, Info } from 'lucide-react';

export const AuditLogsScreen: React.FC = () => {
  const { language, t, activeRole, auditLogs } = useCampaign();

  // Audit logs are restricted to Coordinator level and above
  // Canvasser and Agent get blocked (DPA Compliance verification)
  const isAuthorized = activeRole === 'candidate' || activeRole === 'manager' || activeRole === 'strategist' || activeRole === 'coordinator';

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-wide text-brand-textActive flex items-center gap-2">
          {t('nav.audit')}
        </h2>
        <p className="text-xs text-brand-textMuted font-medium">
          DPA-compliant, append-only security logs recording authentication, voter lookups, exports, and RLS gates.
        </p>
      </div>

      {!isAuthorized ? (
        <div className="glass-panel p-8 rounded-xl flex flex-col items-center justify-center text-center space-y-4 max-w-2xl mx-auto mt-10">
          <ShieldAlert className="w-12 h-12 text-brand-danger animate-bounce" />
          <div className="space-y-1.5">
            <h3 className="text-md font-bold text-brand-textActive uppercase tracking-wider">
              Access Gated by Security Policies
            </h3>
            <p className="text-xs text-brand-textMuted leading-relaxed max-w-md mx-auto">
              Under Section 8.2 (COMP-007) and DPA 2019 guidelines, audit logs are restricted to candidate and campaign coordination roles. Your active role does not possess read authorization.
            </p>
          </div>
          <div className="text-[10px] text-brand-danger bg-brand-danger/10 border border-brand-danger/20 font-bold px-3 py-1.5 rounded-full uppercase">
            REJECTED — GATED BY RLS DATABASE POLICIES
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Informational banner */}
          <div className="p-4 bg-brand-violet/5 border border-brand-border rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-brand-violet shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h4 className="font-bold text-brand-textActive uppercase tracking-wider text-[10px]">
                DPA Security Compliance Statement (COMP-007 / COMP-010)
              </h4>
              <p className="text-brand-textMuted leading-relaxed">
                Every query on committed supporters contact details and voter lookup operations triggers an automatic audit trace containing the user ID, timestamp, source IP, and queried record IDs. Logs are stored in write-once, append-only tables with a 7-year retention constraint.
              </p>
            </div>
          </div>

          {/* Logs Table */}
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-brand-border/60 text-brand-textMuted uppercase text-[9px] tracking-wider font-bold">
                    <th className="pb-2.5">Timestamp (UTC)</th>
                    <th className="pb-2.5">User (Actor)</th>
                    <th className="pb-2.5">Role</th>
                    <th className="pb-2.5">Action</th>
                    <th className="pb-2.5">Entity Type</th>
                    <th className="pb-2.5">IP Address</th>
                    <th className="pb-2.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/40 font-semibold text-brand-textActive font-mono">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-[#12131C] transition-colors">
                      <td className="py-3 pr-2 text-brand-textMuted">{log.timestamp}</td>
                      <td className="py-3 pr-2 font-bold font-sans">{log.actorName}</td>
                      <td className="py-3 pr-2 font-sans text-brand-violet font-semibold uppercase text-[10px] tracking-wider">{log.role}</td>
                      <td className="py-3 pr-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold border ${
                          log.action.includes('ERASE') || log.action.includes('WITHDRAW') ? 'bg-brand-danger/10 text-brand-danger border-brand-danger/20' :
                          log.action.includes('LOGIN') ? 'bg-brand-cyan/15 text-brand-cyan border-brand-cyan/20' :
                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 pr-2 capitalize font-sans">{log.entityType}</td>
                      <td className="py-3 pr-2 text-brand-textMuted">{log.ipAddress}</td>
                      <td className="py-3 text-right max-w-xs truncate text-[10px] text-brand-textMuted font-sans italic" title={log.beforeValue || log.afterValue || ''}>
                        {log.afterValue || log.beforeValue || 'Success'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default AuditLogsScreen;
