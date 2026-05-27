import React, { useState, useEffect } from 'react';
import { useCampaign, CampaignRole } from '../context/CampaignContext';
import { Languages, User, Search, Flame, Bell, X } from 'lucide-react';
import Logo from './Logo';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, searchQuery, setSearchQuery }) => {
  const {
    language,
    setLanguage,
    activeRole,
    setActiveRole,
    activeSystem,
    t,
    leaders,
    sites,
    issues,
    pollingStations,
    notifications,
    dismissNotification
  } = useCampaign();

  const [timeLeft, setTimeLeft] = useState({ months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Countdown timer calculation to August 9, 2027
  useEffect(() => {
    const targetDate = new Date('2027-08-09T06:00:00');
    
    const calculateTime = () => {
      const difference = +targetDate - +new Date();
      if (difference <= 0) {
        setTimeLeft({ months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const totalSeconds = Math.floor(difference / 1000);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const totalHours = Math.floor(totalMinutes / 60);
      const days = Math.floor(totalHours / 24);
      
      // Approximate months remaining
      const months = Math.floor(days / 30);
      const remainingDays = days % 30;
      const remainingHours = totalHours % 24;
      const remainingMinutes = totalMinutes % 60;
      const remainingSeconds = totalSeconds % 60;

      setTimeLeft({
        months,
        days: remainingDays,
        hours: remainingHours,
        minutes: remainingMinutes,
        seconds: remainingSeconds
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter search results dynamically
  const getSearchResults = () => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    
    const results: Array<{ id: string; name: string; type: string; tab: string }> = [];

    // Search Leaders
    leaders.forEach(ldr => {
      if (ldr.fullName.toLowerCase().includes(query) || ldr.roleTitle.toLowerCase().includes(query)) {
        results.push({ id: ldr.id, name: ldr.fullName, type: `Leader (${ldr.roleTitle})`, tab: 'community' });
      }
    });

    // Search Sites
    sites.forEach(site => {
      if (site.name.toLowerCase().includes(query) || site.type.toLowerCase().includes(query)) {
        results.push({ id: site.id, name: site.name, type: `Site (${site.type.replace('_', ' ')})`, tab: 'community' });
      }
    });

    // Search Issues
    issues.forEach(iss => {
      if (iss.title.toLowerCase().includes(query) || iss.category.toLowerCase().includes(query)) {
        results.push({ id: iss.id, name: iss.title, type: `Issue (${t(`issue.${iss.category}`)})`, tab: 'issues' });
      }
    });

    // Search Polling Stations
    pollingStations.forEach(ps => {
      if (ps.name.toLowerCase().includes(query) || ps.code.includes(query)) {
        results.push({ id: ps.id, name: ps.name, type: `Polling Station (#${ps.code})`, tab: 'nyalitrack' });
      }
    });

    return results.slice(0, 5); // return top 5
  };

  const searchResults = getSearchResults();

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-brand-border h-16 flex items-center justify-between px-6">
      
      {/* Title / Logo */}
      <div className="flex items-center gap-3">
        <Logo className="w-11 h-11 drop-shadow-[0_2px_8px_rgba(0,102,255,0.4)]" />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-[#00D4FF] to-[#0066FF] leading-none">
              ALFAYO NELSON
            </h1>
            {activeSystem === 'command' ? (
              <span className="text-[8px] md:text-[9px] bg-[#A855F7]/15 text-[#A855F7] font-black px-2.5 py-0.5 rounded-full border border-[#A855F7]/30 shadow-[0_0_8px_rgba(168,85,247,0.25)] tracking-wider uppercase font-sans">
                Command Suite
              </span>
            ) : (
              <span className="text-[8px] md:text-[9px] bg-brand-orange/15 text-brand-orange font-black px-2.5 py-0.5 rounded-full border border-brand-orange/30 shadow-[0_0_8px_rgba(255,152,0,0.25)] tracking-wider uppercase font-sans">
                Data Entry
              </span>
            )}
          </div>
          <p className="text-[9px] font-black tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-[#FF5533] to-[#CC1100] uppercase mt-0.5">
            CENTRAL COMMAND
          </p>
        </div>
      </div>

      {/* Persistent Countdown Widget (Enlarged) */}
      <div className="hidden lg:flex items-center gap-3 bg-[#0B0C12] border border-brand-violet/50 rounded-xl px-5 py-2.5 shadow-lg shadow-blue-900/10 hover:border-brand-cyan/60 transition-colors duration-300">
        <Flame className="w-5 h-5 text-brand-orange animate-bounce" />
        <div className="flex flex-col">
          <span className="text-[8px] font-black tracking-widest text-brand-orange uppercase leading-none">
            {t('countdown.title')}
          </span>
          <div className="flex items-center gap-2 text-sm font-mono font-black text-brand-textActive mt-1">
            <span>{String(timeLeft.months).padStart(2, '0')}</span>
            <span className="text-[10px] text-brand-textMuted uppercase font-sans font-bold">Mo</span>
            <span className="text-brand-border/40 font-sans font-normal">:</span>
            <span>{String(timeLeft.days).padStart(2, '0')}</span>
            <span className="text-[10px] text-brand-textMuted uppercase font-sans font-bold">Dy</span>
            <span className="text-brand-border/40 font-sans font-normal">:</span>
            <span>{String(timeLeft.hours).padStart(2, '0')}</span>
            <span className="text-[10px] text-brand-textMuted uppercase font-sans font-bold">Hr</span>
            <span className="text-brand-border/40 font-sans font-normal">:</span>
            <span>{String(timeLeft.minutes).padStart(2, '0')}</span>
            <span className="text-[10px] text-brand-textMuted uppercase font-sans font-bold">Mn</span>
            <span className="text-brand-border/40 font-sans font-normal">:</span>
            <span className="text-brand-cyan">{String(timeLeft.seconds).padStart(2, '0')}</span>
            <span className="text-[10px] text-brand-cyan uppercase font-sans font-bold">Sc</span>
          </div>
        </div>
      </div>


      {/* Interaction Controls */}
      <div className="flex items-center gap-4">
        
        {/* Global Search Bar */}
        <div className="relative hidden md:block w-64">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-brand-textMuted" />
          </div>
          <input
            type="text"
            placeholder={t('nav.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
            className="w-full bg-[#12131C] border border-brand-border text-sm text-brand-textActive placeholder:text-brand-textMuted/60 rounded-lg pl-9 pr-3 py-1.5 outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet transition-all font-medium"
          />
          
          {/* Search Dropdown */}
          {showSearchResults && searchQuery.trim() && (
            <div className="absolute top-11 right-0 w-80 glass-panel-heavy rounded-lg border border-brand-border p-2 shadow-2xl z-50">
              <div className="flex justify-between items-center px-2 py-1 border-b border-brand-border/40 mb-1">
                <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider">Search Results</span>
                <button onClick={() => setShowSearchResults(false)}>
                  <X className="w-3.5 h-3.5 text-brand-textMuted hover:text-brand-textActive" />
                </button>
              </div>
              {searchResults.length === 0 ? (
                <div className="p-3 text-center text-xs text-brand-textMuted">No matches found</div>
              ) : (
                searchResults.map(res => (
                  <button
                    key={res.id}
                    onClick={() => {
                      setActiveTab(res.tab);
                      setSearchQuery('');
                      setShowSearchResults(false);
                    }}
                    className="w-full text-left p-2 rounded hover:bg-brand-violet/10 flex flex-col transition-all mb-0.5"
                  >
                    <span className="text-xs font-semibold text-brand-textActive">{res.name}</span>
                    <span className="text-[9px] text-brand-cyan uppercase tracking-wider font-medium">{res.type}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Language Selector */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'sw' : 'en')}
          className="p-2 rounded-lg bg-[#12131C] hover:bg-brand-violet/10 border border-brand-border hover:border-brand-violet/40 transition-all flex items-center gap-1.5 group"
          title="Toggle Language"
        >
          <Languages className="w-4 h-4 text-brand-textMuted group-hover:text-brand-violet transition-colors" />
          <span className="text-xs font-bold text-brand-textActive uppercase tracking-wider font-mono">
            {language === 'en' ? 'SW' : 'EN'}
          </span>
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg bg-[#12131C] hover:bg-brand-violet/10 border border-brand-border hover:border-brand-violet/40 transition-all flex items-center justify-center group"
          >
            <Bell className="w-4 h-4 text-brand-textMuted group-hover:text-brand-violet transition-colors" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-danger rounded-full animate-ping" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute top-11 right-0 w-80 glass-panel-heavy rounded-lg border border-brand-border p-3 shadow-2xl z-50">
              <div className="flex justify-between items-center border-b border-brand-border/40 pb-2 mb-2">
                <span className="text-xs font-bold text-brand-textActive uppercase">Incidents & Alerts</span>
                <span className="text-[9px] bg-brand-danger/25 text-brand-danger font-bold px-2 py-0.5 rounded-full">
                  {notifications.length} Active
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <div className="p-3 text-center text-xs text-brand-textMuted">No new notifications</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="p-2 rounded border border-brand-border bg-[#181926]/40 flex gap-2 relative">
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-brand-danger flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-danger" />
                          {n.title}
                        </h4>
                        <p className="text-[11px] text-brand-textActive mt-0.5">{n.message}</p>
                        <span className="text-[9px] text-brand-textMuted block mt-1">{n.timestamp}</span>
                      </div>
                      <button
                        onClick={() => dismissNotification(n.id)}
                        className="text-brand-textMuted hover:text-brand-textActive self-start"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Simulated Role Selection Dropdown (RBAC Simulator) */}
        <div className="flex items-center gap-2 bg-[#12131C] border border-brand-border rounded-lg px-2.5 py-1">
          <User className="w-4 h-4 text-brand-violet" />
          <div className="flex flex-col">
            <span className="text-[8px] text-brand-textMuted font-bold uppercase tracking-wider leading-none">
              {t('nav.role')}
            </span>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as CampaignRole)}
              className="bg-transparent text-xs font-bold text-brand-textActive outline-none cursor-pointer pr-1 py-0.5 uppercase tracking-wide"
            >
              <option value="candidate" className="bg-[#12131C]">Aspirant (Candidate)</option>
              <option value="manager" className="bg-[#12131C]">Campaign Manager</option>
              <option value="strategist" className="bg-[#12131C]">Chief Strategist</option>
              <option value="coordinator" className="bg-[#12131C]">Ward Coordinator</option>
              <option value="canvasser" className="bg-[#12131C]">Canvasser</option>
              <option value="agent" className="bg-[#12131C]">Polling Agent</option>
            </select>
          </div>
        </div>

      </div>
    </header>
  );
};
export default Navbar;
