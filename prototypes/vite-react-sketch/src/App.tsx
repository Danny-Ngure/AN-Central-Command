import React, { useState, useEffect } from 'react';
import { CampaignProvider, useCampaign } from './context/CampaignContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

// Screens
import DashboardScreen from './screens/Dashboard';
import AnalyticsScreen from './screens/Analytics';
import CommunityScreen from './screens/Community';
import SupportersScreen from './screens/Supporters';
import IssuesScreen from './screens/Issues';
import TeamScreen from './screens/Team';
import NyaliTrackScreen from './screens/NyaliTrack';
import AuditLogsScreen from './screens/AuditLogs';

const MainAppContent = () => {
  const { activeSystem } = useCampaign();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Routing synchronization fallback across sub-systems
  useEffect(() => {
    if (activeSystem === 'command') {
      const commandTabs = ['dashboard', 'analytics', 'nyalitrack', 'team', 'audit'];
      if (!commandTabs.includes(activeTab)) {
        setActiveTab('dashboard'); // Default home for Command Suite
      }
    } else {
      const dataEntryTabs = ['supporters', 'issues', 'community'];
      if (!dataEntryTabs.includes(activeTab)) {
        setActiveTab('supporters'); // Default home for Data Entry Suite
      }
    }
  }, [activeSystem, activeTab]);

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'analytics':
        return <AnalyticsScreen />;
      case 'community':
        return <CommunityScreen />;
      case 'supporters':
        return <SupportersScreen />;
      case 'issues':
        return <IssuesScreen />;
      case 'team':
        return <TeamScreen />;
      case 'nyalitrack':
        return <NyaliTrackScreen />;
      case 'audit':
        return <AuditLogsScreen />;
      default:
        return activeSystem === 'command' ? <DashboardScreen /> : <SupportersScreen />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#000000] text-[#E1E4F0] font-sans antialiased overflow-hidden">
      
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Workspace Shell */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        {/* Active Screen */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {renderActiveScreen()}
        </main>

      </div>

    </div>
  );
};

export default function App() {
  return (
    <CampaignProvider>
      <MainAppContent />
    </CampaignProvider>
  );
}
