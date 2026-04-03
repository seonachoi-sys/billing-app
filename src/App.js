import React, { useState } from 'react';
import { DataProvider, useData } from './context/DataContext';
import Dashboard from './components/Dashboard';
import MonthlyBilling from './components/MonthlyBilling';
import Ledger from './components/Ledger';
import InvoiceGenerator from './components/InvoiceGenerator';
import HospitalManagement from './components/HospitalManagement';
import Settings from './components/Settings';
import Statistics from './components/Statistics';
import OverdueAlerts from './components/OverdueAlerts';

const tabs = [
  { id: 'dashboard', label: '대시보드', icon: '📊' },
  { id: 'billing', label: '월별 청구', icon: '📝' },
  { id: 'ledger', label: '미수금 관리', icon: '📋' },
  { id: 'invoice', label: '거래명세서', icon: '📄' },
  { id: 'hospital', label: '거래처 관리', icon: '🏥' },
  { id: 'statistics', label: '통계', icon: '📈' },
  { id: 'settings', label: '설정', icon: '⚙️' },
];

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
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
      case 'settings': return <Settings />;
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
        <div className="max-w-7xl mx-auto px-4 flex space-x-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
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

function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}

export default App;
