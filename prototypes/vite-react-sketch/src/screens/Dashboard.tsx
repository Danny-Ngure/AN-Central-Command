import React, { useState, useEffect } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { InteractiveMap } from '../components/InteractiveMap';
import {
  ShieldAlert,
  Flame,
  Users,
  AlertTriangle,
  Clock,
  Compass,
  TrendingUp,
  MapPin,
  Calendar,
  CheckCircle,
  Plus,
  ArrowLeft,
  Info
} from 'lucide-react';

export const DashboardScreen: React.FC = () => {
  const {
    language,
    t,
    activeRole,
    wards,
    pollingStations,
    leaders,
    issues,
    activities,
    supporters,
    addIssue,
    addSiteCheckIn,
    addCampaignActivity
  } = useCampaign();

  // Selected ward filter from the map clicks
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  
  // Heatmap selections
  const [activeHeatmap, setActiveHeatmap] = useState<'A' | 'B' | 'C' | null>(null);
  const [showHexGrid, setShowHexGrid] = useState(false);

  // Sidebar Sub-tab: 'statewide' or 'stations'
  const [sidebarTab, setSidebarTab] = useState<'statewide' | 'stations'>('statewide');

  // Modal control states
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);

  // Countdown timer calculation to August 9, 2027
  const [timeLeft, setTimeLeft] = useState({ months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });

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

  // Visit form state
  const [visitPurpose, setVisitPurpose] = useState('Campaign baraza check');
  const [visitSiteId, setVisitSiteId] = useState('site-1');

  // Issue form state
  const [issueCategory, setIssueCategory] = useState('water');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueSeverity, setIssueSeverity] = useState<'minor' | 'moderate' | 'serious' | 'critical'>('moderate');
  const [issueVoters, setIssueVoters] = useState(150);

  // Meeting form state
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingType, setMeetingType] = useState('community_baraza');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingTime, setMeetingTime] = useState('');

  // Calculate filtered stats
  const activeWards = selectedWard ? wards.filter(w => w.id === selectedWard) : wards;
  const totalVoters = activeWards.reduce((acc, curr) => acc + curr.voters, 0);
  const averageCoverage = Math.round(activeWards.reduce((acc, curr) => acc + curr.coverage, 0) / activeWards.length);
  
  const activeLeaders = selectedWard ? leaders.filter(l => l.wardId === selectedWard) : leaders;
  const warmLeaders = activeLeaders.filter(l => l.relationshipTemperature === 'warm').length;
  
  const activeIssues = selectedWard ? issues.filter(i => i.wardId === selectedWard) : issues;
  const criticalIssues = activeIssues.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;

  const upcomingActivities = activities
    .filter(a => a.status === 'confirmed' || a.status === 'planned')
    .slice(0, 3);

  // Handle visit logging
  const handleLogVisit = (e: React.FormEvent) => {
    e.preventDefault();
    addSiteCheckIn(visitSiteId, `Logged via quick actions. Purpose: ${visitPurpose}`);
    setShowVisitModal(false);
  };

  // Handle issue logging
  const handleLogIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim()) return;
    
    addIssue({
      villageId: 'vil-custom',
      villageName: 'Custom Village Area',
      wardId: selectedWard || 'kongowea',
      category: issueCategory,
      title: issueTitle,
      description: 'Logged via quick actions panel.',
      severity: issueSeverity,
      affectsEstimatedVoters: Number(issueVoters),
      status: 'reported',
      adminResponsiveness: 'slow',
      candidatePosition: 'Candidate plans to inspect this week.'
    });
    
    setIssueTitle('');
    setShowIssueModal(false);
  };

  // Handle meeting logging
  const handleCreateMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingTitle.trim() || !meetingLocation.trim()) return;

    addCampaignActivity({
      title: meetingTitle,
      type: meetingType,
      scheduledAt: meetingTime || '2026-06-01 10:00:00',
      location: meetingLocation,
      wardId: selectedWard || 'kongowea',
      village: 'Meeting Mtaa',
      ownerId: 'team-2',
      candidateAttended: true,
      followUpRequired: true
    });

    setMeetingTitle('');
    setMeetingLocation('');
    setShowMeetingModal(false);
  };

  // Get campaign description bio for the active ward (CNN style biography note)
  const getCampaignBioNotes = () => {
    if (selectedWard === 'kongowea') {
      return "Kongowea Ward is the cornerstone of our campaign, representing our highest supporter base (58.5%). Key drives are centered around the Open Air Market and the boreholes initiative. Strategic focus remains on maintaining voter turnout momentum and addressing sanitation complaints.";
    }
    if (selectedWard === 'kadzandani') {
      return "Kadzandani is a highly contested ward, currently leaning towards the opposition. Voter support is estimated at 44.5%. We are focusing on road network grievances and secondary school bursary projects to flip the undecided voter segments.";
    }
    if (selectedWard === 'mkomani') {
      return "Mkomani features high-income estates and tourist beachfront properties. Currently neutral (48.2%). Our youth volleyball tournaments and sports kit sponsorships are generating strong appeal among first-time youth voters here.";
    }
    if (selectedWard === 'frere_town') {
      return "Frere Town is historically receptive (52.0% support). Strong organization lines exist through local Anglican (ACK) and Methodist church elders. focus is on voter card registration audit logs.";
    }
    if (selectedWard === 'ziwa_la_ngombe') {
      return "Ziwa La Ng'ombe currently leans supportive (49.5%) thanks to extensive table banking seed boosts. Key risks include voter intimidation complaints near the border, requiring police reporting checks.";
    }
    return "Nyali Constituency comprises five diverse wards. Our campaign maintains a stable lead in Kongowea and Frere Town, while Kadzandani remains the primary battleground. Drill down into individual wards on the map to review localized agendas.";
  };

  // CNN-Style Wards and Stations list generator
  const renderCnnSidebarList = () => {
    if (sidebarTab === 'statewide' && !selectedWard) {
      // List Wards
      return wards.map(w => {
        // Map lean settings
        const isSupportive = w.coverage > 70;
        
        return (
          <button
            key={w.id}
            onClick={() => setSelectedWard(w.id)}
            className="w-full text-left p-3.5 bg-[#12131C] border border-brand-border/60 rounded-xl hover:border-brand-violet/60 hover:bg-brand-violet/5 transition-all flex flex-col justify-between space-y-2.5 group"
          >
            <div className="w-full flex justify-between items-center">
              <div>
                <h4 className="text-xs font-extrabold text-brand-textActive group-hover:text-brand-cyan transition-colors">
                  {w.name} Ward
                </h4>
                <p className="text-[9px] text-brand-textMuted font-mono">
                  {w.voters.toLocaleString()} Registered Voters
                </p>
              </div>
              <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded uppercase ${
                w.id === 'kadzandani' ? 'bg-brand-danger/10 text-brand-danger' : 'bg-brand-cyan/20 text-brand-cyan'
              }`}>
                {w.id === 'kadzandani' ? 'BATTLEGROUND' : 'SUPPORTIVE'}
              </span>
            </div>

            {/* Horizontal progress bar gauge */}
            <div className="w-full space-y-1">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-brand-textMuted">Supporter Ratio</span>
                <span className="text-brand-textActive font-mono">
                  {w.id === 'kongowea' ? '58.5%' : w.id === 'frere_town' ? '52.0%' : w.id === 'kadzandani' ? '44.5%' : '48.2%'}
                </span>
              </div>
              <div className="w-full h-2 bg-[#090A0F] rounded-full overflow-hidden border border-brand-border/40">
                <div
                  className={`h-full rounded-full ${
                    w.id === 'kadzandani' ? 'bg-brand-danger' : 'bg-brand-cyan'
                  }`}
                  style={{
                    width: w.id === 'kongowea' ? '58.5%' : w.id === 'frere_town' ? '52.0%' : w.id === 'kadzandani' ? '44.5%' : '48.2%'
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-brand-textMuted">
                <span>Est. 95% verified</span>
                <span className="font-semibold">
                  {Math.round(w.voters * (w.id === 'kongowea' ? 0.585 : w.id === 'frere_town' ? 0.52 : 0.48)).toLocaleString()} supporters
                </span>
              </div>
            </div>
          </button>
        );
      });
    }

    // List Stations (for a selected ward or all)
    const stations = selectedWard 
      ? pollingStations.filter(s => s.wardId === selectedWard)
      : pollingStations;

    return stations.map(s => {
      const pacePercent = Math.round(((s.currentTurnoutCount || 0) / s.targetTurnout) * 100);
      const isLowPace = pacePercent < 45;

      return (
        <div
          key={s.id}
          className="p-3.5 bg-[#12131C] border border-brand-border/60 rounded-xl space-y-2.5"
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-xs font-extrabold text-brand-textActive">{s.name}</h4>
              <p className="text-[9px] text-brand-textMuted font-mono">
                Code: <span className="text-brand-cyan">{s.code}</span> — {s.subLocation}
              </p>
            </div>
            {s.agentCheckedIn ? (
              <span className="text-[8px] bg-emerald-500/15 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/25">
                ACTIVE AGENT
              </span>
            ) : (
              <span className="text-[8px] bg-brand-danger/15 text-brand-danger font-extrabold px-1.5 py-0.5 rounded border border-brand-danger/25 animate-pulse">
                NO CHECKIN
              </span>
            )}
          </div>

          {/* Turnout Gauge */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-brand-textMuted">D-Day Turnout Pace</span>
              <span className={`font-mono ${isLowPace ? 'text-brand-warning' : 'text-brand-cyan'}`}>
                {pacePercent}% ({s.currentTurnoutCount || 0} votes)
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#090A0F] rounded-full overflow-hidden border border-brand-border/40">
              <div
                className={`h-full rounded-full ${isLowPace ? 'bg-brand-warning' : 'bg-brand-cyan'}`}
                style={{ width: `${Math.min(100, pacePercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[8px] text-brand-textMuted">
              <span>Target: {s.targetTurnout.toLocaleString()}</span>
              {s.incidentsCount > 0 && (
                <span className="text-brand-danger font-bold uppercase animate-pulse">
                  {s.incidentsCount} Incidents Logged
                </span>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-wide text-brand-textActive">
            {selectedWard 
              ? `${t('nav.dashboard')} — ${wards.find(w => w.id === selectedWard)?.name} Ward`
              : `${t('nav.dashboard')} — Nyali Constituency`}
          </h2>
          <p className="text-xs text-brand-textMuted font-medium">
            Campaign overview, heatmaps, and quick operational status indicators.
          </p>
        </div>

        {/* Heatmap overlay buttons */}
        <div className="flex bg-[#12131C] border border-brand-border rounded-lg p-1 text-xs shrink-0">
          <button
            onClick={() => {
              setActiveHeatmap(activeHeatmap === 'A' ? null : 'A');
              setShowHexGrid(activeHeatmap !== 'A');
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition-all ${
              activeHeatmap === 'A' ? 'bg-brand-cyan text-black' : 'text-brand-textMuted hover:text-brand-textActive'
            }`}
          >
            Heatmap A (Coverage)
          </button>
          <button
            onClick={() => {
              setActiveHeatmap(activeHeatmap === 'B' ? null : 'B');
              setShowHexGrid(activeHeatmap !== 'B');
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition-all ${
              activeHeatmap === 'B' ? 'bg-brand-violet text-white' : 'text-brand-textMuted hover:text-brand-textActive'
            }`}
          >
            Heatmap B (Influence)
          </button>
          <button
            onClick={() => {
              setActiveHeatmap(activeHeatmap === 'C' ? null : 'C');
              setShowHexGrid(activeHeatmap !== 'C');
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition-all ${
              activeHeatmap === 'C' ? 'bg-brand-orange text-white' : 'text-brand-textMuted hover:text-brand-textActive'
            }`}
          >
            Heatmap C (Opportunity)
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl flex items-center gap-4 hover-scale">
          <div className="w-12 h-12 rounded-lg bg-brand-violet/10 border border-brand-violet/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-brand-violet" />
          </div>
          <div>
            <span className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider block">
              {t('kpi.registeredVoters')}
            </span>
            <span className="text-xl font-extrabold text-brand-textActive">
              {totalVoters.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center gap-4 hover-scale">
          <div className="w-12 h-12 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
            <Compass className="w-6 h-6 text-brand-cyan" />
          </div>
          <div>
            <span className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider block">
              {t('kpi.villageCoverage')}
            </span>
            <span className="text-xl font-extrabold text-brand-textActive">
              {averageCoverage}%
            </span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center gap-4 hover-scale">
          <div className="w-12 h-12 rounded-lg bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center">
            <Flame className="w-6 h-6 text-brand-orange" />
          </div>
          <div>
            <span className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider block">
              {t('kpi.warmLeaders')}
            </span>
            <span className="text-xl font-extrabold text-brand-textActive">
              {warmLeaders} <span className="text-xs text-brand-textMuted font-normal">contacts</span>
            </span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center gap-4 hover-scale">
          <div className="w-12 h-12 rounded-lg bg-brand-danger/10 border border-brand-danger/20 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-brand-danger" />
          </div>
          <div>
            <span className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider block">
              {t('kpi.criticalIssues')}
            </span>
            <span className="text-xl font-extrabold text-brand-textActive">
              {criticalIssues} <span className="text-xs text-brand-textMuted font-normal">active</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Map & Interactive CNN-Style Results Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column Map Frame (Spans 2 cols) */}
        <div className="xl:col-span-2 space-y-4">
          <InteractiveMap
            activeHeatmap={activeHeatmap}
            showHexGrid={showHexGrid}
            selectedWard={selectedWard}
            setSelectedWard={setSelectedWard}
          />
          
          {/* Map quick settings */}
          <div className="glass-panel p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <input
                id="hex-toggle"
                type="checkbox"
                checked={showHexGrid}
                onChange={() => setShowHexGrid(!showHexGrid)}
                className="w-4.5 h-4.5 rounded accent-brand-violet cursor-pointer"
              />
              <label htmlFor="hex-toggle" className="font-extrabold text-brand-textActive cursor-pointer">
                {t('dashboard.hexOverlay')}
              </label>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedWard(null);
                  setActiveHeatmap(null);
                  setShowHexGrid(false);
                }}
                className="px-3 py-1 bg-[#12131C] border border-brand-border rounded font-bold text-[10px] text-brand-textActive hover:bg-[#1C1E2B] transition-all"
              >
                Reset Map Filters
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: CNN-Style Election Results Sidebar */}
        <div className="glass-panel rounded-xl flex flex-col justify-between border border-brand-border h-[465px] overflow-hidden">
          
          {/* Sidebar Header */}
          <div className="p-4 bg-[#12131C] border-b border-brand-border flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedWard && (
                  <button
                    onClick={() => setSelectedWard(null)}
                    className="p-1 rounded bg-[#0A0B10] hover:bg-[#1E2030] border border-brand-border text-brand-cyan transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <h3 className="text-sm font-extrabold text-brand-textActive uppercase tracking-wider">
                  {selectedWard 
                    ? `${wards.find(w => w.id === selectedWard)?.name}` 
                    : 'Nyali Wards'}
                </h3>
              </div>
              <span className="text-[9px] bg-brand-cyan/20 text-brand-cyan font-bold px-2 py-0.5 rounded font-mono border border-brand-cyan/35 uppercase">
                {selectedWard ? 'WARD VIEW' : 'STATEWIDE'}
              </span>
            </div>

            {/* Sidebar Tabs */}
            <div className="flex bg-[#0A0B10] border border-brand-border rounded p-0.5 text-[10px] font-extrabold">
              <button
                disabled={!!selectedWard}
                onClick={() => setSidebarTab('statewide')}
                className={`flex-1 py-1 rounded transition-all text-center ${
                  sidebarTab === 'statewide' && !selectedWard
                    ? 'bg-brand-violet text-white shadow' 
                    : 'text-brand-textMuted hover:text-brand-textActive disabled:opacity-30'
                }`}
              >
                Wards Overview
              </button>
              <button
                onClick={() => setSidebarTab('stations')}
                className={`flex-1 py-1 rounded transition-all text-center ${
                  sidebarTab === 'stations' || selectedWard
                    ? 'bg-brand-violet text-white shadow' 
                    : 'text-brand-textMuted hover:text-brand-textActive'
                }`}
              >
                Polling Stations
              </button>
            </div>
          </div>

          {/* Sidebar Scrollable list (CNN results layout) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {renderCnnSidebarList()}
          </div>

          {/* Sidebar Bottom Biography/Strategic Notes (CNN Biography layout) */}
          <div className="p-4 bg-[#12131C] border-t border-brand-border space-y-2 text-[11px] leading-relaxed">
            <span className="text-[9px] font-extrabold text-brand-cyan uppercase tracking-wider block">
              CAMPAIGN STRATEGIC DIRECTION
            </span>
            <p className="text-brand-textMuted font-medium">
              {getCampaignBioNotes()}
            </p>
          </div>

        </div>

      </div>

      {/* Quick Actions & Meetings Split Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Quick Actions */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider pb-1.5 border-b border-brand-border/60">
            {t('dashboard.quickActions')}
          </h3>
          
          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() => setShowVisitModal(true)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-[#12131C] border border-brand-border hover:border-brand-cyan/60 text-xs font-bold text-brand-textActive hover:bg-brand-cyan/5 transition-all text-left group"
            >
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-brand-cyan group-hover:scale-110 transition-transform" />
                <span>{t('dashboard.logVisit')}</span>
              </div>
              <Plus className="w-4 h-4 text-brand-textMuted" />
            </button>

            <button
              onClick={() => setShowIssueModal(true)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-[#12131C] border border-brand-border hover:border-brand-danger/60 text-xs font-bold text-brand-textActive hover:bg-brand-danger/5 transition-all text-left group"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-brand-danger group-hover:scale-110 transition-transform" />
                <span>{t('dashboard.logIssue')}</span>
              </div>
              <Plus className="w-4 h-4 text-brand-textMuted" />
            </button>

            <button
              onClick={() => setShowMeetingModal(true)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-[#12131C] border border-brand-border hover:border-brand-violet/60 text-xs font-bold text-brand-textActive hover:bg-brand-violet/5 transition-all text-left group"
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-brand-violet group-hover:scale-110 transition-transform" />
                <span>{t('dashboard.scheduleMeeting')}</span>
              </div>
              <Plus className="w-4 h-4 text-brand-textMuted" />
            </button>
          </div>
        </div>

        {/* Upcoming Activities list */}
        <div className="glass-panel p-5 rounded-xl space-y-4 md:col-span-2">
          <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider pb-1.5 border-b border-brand-border/60">
            Upcoming Campaign Engagements
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingActivities.map(act => (
              <div key={act.id} className="p-3 bg-[#12131C]/60 rounded-lg border border-brand-border/40 flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-md bg-brand-violet/10 border border-brand-violet/20">
                  <Calendar className="w-3.5 h-3.5 text-brand-violet" />
                </div>
                <div className="space-y-0.5 text-xs">
                  <h4 className="font-bold text-brand-textActive leading-snug">{act.title}</h4>
                  <p className="text-[10px] text-brand-textMuted font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 text-brand-cyan" />
                    {act.scheduledAt}
                  </p>
                  <p className="text-[10px] text-brand-textMuted">
                    Location: <span className="text-brand-textActive font-semibold">{act.location}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 1. Quick Visit Logger Modal (Three-Tap simulation verification) */}
      {showVisitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-heavy rounded-xl max-w-sm w-full p-5 border border-brand-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-brand-border/60">
              <h3 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
                Log Field Visit (Three-Taps)
              </h3>
              <button onClick={() => setShowVisitModal(false)}>
                <XButton />
              </button>
            </div>
            
            <form onSubmit={handleLogVisit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Tap 1: Select Target Site
                </label>
                <select
                  value={visitSiteId}
                  onChange={(e) => setVisitSiteId(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none"
                >
                  <option value="site-1">Kongowea Central Mosque</option>
                  <option value="site-2">Nyali Baptist Church</option>
                  <option value="site-3">Kongowea Open Air Market</option>
                  <option value="site-4">Kadzandani Boda Stage</option>
                  <option value="site-5">Frere Town Community Hall</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Tap 2: Choose Purpose
                </label>
                <select
                  value={visitPurpose}
                  onChange={(e) => setVisitPurpose(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none font-semibold text-brand-textActive"
                >
                  <option value="Baraza Mobilization">Baraza Mobilization</option>
                  <option value="Key Contact Engagement">Key Contact Engagement</option>
                  <option value="Grievance Collection">Grievance Collection</option>
                  <option value="Door-to-door persuation">Door-to-door persuation</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-brand-cyan hover:bg-cyan-400 font-bold text-xs text-black transition-all shadow-md shadow-cyan-900/20"
              >
                Tap 3: Submit Logged Visit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Log Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-heavy rounded-xl max-w-md w-full p-5 border border-brand-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-brand-border/60">
              <h3 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
                Log Village Issue
              </h3>
              <button onClick={() => setShowIssueModal(false)}>
                <XButton />
              </button>
            </div>
            
            <form onSubmit={handleLogIssue} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Issue Category (Controlled Vocabulary)
                </label>
                <select
                  value={issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none text-brand-textActive"
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
                  <option value="corruption">County Corruption</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Issue Title / Summary
                </label>
                <input
                  type="text"
                  placeholder="e.g. Burst sewer line blocking street..."
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none text-brand-textActive"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Severity
                  </label>
                  <select
                    value={issueSeverity}
                    onChange={(e) => setIssueSeverity(e.target.value as any)}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none text-brand-textActive"
                  >
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="serious">Serious</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                    Est. Voters Affected
                  </label>
                  <input
                    type="number"
                    value={issueVoters}
                    onChange={(e) => setIssueVoters(Number(e.target.value))}
                    className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none text-brand-textActive font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-brand-violet hover:bg-purple-600 font-bold text-white transition-all mt-2"
              >
                Log New Issue
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Create Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-heavy rounded-xl max-w-md w-full p-5 border border-brand-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-brand-border/60">
              <h3 className="text-sm font-bold text-brand-textActive uppercase tracking-wider">
                Schedule Meeting & Notify
              </h3>
              <button onClick={() => setShowMeetingModal(false)}>
                <XButton />
              </button>
            </div>
            
            <form onSubmit={handleCreateMeeting} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Meeting Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kadzandani Elders Baraza"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none text-brand-textActive font-semibold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Type
                </label>
                <select
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none text-brand-textActive"
                >
                  <option value="internal_strategy">Internal Strategy</option>
                  <option value="community_baraza">Community Baraza</option>
                  <option value="stakeholder">Stakeholder Dialogue</option>
                  <option value="courtesy_call">Courtesy Call</option>
                  <option value="media">Media Engagement</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kadzandani Social Hall"
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none text-brand-textActive"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  className="w-full bg-[#12131C] border border-brand-border rounded-lg p-2 outline-none text-brand-textActive font-semibold"
                  required
                />
              </div>

              <div className="text-[10px] text-brand-cyan bg-brand-cyan/5 border border-brand-cyan/20 p-2 rounded-lg leading-relaxed">
                * Note: Under FR-060, creating this meeting will automatically trigger WhatsApp and Email notifications to default stakeholders (Patron, CEO, and Media Head).
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-brand-violet hover:bg-purple-600 font-bold text-white transition-all mt-2"
              >
                Schedule & Notify
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
export default DashboardScreen;
