import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { ShieldAlert, AlertTriangle, CheckCircle, Info, Plus } from 'lucide-react';

export const IssuesScreen: React.FC = () => {
  const { language, t, issues, wards, addIssue } = useCampaign();

  const [filterWard, setFilterWard] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('water');
  const [newVillage, setNewVillage] = useState('');
  const [newWard, setNewWard] = useState('kongowea');
  const [newSeverity, setNewSeverity] = useState<'minor' | 'moderate' | 'serious' | 'critical'>('moderate');
  const [newVoters, setNewVoters] = useState(100);
  const [newDescription, setNewDescription] = useState('');

  // Filtering logic
  const filteredIssues = issues.filter(iss => {
    const matchWard = filterWard === 'all' || iss.wardId === filterWard;
    const matchSeverity = filterSeverity === 'all' || iss.severity === filterSeverity;
    return matchWard && matchSeverity;
  });

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-brand-danger/10 text-brand-danger border-brand-danger/20';
      case 'serious': return 'bg-brand-orange/10 text-brand-orange border-brand-orange/20';
      case 'moderate': return 'bg-brand-warning/15 text-brand-warning border-brand-warning/20';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addIssue({
      villageId: `vil-${Date.now()}`,
      villageName: newVillage || 'Mtaa Village',
      wardId: newWard,
      category: newCategory,
      title: newTitle,
      description: newDescription,
      severity: newSeverity,
      affectsEstimatedVoters: Number(newVoters),
      status: 'reported',
      adminResponsiveness: 'slow',
      candidatePosition: 'Candidate will address in the next baraza.'
    });

    setNewTitle('');
    setNewVillage('');
    setNewDescription('');
    setShowAddModal(false);
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-wide text-brand-textActive">
            {t('nav.issues')}
          </h2>
          <p className="text-xs text-brand-textMuted font-medium">
            Local grievances and village-level talking points tracked during town halls and door-to-door sweeps.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-violet hover:bg-purple-600 font-bold text-xs text-white transition-all"
        >
          <Plus className="w-4 h-4" />
          Log Local Issue
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-brand-textMuted font-bold uppercase tracking-wider text-[10px]">Filter Ward:</span>
            <select
              value={filterWard}
              onChange={(e) => setFilterWard(e.target.value)}
              className="bg-[#12131C] border border-brand-border rounded px-2.5 py-1 outline-none text-brand-textActive font-semibold"
            >
              <option value="all">All Wards</option>
              {wards.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-brand-textMuted font-bold uppercase tracking-wider text-[10px]">Filter Severity:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-[#12131C] border border-brand-border rounded px-2.5 py-1 outline-none text-brand-textActive font-semibold"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="serious">Serious</option>
              <option value="moderate">Moderate</option>
              <option value="minor">Minor</option>
            </select>
          </div>
        </div>

        <div className="text-[10px] text-brand-textMuted font-bold">
          Found {filteredIssues.length} matching issues
        </div>
      </div>

      {/* Issues Grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredIssues.map(iss => {
          const isStale = !iss.verified; // Stale if not verified (FR-030 AC-030.3)
          
          return (
            <div key={iss.id} className="glass-panel p-5 rounded-xl border border-brand-border space-y-4 flex flex-col justify-between hover-scale">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${getSeverityStyle(iss.severity)}`}>
                    {iss.severity}
                  </span>
                  
                  {isStale && (
                    <span className="text-[9px] bg-brand-warning/15 text-brand-warning border border-brand-warning/30 px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">
                      STALE (&gt;90d)
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-extrabold text-brand-textActive">{iss.title}</h4>
                  <p className="text-[10px] text-brand-cyan uppercase tracking-wider font-bold mt-0.5">
                    {t(`issue.${iss.category}`)} — {iss.villageName} ({wards.find(w => w.id === iss.wardId)?.name} Ward)
                  </p>
                </div>

                <p className="text-xs text-brand-textMuted leading-relaxed">{iss.description}</p>
              </div>

              {/* Action plan / Position */}
              <div className="border-t border-brand-border/40 pt-3 mt-3 space-y-2 text-xs">
                <div>
                  <span className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider block">
                    Candidate Position / Pledged Action:
                  </span>
                  <p className="text-brand-textActive leading-relaxed italic mt-0.5">
                    "{iss.candidatePosition}"
                  </p>
                </div>
                
                <div className="flex justify-between items-center text-[10px] text-brand-textMuted border-t border-brand-border/20 pt-2">
                  <span>Est. Voters Affected: <span className="text-brand-textActive font-bold">{iss.affectsEstimatedVoters}</span></span>
                  <span>Last Verified: <span className="text-brand-textActive font-bold">{iss.lastVerifiedAt}</span></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Issue Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-heavy rounded-xl max-w-md w-full p-5 border border-brand-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-brand-border/60">
              <h3 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
                Log Local Issue
              </h3>
              <button onClick={() => setShowAddModal(false)}>
                <XButton />
              </button>
            </div>
            
            <form onSubmit={handleCreateIssue} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Burst sewer line blocking market access"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none text-brand-textActive font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Issue Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none text-brand-textActive"
                  >
                    <option value="water">Water Supply</option>
                    <option value="sanitation">Sanitation</option>
                    <option value="garbage">Garbage Collection</option>
                    <option value="drainage">Drainage / Flooding</option>
                    <option value="roads">Road Network</option>
                    <option value="street_lighting">Street Lighting</option>
                    <option value="electricity">Electricity Grid</option>
                    <option value="security">Security</option>
                    <option value="drugs_substance_abuse">Drug Abuse</option>
                    <option value="youth_unemployment">Youth Unemployment</option>
                    <option value="education">Education / Bursary</option>
                    <option value="business_permits">Business Permits / Fees</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Ward Scope
                  </label>
                  <select
                    value={newWard}
                    onChange={(e) => setNewWard(e.target.value)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none text-brand-textActive"
                  >
                    {wards.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Village Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maweni B"
                    value={newVillage}
                    onChange={(e) => setNewVillage(e.target.value)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none text-brand-textActive"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-brand-textMuted font-bold uppercase tracking-wider">
                      Severity
                    </label>
                    <select
                      value={newSeverity}
                      onChange={(e) => setNewSeverity(e.target.value as any)}
                      className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none text-brand-textActive"
                    >
                      <option value="minor">Minor</option>
                      <option value="moderate">Moderate</option>
                      <option value="serious">Serious</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] text-brand-textMuted font-bold uppercase tracking-wider">
                      Est. Voters
                    </label>
                    <input
                      type="number"
                      value={newVoters}
                      onChange={(e) => setNewVoters(Number(e.target.value))}
                      className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none text-brand-textActive"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Detailed Description
                </label>
                <textarea
                  placeholder="Describe the issue raised by residents..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none text-brand-textActive h-20 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-brand-violet hover:bg-purple-600 font-bold text-white transition-all"
              >
                Log New Issue
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
export default IssuesScreen;
