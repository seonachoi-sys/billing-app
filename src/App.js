import React, { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { DataProvider, useData } from './context/DataContext';
import Dashboard from './components/Dashboard';
import MonthlyBilling from './components/MonthlyBilling';
import Ledger from './components/Ledger';
import InvoiceGenerator from './components/InvoiceGenerator';
import HospitalManagement from './components/HospitalManagement';
import Settings from './components/Settings';
import CostSettings from './components/CostSettings';
import Statistics from './components/Statistics';
import Insights from './components/Insights';
import SharedStats from './components/SharedStats';
import OverdueAlerts from './components/OverdueAlerts';

const tabs = [
  { id: 'dashboard', label: '대시보드', icon: '📊' },
  { id: 'billing', label: '월별 청구', icon: '📝' },
  { id: 'ledger', label: '미수금 관리', icon: '📋' },
  { id: 'invoice', label: '거래명세서', icon: '📄' },
  { id: 'hospital', label: '거래처 관리', icon: '🏥' },
  { id: 'statistics', label: '통계', icon: '📈' },
  { id: 'insights', label: '인사이트', icon: '💡' },
  { id: 'settings', label: '설정', icon: '⚙️' },
];

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settingsSubTab, setSettingsSubTab] = useState('general');
  const { getOverdueEntries } = useData();
  const overdueCount = getOverdueEntries().length;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'billing': return <MonthlyBilling />;
      case 'ledger': return <Ledger />;
      case 'invoice': return <InvoiceGenerator />;
      case 'hospital': return <HospitalManagement />;
      case 'statistics': return <Statistics />;
      case 'insights': return <Insights />;
      case 'settings':
        return (
          <div>
            {/* 설정 서브탭 */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setSettingsSubTab('general')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  settingsSubTab === 'general'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                일반 설정
              </button>
              <button
                onClick={() => setSettingsSubTab('cost')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  settingsSubTab === 'cost'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                원가설정
              </button>
            </div>
            {settingsSubTab === 'general' ? <Settings /> : <CostSettings />}
          </div>
        );
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">
            ㈜타이로스코프 매출청구 관리
          </h1>
          <span className="text-sm text-gray-400">Glandy CAS / EXO</span>
        </div>
      </header>

      <OverdueAlerts />

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 flex space-x-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors relative whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
              {tab.id === 'dashboard' && overdueCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {overdueCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {renderContent()}
      </main>
    </div>
  );
}

// 공유 인사이트 페이지 (읽기전용)
function SharedInsights() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">
            ㈜타이로스코프 경영 인사이트
          </h1>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">읽기전용</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Insights />
      </main>
    </div>
  );
}

function App() {
  return (
    <DataProvider>
      <HashRouter>
        <Routes>
          <Route path="/stats" element={<SharedStats />} />
          <Route path="/insights" element={<SharedInsights />} />
          <Route path="*" element={<AppContent />} />
        </Routes>
      </HashRouter>
    </DataProvider>
  );
}

export default App;
