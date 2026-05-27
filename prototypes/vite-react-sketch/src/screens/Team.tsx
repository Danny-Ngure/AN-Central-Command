import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Network, Phone, Mail, Send, Award } from 'lucide-react';

export const TeamScreen: React.FC = () => {
  const { language, t, teamMembers, wards } = useCampaign();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>('team-2');

  const selectedMember = teamMembers.find(t => t.id === selectedMemberId);

  // Group members hierarchically
  const executiveTeam = teamMembers.filter(m => !m.wardId);
  const wardCoordinators = teamMembers.filter(m => m.wardId);

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-wide text-brand-textActive">
          {t('nav.team')}
        </h2>
        <p className="text-xs text-brand-textMuted font-medium">
          Campaign team directory, hierarchical reporting trees, and mobile application activity status logs.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Organization Directory (Spans 2 cols) */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Executive & Strategy */}
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-brand-cyan uppercase tracking-wider pb-1.5 border-b border-brand-border/60 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-brand-cyan" />
              Executive Leadership & Strategy Team
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {executiveTeam.map(mem => (
                <button
                  key={mem.id}
                  onClick={() => setSelectedMemberId(mem.id)}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between h-28 transition-all hover-scale ${
                    selectedMemberId === mem.id 
                      ? 'border-brand-violet bg-brand-violet/5 ring-1 ring-brand-violet' 
                      : 'bg-[#12131C] border-brand-border hover:border-brand-border/85'
                  }`}
                >
                  <div>
                    <h4 className="text-xs font-bold text-brand-textActive">{mem.name}</h4>
                    <span className="text-[9px] text-brand-violet font-bold uppercase tracking-wider">{mem.role}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`w-2 h-2 rounded-full ${mem.activeStatus ? 'bg-emerald-500' : 'bg-brand-textMuted'}`} />
                    <span className="text-[9px] text-brand-textMuted uppercase font-bold tracking-wider">
                      {mem.activeStatus ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Ward Coordinators Directory */}
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-brand-violet uppercase tracking-wider pb-1.5 border-b border-brand-border/60 flex items-center gap-1.5">
              <Network className="w-4 h-4 text-brand-violet" />
              Ward Operational Coordinators
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {wardCoordinators.map(mem => {
                const wardName = wards.find(w => w.id === mem.wardId)?.name || 'Constituency';
                return (
                  <button
                    key={mem.id}
                    onClick={() => setSelectedMemberId(mem.id)}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between h-32 transition-all hover-scale ${
                      selectedMemberId === mem.id 
                        ? 'border-brand-violet bg-brand-violet/5 ring-1 ring-brand-violet' 
                        : 'bg-[#12131C] border-brand-border hover:border-brand-border/85'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-brand-textActive">{mem.name}</h4>
                      <span className="text-[9px] text-brand-textMuted font-bold uppercase tracking-wider block">{mem.role}</span>
                      <span className="text-[9px] bg-brand-cyan/15 text-brand-cyan font-bold px-1.5 py-0.5 rounded border border-brand-cyan/20 mt-1 inline-block uppercase tracking-wider">
                        {wardName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2 border-t border-brand-border/40 pt-1.5">
                      <span className={`w-2 h-2 rounded-full ${mem.activeStatus ? 'bg-emerald-500' : 'bg-brand-textMuted'}`} />
                      <span className="text-[9px] text-brand-textMuted uppercase font-bold tracking-wider">
                        {mem.activeStatus ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: Member profile detail */}
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider pb-1.5 border-b border-brand-border/60">
              Staff Member Details
            </h3>

            {selectedMember ? (
              <div className="space-y-4 text-xs">
                {/* Profile card */}
                <div className="flex items-center gap-3 bg-[#12131C] p-3 rounded-lg border border-brand-border">
                  <div className="w-10 h-10 rounded-full bg-brand-violet/20 flex items-center justify-center font-bold text-brand-violet text-sm">
                    {selectedMember.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h4 className="font-bold text-brand-textActive text-sm leading-snug">{selectedMember.name}</h4>
                    <span className="text-[9px] text-brand-violet font-bold uppercase tracking-wider block">{selectedMember.role}</span>
                  </div>
                </div>

                {/* Details list */}
                <div className="space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-brand-textMuted">Contact Phone:</span>
                    <span className="text-brand-textActive font-bold">{selectedMember.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-textMuted">Email:</span>
                    <span className="text-brand-textActive font-bold">{selectedMember.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-textMuted">Reports To:</span>
                    <span className="text-brand-textActive font-bold uppercase tracking-wide">
                      {selectedMember.reportsToId === 'team-1' ? 'Alfayo Nelson (Candidate)' :
                       selectedMember.reportsToId === 'team-2' ? 'Julius Mwawana (CM)' :
                       selectedMember.reportsToId === 'team-4' ? 'Mike Ndurya (Coordinator)' :
                       'Executive Director'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-brand-border/40 pt-2">
                    <span className="text-brand-textMuted">Portal Status:</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      selectedMember.activeStatus ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'
                    }`}>
                      {selectedMember.activeStatus ? 'Active Syncing' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Activity note */}
                <div className="p-3 bg-[#12131C] border border-brand-border rounded-lg space-y-1">
                  <span className="text-[8px] text-brand-textMuted font-bold uppercase tracking-wider block">
                    Active Sync Description
                  </span>
                  <p className="text-[10px] text-brand-textActive leading-relaxed">
                    {selectedMember.activeStatus 
                      ? "Synchronized Field App logs (GPS visits, issues) within the last 24 hours. Offline cache synced."
                      : "No active sync detected from mobile device in the last 7 days. Check-ins are pending sync."}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t border-brand-border/40 pt-3">
                  <a
                    href={`tel:${selectedMember.phone}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-[#12131C] hover:bg-brand-cyan hover:text-black border border-brand-border text-[10px] font-bold transition-all"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call Phone
                  </a>
                  <a
                    href={`mailto:${selectedMember.email}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-[#12131C] hover:bg-brand-violet hover:text-white border border-brand-border text-[10px] font-bold transition-all"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Send Email
                  </a>
                </div>

              </div>
            ) : (
              <p className="text-xs text-brand-textMuted italic text-center py-10">
                Select a staff member from the grids to inspect hierarchy reporting links, contact paths, and device status logs.
              </p>
            )}

          </div>
        </div>

      </div>

    </div>
  );
};
export default TeamScreen;
