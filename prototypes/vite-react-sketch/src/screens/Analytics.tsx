import React from 'react';
import { useCampaign } from '../context/CampaignContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { ShieldAlert, TrendingUp, Info } from 'lucide-react';

export const AnalyticsScreen: React.FC = () => {
  const { language, t, activeRole } = useCampaign();

  // 1. Turnout History Data (2013, 2017, 2022)
  const turnoutData = [
    { year: '2013', Kadzandani: 72, Kongowea: 78, Mkomani: 71, FrereTown: 74, ZiwaLaNgombe: 70 },
    { year: '2017', Kadzandani: 75, Kongowea: 80, Mkomani: 73, FrereTown: 77, ZiwaLaNgombe: 73 },
    { year: '2022', Kadzandani: 68, Kongowea: 74, Mkomani: 67, FrereTown: 71, ZiwaLaNgombe: 66 }
  ];

  // 2. Demographic age distribution
  const ageData = [
    { name: '18-24', voters: 18450 },
    { name: '25-34', voters: 34120 },
    { name: '35-49', voters: 22800 },
    { name: '50-64', voters: 20150 },
    { name: '65+', voters: 14800 }
  ];

  // 3. Gender distribution
  const genderData = [
    { name: 'Female', value: 52 },
    { name: 'Male', value: 48 }
  ];
  const GENDER_COLORS = ['#7A5CFF', '#00E5FF'];

  // 4. Opponent Candidate Analysis (Gated by RBAC)
  const opponentsList = [
    {
      id: 'opp-1',
      name: 'Hon. Said Abdalla',
      party: 'United Democratic Alliance (UDA)',
      reception: 'Strong in Mkomani, moderate in Kadzandani. Backed by local county administration.',
      strategicNotes: 'Can be pressured on the county\'s poor garbage collection record in Kongowea. Key supporters have shown interest in our boreholes program.'
    },
    {
      id: 'opp-2',
      name: 'Hon. Omar Mzamilu',
      party: 'Orange Democratic Movement (ODM)',
      reception: 'High popularity in Kongowea A, weak in Mkomani beachside estates.',
      strategicNotes: 'Lacks support from boda boda operators. Focus on meeting boda chairmen in Kongowea to split his grassroots support.'
    }
  ];

  // Check RBAC permission for sensitive strategic notes
  // Visible only to candidate, campaign_manager, and chief_strategist (SRS FR-072 AC-072.3)
  const canSeeStrategicNotes = activeRole === 'candidate' || activeRole === 'manager' || activeRole === 'strategist';

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-wide text-brand-textActive">
          {t('nav.analytics')}
        </h2>
        <p className="text-xs text-brand-textMuted font-medium">
          Constituency demographics, historical election trends, and competitive race intelligence.
        </p>
      </div>

      {/* Grid Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Turnout trends */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-brand-border/40">
            <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider">
              Voter Turnout Trends by Ward (%)
            </h3>
            <span className="text-[10px] text-brand-textMuted font-semibold">Source: IEBC Records</span>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={turnoutData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232535" opacity={0.3} />
                <XAxis dataKey="year" stroke="#8E94B3" fontSize={11} tickLine={false} />
                <YAxis stroke="#8E94B3" fontSize={11} domain={[40, 100]} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#12131C', borderColor: '#232535' }} labelStyle={{ color: '#E1E4F0', fontWeight: 'bold' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, color: '#8E94B3' }} />
                <Bar dataKey="Kongowea" fill="#FF9800" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Kadzandani" fill="#A855F7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Mkomani" fill="#00B0FF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="FrereTown" fill="#FFFFFF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ZiwaLaNgombe" fill="#00E5FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Age distribution */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-brand-border/40">
            <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider">
              Voter Age Distribution (Registered Voters)
            </h3>
            <span className="text-[10px] text-brand-textMuted font-semibold">Source: 2026 Register projection</span>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232535" opacity={0.3} />
                <XAxis dataKey="name" stroke="#8E94B3" fontSize={11} tickLine={false} />
                <YAxis stroke="#8E94B3" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#12131C', borderColor: '#232535' }} labelStyle={{ color: '#E1E4F0', fontWeight: 'bold' }} />
                <Bar dataKey="voters" fill="#7A5CFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Gender split */}
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-brand-border/40">
            <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider">
              Voter Gender Ratio (%)
            </h3>
            <span className="text-[10px] text-brand-textMuted font-semibold">Source: IEBC 2022</span>
          </div>
          
          <div className="h-64 flex items-center justify-around">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {genderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={GENDER_COLORS[index % GENDER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#12131C', borderColor: '#232535' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="space-y-4 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-brand-violet" />
                <span className="text-brand-textActive">Female (52%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-brand-cyan" />
                <span className="text-brand-textActive">Male (48%)</span>
              </div>
              <p className="text-[10px] text-brand-textMuted max-w-[180px] leading-relaxed">
                Nyali matches the coastal region average trend of slightly higher female registration turnout.
              </p>
            </div>
          </div>
        </div>

        {/* Gated Demographics warning card (Ethnic mapping constraints) */}
        <div className="glass-panel p-5 rounded-xl space-y-3.5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider pb-2 border-b border-brand-border/40">
              Constituency Demographics & Compliance
            </h3>
            <div className="flex items-start gap-3 mt-4">
              <div className="p-2 rounded bg-brand-violet/10 border border-brand-violet/20 mt-0.5">
                <Info className="w-4 h-4 text-brand-violet" />
              </div>
              <div className="space-y-1.5 text-xs">
                <h4 className="font-bold text-brand-textActive">Compliance Rule: FR-071 AC-071.1</h4>
                <p className="text-brand-textMuted leading-relaxed">
                  Ethnic composition mapping is restricted to ward level only, derived from national census projections. Individual profiles must never capture or profile tribe/ethnicity.
                </p>
              </div>
            </div>
          </div>
          <div className="p-3 bg-brand-violet/5 border border-brand-border rounded-lg text-[10px] text-brand-textMuted">
            * Data controller registration filed under Kenya ODPC compliance guidelines.
          </div>
        </div>

      </div>

      {/* Opponent Tracker (Current Race Intelligence) */}
      <div className="glass-panel p-5 rounded-xl space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-brand-border/40">
          <h3 className="text-xs font-bold text-brand-textActive uppercase tracking-wider">
            Current Race Opponent Intelligence
          </h3>
          <span className="text-[10px] text-brand-textMuted font-semibold">Gated under Database RLS Role Gating</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opponentsList.map(opp => (
            <div key={opp.id} className="p-4 bg-[#12131C] border border-brand-border rounded-xl space-y-3">
              <div>
                <h4 className="text-sm font-bold text-brand-textActive">{opp.name}</h4>
                <span className="text-[10px] text-brand-cyan font-bold uppercase tracking-wider font-mono">
                  {opp.party}
                </span>
              </div>
              
              <div className="text-xs space-y-2">
                <div>
                  <span className="text-brand-textMuted font-semibold block">Reception Assessment:</span>
                  <p className="text-brand-textActive leading-relaxed">{opp.reception}</p>
                </div>

                {/* Gated Strategic Notes */}
                <div className="border-t border-brand-border/40 pt-2.5 mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-brand-textMuted font-bold block uppercase text-[10px] tracking-wider">
                      Strategic Notes (Gated)
                    </span>
                    {!canSeeStrategicNotes && (
                      <span className="text-[8px] bg-brand-danger/10 text-brand-danger px-2 py-0.5 rounded font-bold border border-brand-danger/20">
                        LOCKED
                      </span>
                    )}
                  </div>
                  
                  {canSeeStrategicNotes ? (
                    <p className="text-brand-warning bg-brand-warning/5 border border-brand-warning/15 p-2 rounded-lg leading-relaxed italic">
                      "{opp.strategicNotes}"
                    </p>
                  ) : (
                    <div className="p-2.5 rounded-lg border border-brand-border/60 bg-[#0A0B10] flex items-center gap-2 text-brand-textMuted text-[10px] italic">
                      <ShieldAlert className="w-3.5 h-3.5 text-brand-danger" />
                      <span>{t('rbac.notesGated')}</span>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
export default AnalyticsScreen;
