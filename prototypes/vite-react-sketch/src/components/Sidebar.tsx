import React from 'react';
import { useCampaign } from '../context/CampaignContext';
import { LayoutDashboard, BarChart3, Users, Network, AlertOctagon, HeartHandshake, Eye, Radio } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { t, activeRole, activeSystem, setActiveSystem, leaders, issues } = useCampaign();

  // Calculate badges
  const queuedLeadersCount = leaders.filter(l => l.isQueuedForReview).length;
  const activeIssuesCount = issues.filter(i => i.status === 'reported' || i.status === 'investigating').length;

  interface MenuItem {
    id: string;
    label: string;
    icon: React.ComponentType<any>;
    badge?: number;
    badgeColor?: string;
  }

  // Command Center specific tabs
  const commandItems: MenuItem[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'analytics', label: t('nav.analytics'), icon: BarChart3 },
    { id: 'nyalitrack', label: t('nav.nyalitrack'), icon: Radio },
    { id: 'team', label: t('nav.team'), icon: Network },
    { id: 'audit', label: t('nav.audit'), icon: Eye }
  ];

  // Data Entry specific tabs
  const dataEntryItems: MenuItem[] = [
    { id: 'supporters', label: t('nav.supporters'), icon: HeartHandshake },
    { id: 'issues', label: t('nav.issues'), icon: AlertOctagon, badge: activeIssuesCount > 0 ? activeIssuesCount : undefined, badgeColor: 'bg-brand-danger text-white font-extrabold px-2 py-0.5 rounded-full' },
    { id: 'community', label: t('nav.community'), icon: Users, badge: queuedLeadersCount > 0 ? queuedLeadersCount : undefined, badgeColor: 'bg-brand-cyan text-black font-extrabold px-2 py-0.5 rounded-full' }
  ];

  const activeMenuItems = activeSystem === 'command' ? commandItems : dataEntryItems;

  return (
    <aside className="w-64 glass-panel border-r border-brand-border min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 shrink-0">
      
      <div>
        {/* Sliding double switcher toggle for splitting portals */}
        <div className="mb-6 bg-[#0E0F17] p-1 rounded-xl border border-brand-border flex text-[10px] font-black relative overflow-hidden h-9">
          <div 
            className="absolute top-1 bottom-1 rounded-lg bg-brand-violet transition-all duration-300 shadow shadow-purple-900/50"
            style={{
              left: activeSystem === 'command' ? '4px' : 'calc(50% + 2px)',
              width: 'calc(50% - 6px)'
            }}
          />
          <button
            onClick={() => {
              setActiveSystem('command');
              setActiveTab('dashboard');
            }}
            className={`flex-1 flex items-center justify-center text-center uppercase tracking-wider transition-colors duration-300 z-10 font-bold ${
              activeSystem === 'command' ? 'text-white' : 'text-brand-textMuted hover:text-brand-textActive'
            }`}
          >
            Command Suite
          </button>
          <button
            onClick={() => {
              setActiveSystem('data_entry');
              setActiveTab('supporters');
            }}
            className={`flex-1 flex items-center justify-center text-center uppercase tracking-wider transition-colors duration-300 z-10 font-bold ${
              activeSystem === 'data_entry' ? 'text-white' : 'text-brand-textMuted hover:text-brand-textActive'
            }`}
          >
            Data Entry
          </button>
        </div>

        {/* Navigation List */}
        <nav className="space-y-1.5">
          {activeMenuItems.map(item => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all group ${
                  isActive
                    ? 'bg-brand-violet text-white shadow-lg shadow-purple-900/20 border border-brand-violet/50'
                    : 'text-brand-textMuted hover:bg-[#12131C] hover:text-brand-textActive border border-transparent hover:border-brand-border/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-white' : 'text-brand-textMuted group-hover:text-brand-textActive'
                  }`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`text-[10px] ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Role-Based Access Indicator Footnote */}
      <div className="border-t border-brand-border/60 pt-4 mt-4 text-[10px] text-brand-textMuted font-medium space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="uppercase text-emerald-400 font-bold tracking-wider">Secure Database Link</span>
        </div>
        <p className="leading-relaxed">
          RLS Policy: <span className="text-brand-textActive font-semibold uppercase">{activeRole === 'candidate' || activeRole === 'manager' || activeRole === 'strategist' ? 'Constituency Scope' : 'Restricted Ward Scope'}</span>
        </p>
      </div>

    </aside>
  );
};
export default Sidebar;
