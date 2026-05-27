import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { ShieldAlert, Heart, Calendar, FileCheck, CheckCircle2, UserX, UserCheck, Trash2 } from 'lucide-react';

export const SupportersScreen: React.FC = () => {
  const {
    language,
    t,
    activeRole,
    supporters,
    programs,
    pollingStations,
    addCommittedSupporter,
    withdrawSupporterConsent
  } = useCampaign();

  const [showAddSupporter, setShowAddSupporter] = useState(false);
  
  // Form states
  const [newSupName, setNewSupName] = useState('');
  const [newSupNationalId, setNewSupNationalId] = useState('');
  const [newSupStationId, setNewSupStationId] = useState('ps-kad-1');
  const [newSupProgramId, setNewSupProgramId] = useState('prog-1');
  const [newSupTier, setNewSupTier] = useState<'strong_commit' | 'likely' | 'probable'>('strong_commit');
  const [newSupConsent, setNewSupConsent] = useState<'verbal_witnessed' | 'written_signed' | 'sms_confirmed' | 'in_person_app'>('written_signed');
  const [newSupNotes, setNewSupNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Check RBAC permission for reading sensitive supporter database
  // Polling Agent sees empty list. Canvassers see only their own.
  const isAgent = activeRole === 'agent';
  const isCanvasser = activeRole === 'canvasser';
  
  // Mask name check: only Candidate, Manager, Strategist, Coordinator can view unmasked names (DPA compliance)
  const canViewUnmaskedName = activeRole === 'candidate' || activeRole === 'manager' || activeRole === 'strategist' || activeRole === 'coordinator';

  // Re-verification Queue (voters not verified in 90 days - SRS FR-133)
  // David Kiprop (sup-1) last verified May 10 (recent). Halima Suleiman (sup-2) verified April 18 (recent).
  // Athman Omar (sup-5) last verified Jan 20 (>90 days) - stale!
  const staleSupporters = supporters.filter(s => {
    const lastDate = new Date(s.lastVerifiedDate);
    const diffTime = Math.abs(new Date().getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 90;
  });

  const handleRegisterSupporter = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!newSupName.trim() || !newSupNationalId.trim()) {
      setErrorMsg('Name and National ID are required.');
      return;
    }

    const res = addCommittedSupporter({
      fullName: newSupName,
      nationalIdMasked: '*****' + newSupNationalId.slice(-3),
      pollingStationId: newSupStationId,
      communityProgramId: newSupProgramId,
      commitmentTier: newSupTier,
      registeringPersonId: 'team-5', // mock coordinator id
      consentMethod: newSupConsent,
      notes: newSupNotes || undefined
    });

    if (res.success) {
      setNewSupName('');
      setNewSupNationalId('');
      setNewSupNotes('');
      setShowAddSupporter(false);
    } else {
      setErrorMsg(res.error || 'Failed to register supporter.');
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-wide text-brand-textActive">
            {t('nav.supporters')}
          </h2>
          <p className="text-xs text-brand-textMuted font-medium">
            Registry of verified committed supporters, linked programs, and consent compliance logs.
          </p>
        </div>

        {!isAgent && (
          <button
            onClick={() => setShowAddSupporter(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-violet hover:bg-purple-600 font-bold text-xs text-white transition-all animate-pulse"
          >
            <Heart className="w-4 h-4 text-brand-danger fill-brand-danger" />
            Register Supporter
          </button>
        )}
      </div>

      {/* RLS Restrictions notification */}
      {isAgent && (
        <div className="p-4 bg-brand-danger/10 border border-brand-danger/20 rounded-xl flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-brand-danger" />
          <div className="text-xs font-semibold text-brand-danger">
            {t('rbac.restricted')} — Polling Agents are restricted from accessing voter registration databases.
          </div>
        </div>
      )}

      {/* Program Registry Summary */}
      {!isAgent && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {programs.map(prog => {
            const linkedCount = supporters.filter(s => s.communityProgramId === prog.id).length;
            return (
              <div key={prog.id} className="glass-panel p-4 rounded-xl flex flex-col justify-between h-32 hover-scale">
                <div>
                  <h4 className="text-xs font-extrabold text-brand-textActive truncate" title={prog.name}>
                    {prog.name}
                  </h4>
                  <span className="text-[9px] text-brand-cyan font-bold uppercase tracking-wider font-mono">
                    {prog.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="border-t border-brand-border/40 pt-2 mt-2 flex justify-between items-center text-xs">
                  <span className="text-brand-textMuted">Beneficiaries Registered:</span>
                  <span className="text-md font-extrabold text-brand-textActive">{linkedCount}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stale Supporters Re-verification queue (FR-133) */}
      {!isAgent && staleSupporters.length > 0 && (
        <div className="border border-brand-warning/20 bg-brand-warning/5 p-4 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-brand-warning uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-warning animate-pulse" />
            Re-Verification Queue (&gt;90 days stale - FR-133)
          </h3>
          <p className="text-[10px] text-brand-textMuted leading-relaxed -mt-1.5">
            These supporters haven't been contacted in 90 days. Their commitment status is marked "stale" and excluded from campaign aggregates until re-verified.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {staleSupporters.map(sup => (
              <div key={sup.id} className="p-3 bg-[#12131C] border border-brand-border rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-brand-textActive">
                    {canViewUnmaskedName ? sup.fullName : 'VOTER_IDENTITY_MASKED'}
                  </h4>
                  <p className="text-[9px] text-brand-textMuted mt-0.5">
                    Last Verified: <span className="text-brand-warning font-bold">{sup.lastVerifiedDate}</span>
                  </p>
                </div>
                <button
                  onClick={() => withdrawSupporterConsent(sup.id, false)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-brand-warning/10 text-brand-warning hover:bg-brand-warning/20 border border-brand-warning/20 text-[9px] font-bold transition-all"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Mark Re-verified
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registry Table */}
      {!isAgent && (
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-brand-border/60">
            <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider">
              Committed Supporters Database
            </h3>
            {isCanvasser && (
              <span className="text-[9px] bg-brand-violet/20 text-brand-violet px-2 py-0.5 border border-brand-violet/25 font-bold rounded">
                My Registrations Only
              </span>
            )}
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-brand-border/60 text-brand-textMuted uppercase text-[9px] tracking-wider font-bold">
                  <th className="pb-2.5">Name</th>
                  <th className="pb-2.5">National ID</th>
                  <th className="pb-2.5">Program Link</th>
                  <th className="pb-2.5">Commitment Tier</th>
                  <th className="pb-2.5">Consent Log</th>
                  <th className="pb-2.5 text-right">Right to Erasure (DPA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/40 font-semibold text-brand-textActive">
                {supporters.map(sup => {
                  const programName = programs.find(p => p.id === sup.communityProgramId)?.name || 'None';
                  
                  return (
                    <tr key={sup.id} className="hover:bg-[#12131C] transition-colors">
                      <td className="py-3 pr-2 font-bold">
                        {canViewUnmaskedName ? (
                          sup.fullName
                        ) : (
                          <span className="text-brand-textMuted italic tracking-wide">
                            VOTER_IDENTITY_MASKED (DPA)
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-2 text-brand-textMuted font-mono">{sup.nationalIdMasked}</td>
                      <td className="py-3 pr-2 max-w-xs truncate" title={programName}>{programName}</td>
                      <td className="py-3 pr-2">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          sup.commitmentTier === 'strong_commit' ? 'bg-emerald-500/10 text-emerald-400' :
                          sup.commitmentTier === 'likely' ? 'bg-brand-cyan/15 text-brand-cyan' :
                          'bg-zinc-500/10 text-zinc-400'
                        }`}>
                          {sup.commitmentTier.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-1 text-[10px] text-brand-textMuted">
                          <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="capitalize">{sup.consentMethod.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right space-x-1.5">
                        <button
                          onClick={() => withdrawSupporterConsent(sup.id, false)}
                          className="px-2 py-1 rounded bg-[#12131C] hover:bg-brand-orange/10 hover:text-brand-orange border border-brand-border text-[9px] font-bold transition-all"
                          title="Withdraw Consent (Soft Delete)"
                        >
                          Withdraw
                        </button>
                        <button
                          onClick={() => withdrawSupporterConsent(sup.id, true)}
                          className="p-1 rounded bg-brand-danger/10 hover:bg-brand-danger/20 text-brand-danger border border-brand-danger/20 transition-all"
                          title="Right to Erasure (Anonymize DPA §26)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Supporter Modal */}
      {showAddSupporter && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-heavy rounded-xl max-w-md w-full p-5 border border-brand-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-brand-border/60">
              <h3 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
                Register Committed Supporter
              </h3>
              <button onClick={() => setShowAddSupporter(false)}>
                <XButton />
              </button>
            </div>
            
            {errorMsg && (
              <div className="p-2.5 bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-xs font-bold rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRegisterSupporter} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Supporter Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kipchumba Chepkwony"
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none text-brand-textActive font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                    National ID Number
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="e.g. 33445566"
                    value={newSupNationalId}
                    onChange={(e) => setNewSupNationalId(e.target.value)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none text-brand-textActive font-semibold font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Assigned Polling Station
                  </label>
                  <select
                    value={newSupStationId}
                    onChange={(e) => setNewSupStationId(e.target.value)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none"
                  >
                    {pollingStations.map(ps => (
                      <option key={ps.id} value={ps.id}>{ps.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Originating Program Program
                  </label>
                  <select
                    value={newSupProgramId}
                    onChange={(e) => setNewSupProgramId(e.target.value)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none"
                  >
                    {programs.map(prog => (
                      <option key={prog.id} value={prog.id}>{prog.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Commitment Tier
                  </label>
                  <select
                    value={newSupTier}
                    onChange={(e) => setNewSupTier(e.target.value as any)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none"
                  >
                    <option value="strong_commit">Strong Commit</option>
                    <option value="likely">Likely</option>
                    <option value="probable">Probable</option>
                  </select>
                </div>
              </div>

              {/* DPA Consent Method selection - CRITICAL */}
              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider flex items-center gap-1 text-brand-cyan">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Consent Capture Method (DPA Requirement)
                </label>
                <select
                  value={newSupConsent}
                  onChange={(e) => setNewSupConsent(e.target.value as any)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none"
                >
                  <option value="written_signed">Written & Signed Form</option>
                  <option value="verbal_witnessed">Verbal Witnessed Consent</option>
                  <option value="sms_confirmed">SMS Shortcode Confirmed</option>
                  <option value="in_person_app">In-Person Campaign App Checked</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Enthusiastic supporter, requests follow-up..."
                  value={newSupNotes}
                  onChange={(e) => setNewSupNotes(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none text-brand-textActive"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-brand-violet hover:bg-purple-600 font-bold text-white transition-all mt-2"
              >
                Register & Record Consent Log
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

const XButton = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-textMuted hover:text-brand-textActive"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
export default SupportersScreen;
