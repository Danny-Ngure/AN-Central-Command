import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Radio, AlertCircle, CheckCircle, Flame, MessageSquare, Send, Bell } from 'lucide-react';

export const NyaliTrackScreen: React.FC = () => {
  const {
    language,
    t,
    pollingStations,
    incidents,
    submitPollingStationReport,
    submitIncident
  } = useCampaign();

  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const [turnoutInput, setTurnoutInput] = useState('');
  
  // Incident report form
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentCategory, setIncidentCategory] = useState<'voter_intimidation' | 'materials_shortage' | 'technical_failure' | 'violence' | 'other'>('technical_failure');
  const [incidentSeverity, setIncidentSeverity] = useState<'minor' | 'moderate' | 'serious' | 'critical'>('serious');
  const [incidentDesc, setIncidentDesc] = useState('');

  // SMS Fallback simulation panel
  const [smsString, setSmsString] = useState('NYALI#011#2450#INTIMIDATION');
  const [smsFeedback, setSmsFeedback] = useState('');

  const selectedStation = pollingStations.find(s => s.id === activeStationId);

  // Submit manual turnout update
  const handleTurnoutUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStationId || !turnoutInput) return;
    
    submitPollingStationReport(activeStationId, Number(turnoutInput));
    setTurnoutInput('');
    setActiveStationId(null);
  };

  // Submit manual incident report
  const handleIncidentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStationId || !incidentDesc.trim()) return;

    submitIncident({
      stationId: activeStationId,
      stationName: selectedStation?.name || 'Unknown Station',
      category: incidentCategory,
      severity: incidentSeverity,
      description: incidentDesc,
      reportedBy: 'Field Agent'
    });

    setIncidentDesc('');
    setShowIncidentForm(false);
  };

  // Simulate D-Day SMS Fallback Parser (FR-122)
  // Format: "NYALI#STATION_CODE#TURNOUT_COUNT#OPTIONAL_INCIDENT_CODE"
  // Example: "NYALI#003#850" or "NYALI#013#620#MATERIALS_SHORTAGE"
  const handleSimulateSms = () => {
    setSmsFeedback('');
    
    const parts = smsString.trim().split('#');
    if (parts.length < 3 || parts[0].toUpperCase() !== 'NYALI') {
      setSmsFeedback('Error: Invalid SMS format. Must begin with "NYALI#". Correct format: NYALI#CODE#TURNOUT#[INCIDENT]');
      return;
    }

    const code = parts[1];
    const turnout = Number(parts[2]);
    const incidentCode = parts[3]?.toUpperCase();

    // Find station by IEBC code
    const station = pollingStations.find(s => s.code === code);
    if (!station) {
      setSmsFeedback(`Error: Polling station code "${code}" not found in Nyali Constituency.`);
      return;
    }

    if (isNaN(turnout)) {
      setSmsFeedback(`Error: Turnout count "${parts[2]}" is not a valid number.`);
      return;
    }

    // Process turnout update
    submitPollingStationReport(station.id, turnout);
    
    let feedback = `Success: Turnout for ${station.name} (#${station.code}) updated to ${turnout}.`;

    // Process incident if present
    if (incidentCode) {
      const catMap: Record<string, any> = {
        'INTIMIDATION': 'voter_intimidation',
        'MATERIALS': 'materials_shortage',
        'FAILURE': 'technical_failure',
        'VIOLENCE': 'violence',
        'DISPUTE': 'other'
      };

      const category = catMap[incidentCode] || 'other';
      
      submitIncident({
        stationId: station.id,
        stationName: station.name,
        category,
        severity: incidentCode === 'VIOLENCE' || incidentCode === 'INTIMIDATION' ? 'critical' : 'serious',
        description: `SMS Fallback alert: ${incidentCode.toLowerCase()} reported.`,
        reportedBy: 'SMS Fallback Gateway'
      });

      feedback += ` Incident logged: ${incidentCode} (Critical/Serious).`;
    }

    setSmsFeedback(feedback);
    setSmsString('NYALI#'); // Clear input
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-wide text-brand-textActive flex items-center gap-2">
            <Radio className="w-5 h-5 text-brand-cyan animate-pulse" />
            {t('nav.nyalitrack')}
          </h2>
          <p className="text-xs text-brand-textMuted font-medium">
            Real-time D-Day polling station monitoring board. Simulates live agent feeds and SMS fallback backups.
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-xs font-bold text-brand-textActive bg-brand-cyan/15 border border-brand-cyan/20 px-3 py-1.5 rounded-lg">
          <span className="w-2.5 h-2.5 bg-brand-cyan rounded-full animate-ping" />
          D-DAY RUNTIME ENGINE ACTIVE
        </div>
      </div>

      {/* Main Board Grid Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Columns: Stations Status Grid (Spans 2 cols) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-brand-border/60">
              <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider">
                Polling Stations Monitoring Board
              </h3>
              <div className="flex gap-3 text-[9px] font-bold">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Checked In
                </span>
                <span className="flex items-center gap-1 text-brand-danger animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-brand-danger" />
                  No Check-in (Alert &gt;06:30)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {pollingStations.map(station => {
                const isCheckedIn = station.agentCheckedIn;
                
                // Turnout pace math: target vs current
                const target = station.targetTurnout;
                const current = station.currentTurnoutCount || 0;
                const pct = target > 0 ? (current / target) * 100 : 0;
                
                // Amber alert if turnout pace is >20% below target (SRS FR-120 AC-120.3)
                const isTurnoutAmber = pct < 45 && isCheckedIn;

                return (
                  <button
                    key={station.id}
                    onClick={() => setActiveStationId(station.id)}
                    className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all hover-scale ${
                      activeStationId === station.id 
                        ? 'border-brand-violet bg-brand-violet/5 ring-1 ring-brand-violet' 
                        : isTurnoutAmber
                          ? 'bg-brand-warning/5 border-brand-warning/30 hover:border-brand-warning/60'
                          : !isCheckedIn
                            ? 'bg-brand-danger/5 border-brand-danger/25 hover:border-brand-danger/45'
                            : 'bg-[#12131C] border-brand-border hover:border-brand-border/80'
                    }`}
                  >
                    <div className="w-full flex justify-between items-start gap-1">
                      <div>
                        <h4 className="text-xs font-bold text-brand-textActive leading-tight">{station.name}</h4>
                        <span className="text-[9px] text-brand-textMuted font-mono">
                          IEBC Code: <span className="text-brand-cyan">{station.code}</span>
                        </span>
                      </div>
                      
                      {/* Checkin indicator */}
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                        isCheckedIn ? 'bg-emerald-500/10 text-emerald-400' : 'bg-brand-danger/10 text-brand-danger animate-pulse'
                      }`}>
                        {isCheckedIn ? 'ONLINE' : 'MISSING'}
                      </span>
                    </div>

                    <div className="w-full border-t border-brand-border/40 pt-2 mt-2 flex justify-between items-center text-[10px]">
                      <span className="text-brand-textMuted font-semibold">
                        Turnout: <span className="text-brand-textActive font-bold">{current.toLocaleString()}</span> / {target.toLocaleString()} ({Math.round(pct)}%)
                      </span>
                      {station.incidentsCount > 0 && (
                        <span className="text-brand-danger bg-brand-danger/15 font-bold px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                          <AlertCircle className="w-3 h-3" />
                          {station.incidentsCount} Inc.
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* D-Day SMS Fallback Simulator Panel (FR-122) */}
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-brand-cyan uppercase tracking-wider pb-1.5 border-b border-brand-border/60 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-brand-cyan" />
              D-Day SMS Fallback Gateway Simulator (FR-122)
            </h3>
            
            <div className="space-y-3 text-xs">
              <p className="text-brand-textMuted leading-relaxed">
                If data networks drop on election day, polling agents text updates to the Africa's Talking gateway. Test the parser below using the standard syntax.
              </p>
              
              <div className="bg-[#0A0B10] p-2.5 rounded-lg border border-brand-border font-mono text-[10px] space-y-1">
                <span className="text-brand-cyan font-bold">SMS Syntax: NYALI#STATION_CODE#TURNOUT_COUNT#[INCIDENT_CODE]</span>
                <p className="text-brand-textMuted leading-normal">
                  * Incident Codes: INTIMIDATION, MATERIALS, FAILURE, VIOLENCE, DISPUTE.
                </p>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="NYALI#CODE#TURNOUT#[INCIDENT]"
                  value={smsString}
                  onChange={(e) => setSmsString(e.target.value)}
                  className="flex-1 bg-[#12131C] border border-brand-border rounded-lg p-2.5 outline-none font-mono text-brand-textActive"
                />
                <button
                  onClick={handleSimulateSms}
                  className="px-4 py-2.5 rounded-lg bg-brand-cyan hover:bg-cyan-400 font-bold text-black flex items-center gap-2 transition-all"
                >
                  <Send className="w-4 h-4" />
                  Parse SMS
                </button>
              </div>

              {smsFeedback && (
                <div className={`p-3 rounded-lg border text-[11px] font-bold ${
                  smsFeedback.startsWith('Error') 
                    ? 'bg-brand-danger/10 border-brand-danger/25 text-brand-danger' 
                    : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                }`}>
                  {smsFeedback}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Station Details / Manual Reports */}
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider pb-1.5 border-b border-brand-border/60">
              Station Action Center
            </h3>

            {selectedStation ? (
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="text-sm font-bold text-brand-textActive">{selectedStation.name}</h4>
                  <span className="text-[9px] text-brand-textMuted uppercase font-mono">
                    IEBC Code: <span className="text-brand-cyan">{selectedStation.code}</span>
                  </span>
                </div>

                <div className="space-y-2 border-t border-brand-border/40 pt-3">
                  <div className="flex justify-between">
                    <span className="text-brand-textMuted">Assigned Agent:</span>
                    <span className="text-brand-textActive font-bold">{selectedStation.agentName || 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-textMuted">Check-In Time:</span>
                    <span className="text-brand-textActive font-mono font-bold">{selectedStation.checkInTime || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-textMuted">Registered Voters:</span>
                    <span className="text-brand-textActive font-bold">{selectedStation.registeredVoters.toLocaleString()}</span>
                  </div>
                </div>

                {/* Manual Turnout update form */}
                <form onSubmit={handleTurnoutUpdate} className="space-y-2 border-t border-brand-border/40 pt-3.5">
                  <label className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider block">
                    Update Turnout Count
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="e.g. 1540"
                      value={turnoutInput}
                      onChange={(e) => setTurnoutInput(e.target.value)}
                      className="flex-1 bg-[#12131C] border border-brand-border rounded px-2.5 py-1.5 outline-none text-brand-textActive"
                      required
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded bg-brand-violet hover:bg-purple-600 font-bold text-white transition-colors"
                    >
                      Update
                    </button>
                  </div>
                </form>

                {/* Incident reporting panel */}
                <div className="border-t border-brand-border/40 pt-3.5 space-y-2.5">
                  <button
                    onClick={() => setShowIncidentForm(!showIncidentForm)}
                    className="w-full py-2 rounded-lg bg-brand-danger/10 hover:bg-brand-danger/20 text-brand-danger border border-brand-danger/20 font-bold text-xs transition-all"
                  >
                    {showIncidentForm ? 'Cancel Incident Report' : 'Report Incident at Station'}
                  </button>

                  {showIncidentForm && (
                    <form onSubmit={handleIncidentSubmit} className="space-y-3 bg-[#12131C] p-3 rounded-lg border border-brand-border">
                      <div className="space-y-1">
                        <label className="text-[9px] text-brand-textMuted font-bold uppercase tracking-wider">Category</label>
                        <select
                          value={incidentCategory}
                          onChange={(e) => setIncidentCategory(e.target.value as any)}
                          className="w-full bg-[#0A0B10] border border-brand-border rounded p-1.5 outline-none text-brand-textActive"
                        >
                          <option value="technical_failure">KIEMS Technical Failure</option>
                          <option value="voter_intimidation">Voter Intimidation</option>
                          <option value="materials_shortage">Ballot Materials Shortage</option>
                          <option value="violence">Violence Incident</option>
                          <option value="other">Other Dispute</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-brand-textMuted font-bold uppercase tracking-wider">Severity</label>
                        <select
                          value={incidentSeverity}
                          onChange={(e) => setIncidentSeverity(e.target.value as any)}
                          className="w-full bg-[#0A0B10] border border-brand-border rounded p-1.5 outline-none text-brand-textActive"
                        >
                          <option value="minor">Minor</option>
                          <option value="moderate">Moderate</option>
                          <option value="serious">Serious</option>
                          <option value="critical">Critical (Triggers SMS alerts)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-brand-textMuted font-bold uppercase tracking-wider">Description</label>
                        <input
                          type="text"
                          placeholder="Brief description..."
                          value={incidentDesc}
                          onChange={(e) => setIncidentDesc(e.target.value)}
                          className="w-full bg-[#0A0B10] border border-brand-border rounded p-1.5 outline-none text-brand-textActive"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 rounded bg-brand-danger hover:bg-red-600 font-bold text-white transition-colors"
                      >
                        Submit Incident Log
                      </button>
                    </form>
                  )}
                </div>

              </div>
            ) : (
              <p className="text-xs text-brand-textMuted italic text-center py-10">
                Select a polling station in the board list to trigger manual turnout logs, record incidents, or inspect agent sync metadata.
              </p>
            )}
          </div>

          {/* D-Day Incident List */}
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider pb-1.5 border-b border-brand-border/60">
              Active Incident Logs
            </h3>
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {incidents.map(inc => (
                <div key={inc.id} className="p-3 bg-[#12131C]/60 rounded-lg border border-brand-border/40 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase border ${
                      inc.severity === 'critical' ? 'bg-brand-danger/15 text-brand-danger border-brand-danger/20' :
                      inc.severity === 'serious' ? 'bg-brand-orange/10 text-brand-orange border-brand-orange/20' :
                      'bg-brand-warning/10 text-brand-warning border-brand-warning/20'
                    }`}>
                      {inc.severity}
                    </span>
                    <span className="text-[9px] text-brand-textMuted">{inc.timestamp.substring(11)}</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-brand-textActive">{inc.stationName}</h4>
                    <p className="text-[10px] text-brand-cyan uppercase font-bold tracking-wider">{inc.category.replace('_', ' ')}</p>
                  </div>
                  <p className="text-[11px] text-brand-textMuted leading-relaxed">
                    "{inc.description}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
export default NyaliTrackScreen;
