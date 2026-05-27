import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Search, ShieldAlert, Check, X, Phone, MessageSquare, Plus, PlusCircle } from 'lucide-react';

export const CommunityScreen: React.FC = () => {
  const {
    language,
    t,
    activeRole,
    leaders,
    sites,
    approveLeader,
    addLeader,
    addSiteCheckIn
  } = useCampaign();

  const [leaderSearch, setLeaderSearch] = useState('');
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);
  
  // Site Check-in modal
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [checkInNotes, setCheckInNotes] = useState('');

  // Add Leader Form modal
  const [showAddLeader, setShowAddLeader] = useState(false);
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newLeaderRole, setNewLeaderRole] = useState('Imam');
  const [newLeaderPhone, setNewLeaderPhone] = useState('');
  const [newLeaderVillage, setNewLeaderVillage] = useState('');
  const [newLeaderReach, setNewLeaderReach] = useState<'small' | 'medium' | 'large'>('medium');
  const [newLeaderLean, setNewLeaderLean] = useState<'supportive' | 'neutral' | 'leaning_opposition' | 'opposition'>('neutral');
  const [newLeaderTemp, setNewLeaderTemp] = useState<'warm' | 'cool' | 'cold'>('cool');

  // Gating permission checks
  const canApprove = activeRole === 'manager' || activeRole === 'candidate' || activeRole === 'coordinator';
  const canSeeSensitiveNotes = activeRole === 'candidate' || activeRole === 'manager' || activeRole === 'strategist';

  // Filter leaders (excluding queue unless role is authorized to review)
  const isReviewer = activeRole !== 'canvasser' && activeRole !== 'agent';
  
  const queuedLeaders = leaders.filter(l => l.isQueuedForReview);
  const activeLeaders = leaders.filter(l => !l.isQueuedForReview);

  const filteredLeaders = activeLeaders.filter(l => {
    const matchSearch = l.fullName.toLowerCase().includes(leaderSearch.toLowerCase()) ||
                        l.roleTitle.toLowerCase().includes(leaderSearch.toLowerCase()) ||
                        l.village.toLowerCase().includes(leaderSearch.toLowerCase());
    return matchSearch;
  });

  const selectedLeader = leaders.find(l => l.id === selectedLeaderId);

  const handleCreateLeader = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeaderName.trim()) return;

    addLeader({
      fullName: newLeaderName,
      phone: newLeaderPhone || undefined,
      whatsappPhone: newLeaderPhone || undefined,
      roleTitle: newLeaderRole,
      village: newLeaderVillage || 'Mtaa Central',
      wardId: 'kongowea', // default simulation ward
      influenceReach: newLeaderReach,
      politicalLean: newLeaderLean,
      relationshipTemperature: newLeaderTemp,
      ownedByPersonId: 'team-4'
    });

    setNewLeaderName('');
    setNewLeaderPhone('');
    setNewLeaderVillage('');
    setShowAddLeader(false);
  };

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSiteId || !checkInNotes.trim()) return;
    
    addSiteCheckIn(activeSiteId, checkInNotes);
    
    setCheckInNotes('');
    setActiveSiteId(null);
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-wide text-brand-textActive">
            {t('nav.community')}
          </h2>
          <p className="text-xs text-brand-textMuted font-medium">
            Directory of local community opinion leaders, religious sites, social halls, and boda Boda stages.
          </p>
        </div>
        
        <button
          onClick={() => setShowAddLeader(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-violet hover:bg-purple-600 font-bold text-xs text-white transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          Add Opinion Leader
        </button>
      </div>

      {/* Review Queue (Visible only to authorized roles) */}
      {isReviewer && queuedLeaders.length > 0 && (
        <div className="border border-brand-cyan/20 bg-brand-cyan/5 p-4 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-brand-cyan uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-cyan animate-pulse" />
            Ward Coordinator Review Queue ({queuedLeaders.length} submissions)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {queuedLeaders.map(ldr => (
              <div key={ldr.id} className="p-3 bg-[#12131C] border border-brand-border rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-brand-textActive">{ldr.fullName}</h4>
                  <p className="text-[10px] text-brand-textMuted mt-0.5">
                    Proposed: <span className="text-brand-textActive">{ldr.roleTitle}</span> ({ldr.village})
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={!canApprove}
                    onClick={() => approveLeader(ldr.id)}
                    className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 disabled:opacity-50 transition-all"
                    title="Approve submission"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Split view: Directory List vs. Profile Drawer */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Directories tables (Spans 2 cols) */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Leaders Directory */}
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider">
                Community Leaders Registry
              </h3>
              
              {/* Local Search input */}
              <div className="relative w-48">
                <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
                  <Search className="w-3.5 h-3.5 text-brand-textMuted" />
                </div>
                <input
                  type="text"
                  placeholder="Search directory..."
                  value={leaderSearch}
                  onChange={(e) => setLeaderSearch(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border text-[11px] text-brand-textActive placeholder:text-brand-textMuted/60 rounded-md pl-8 pr-2.5 py-1 outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-brand-border/60 text-brand-textMuted uppercase text-[9px] tracking-wider font-bold">
                    <th className="pb-2.5">Name</th>
                    <th className="pb-2.5">Role / Affiliation</th>
                    <th className="pb-2.5">Village / Mtaa</th>
                    <th className="pb-2.5">Political Lean</th>
                    <th className="pb-2.5">Temperature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/40 font-semibold text-brand-textActive">
                  {filteredLeaders.map(ldr => (
                    <tr
                      key={ldr.id}
                      onClick={() => setSelectedLeaderId(ldr.id)}
                      className={`cursor-pointer hover:bg-brand-violet/5 transition-all ${
                        selectedLeaderId === ldr.id ? 'bg-brand-violet/5' : ''
                      }`}
                    >
                      <td className="py-3 pr-2 font-bold text-brand-textActive">{ldr.fullName}</td>
                      <td className="py-3 pr-2 text-brand-textMuted">{ldr.roleTitle}</td>
                      <td className="py-3 pr-2">{ldr.village}</td>
                      <td className="py-3 pr-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          ldr.politicalLean === 'supportive' ? 'bg-emerald-500/10 text-emerald-400' :
                          ldr.politicalLean === 'leaning_supportive' ? 'bg-emerald-500/10 text-emerald-400' :
                          ldr.politicalLean === 'neutral' ? 'bg-zinc-500/10 text-zinc-400' :
                          'bg-brand-danger/10 text-brand-danger'
                        }`}>
                          {ldr.politicalLean.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          ldr.relationshipTemperature === 'warm' ? 'bg-brand-cyan/15 text-brand-cyan' :
                          ldr.relationshipTemperature === 'cool' ? 'bg-zinc-500/10 text-zinc-400' :
                          'bg-brand-danger/10 text-brand-danger'
                        }`}>
                          {ldr.relationshipTemperature}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sites Directory */}
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider pb-1.5 border-b border-brand-border/60">
              Community Sites & Check-ins
            </h3>
            
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-brand-border/60 text-brand-textMuted uppercase text-[9px] tracking-wider font-bold">
                    <th className="pb-2.5">Site Name</th>
                    <th className="pb-2.5">Type</th>
                    <th className="pb-2.5">Village</th>
                    <th className="pb-2.5">Climate Assessment</th>
                    <th className="pb-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/40 font-semibold text-brand-textActive">
                  {sites.map(site => (
                    <tr key={site.id} className="hover:bg-[#12131C] transition-colors">
                      <td className="py-3 pr-2 font-bold">{site.name}</td>
                      <td className="py-3 pr-2 text-brand-textMuted uppercase tracking-wider text-[10px] font-mono">{site.type.replace('_', ' ')}</td>
                      <td className="py-3 pr-2">{site.village}</td>
                      <td className="py-3 pr-2 text-brand-textMuted font-normal italic max-w-xs truncate" title={site.politicalClimate}>
                        "{site.politicalClimate}"
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setActiveSiteId(site.id)}
                          className="px-2.5 py-1 rounded bg-[#12131C] hover:bg-brand-cyan hover:text-black border border-brand-border text-[10px] font-bold transition-all"
                        >
                          Check-in
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Boda Boda Stage Aggregate manager description banner (Compliance verification) */}
          <div className="p-4 bg-brand-warning/5 border border-brand-warning/20 rounded-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-brand-warning shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h4 className="font-bold text-brand-warning uppercase tracking-wider text-[10px]">
                DPA Compliance Safeguard: Boda Boda Stage Gating (FR-022)
              </h4>
              <p className="text-brand-textMuted leading-relaxed">
                Electoral systems are prohibited from creating profiles for individual motorcycle riders to avoid mass tracking. The Boda Boda Stage manager aggregates ridership size estimates and logs relationships exclusively via the Stage Chairman.
              </p>
            </div>
          </div>

        </div>

        {/* Right Column: Leader Profile Drawer */}
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider pb-1.5 border-b border-brand-border/60">
              Opinion Leader Profile
            </h3>
            
            {selectedLeader ? (
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="text-md font-extrabold text-brand-textActive">{selectedLeader.fullName}</h4>
                  <span className="text-[10px] text-brand-cyan font-bold uppercase tracking-wider">{selectedLeader.roleTitle}</span>
                </div>

                <div className="space-y-2 border-t border-brand-border/40 pt-3">
                  <div className="flex justify-between">
                    <span className="text-brand-textMuted">Contact Phone:</span>
                    <span className="text-brand-textActive font-bold flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-brand-cyan" />
                      {selectedLeader.phone || 'Gated'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-brand-textMuted">Geographic Anchor:</span>
                    <span className="text-brand-textActive font-bold">{selectedLeader.village}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-brand-textMuted">Influence Reach:</span>
                    <span className="text-brand-textActive font-bold uppercase tracking-wider">{selectedLeader.influenceReach}</span>
                  </div>
                </div>

                {/* Sensitive Strategic Notes Gated */}
                <div className="border-t border-brand-border/40 pt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider">
                      Sensitive Strategic Notes
                    </span>
                    {!canSeeSensitiveNotes && (
                      <span className="text-[8px] bg-brand-danger/10 text-brand-danger px-1.5 py-0.5 rounded font-bold border border-brand-danger/25">
                        RESTRICTED
                      </span>
                    )}
                  </div>
                  
                  {canSeeSensitiveNotes ? (
                    <p className="p-2.5 rounded-lg bg-brand-violet/5 border border-brand-violet/20 text-brand-textActive leading-relaxed italic">
                      "{selectedLeader.sensitiveNotes || 'No strategic logs created for this leader yet.'}"
                    </p>
                  ) : (
                    <div className="p-3 bg-[#0A0B10] border border-brand-border rounded-lg flex items-center gap-2 text-brand-textMuted text-[10px] italic">
                      <ShieldAlert className="w-4 h-4 text-brand-danger shrink-0" />
                      <span>Gated by database Row-Level Security policy. Available to Candidate and Campaign leadership roles only.</span>
                    </div>
                  )}
                </div>

                {/* Quick actions buttons for leader */}
                <div className="flex gap-2 border-t border-brand-border/40 pt-3">
                  <a
                    href={`tel:${selectedLeader.phone}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-[#12131C] hover:bg-brand-cyan hover:text-black border border-brand-border text-[10px] font-bold transition-all"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call
                  </a>
                  <a
                    href={`https://wa.me/${selectedLeader.whatsappPhone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-[#12131C] hover:bg-emerald-500 hover:text-white border border-brand-border text-[10px] font-bold transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-brand-textMuted italic text-center py-10">
                Select a leader in the table to display contact details, reach matrices, and strategic campaign notes.
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Site Check-in Modal */}
      {activeSiteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-heavy rounded-xl max-w-sm w-full p-5 border border-brand-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-brand-border/60">
              <h3 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
                Log Visit Check-in
              </h3>
              <button onClick={() => setActiveSiteId(null)}>
                <X className="w-4 h-4 text-brand-textMuted hover:text-brand-textActive" />
              </button>
            </div>
            
            <form onSubmit={handleCheckInSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Describe political climate / feedback
                </label>
                <textarea
                  placeholder="e.g. Warm reception, elders welcomed us, requested follow-up on boreholes..."
                  value={checkInNotes}
                  onChange={(e) => setCheckInNotes(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none text-brand-textActive h-24 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-brand-cyan hover:bg-cyan-400 font-bold text-black transition-all"
              >
                Log Check-in Visit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Leader Modal */}
      {showAddLeader && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-heavy rounded-xl max-w-md w-full p-5 border border-brand-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-brand-border/60">
              <h3 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
                Add Opinion Leader
              </h3>
              <button onClick={() => setShowAddLeader(false)}>
                <X className="w-4 h-4 text-brand-textMuted hover:text-brand-textActive" />
              </button>
            </div>
            
            <form onSubmit={handleCreateLeader} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sheikh Ahmed Hamdan"
                  value={newLeaderName}
                  onChange={(e) => setNewLeaderName(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none text-brand-textActive font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Role Title
                  </label>
                  <select
                    value={newLeaderRole}
                    onChange={(e) => setNewLeaderRole(e.target.value)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none"
                  >
                    <option value="Imam">Imam</option>
                    <option value="Pastor">Pastor</option>
                    <option value="Boda Boda Chairman">Boda Boda Chairman</option>
                    <option value="Mama Kiongozi">Mama Kiongozi</option>
                    <option value="Elder">Mzee / Elder</option>
                    <option value="Chief">Chief / Sub-Chief</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Village / Mtaa
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maweni"
                    value={newLeaderVillage}
                    onChange={(e) => setNewLeaderVillage(e.target.value)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none text-brand-textActive"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Phone (for WhatsApp integration)
                </label>
                <input
                  type="text"
                  placeholder="e.g. +254712345678"
                  value={newLeaderPhone}
                  onChange={(e) => setNewLeaderPhone(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none text-brand-textActive"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-brand-border/40 pt-3 mt-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Influence Reach
                  </label>
                  <select
                    value={newLeaderReach}
                    onChange={(e) => setNewLeaderReach(e.target.value as any)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-1.5 outline-none"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Political Lean
                  </label>
                  <select
                    value={newLeaderLean}
                    onChange={(e) => setNewLeaderLean(e.target.value as any)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-1.5 outline-none"
                  >
                    <option value="supportive">Supportive</option>
                    <option value="neutral">Neutral</option>
                    <option value="leaning_opposition">Opp. Lean</option>
                    <option value="opposition">Opposition</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Temp
                  </label>
                  <select
                    value={newLeaderTemp}
                    onChange={(e) => setNewLeaderTemp(e.target.value as any)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-1.5 outline-none"
                  >
                    <option value="warm">Warm</option>
                    <option value="cool">Cool</option>
                    <option value="cold">Cold</option>
                  </select>
                </div>
              </div>

              <div className="text-[10px] text-brand-textMuted italic p-2 bg-[#0A0B10] border border-brand-border rounded-md leading-relaxed mt-2">
                {activeRole === 'canvasser' 
                  ? "* Note: Under active Canvasser role, this leader will enter the review queue for Ward Coordinator authorization." 
                  : "* Note: Creating this leader will bypass queues and record directly to active database registry."}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-brand-violet hover:bg-purple-600 font-bold text-white transition-all mt-2"
              >
                Create Opinion Leader
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default CommunityScreen;
