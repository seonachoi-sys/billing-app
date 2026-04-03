import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { fmt, calculateDday } from '../utils/calculations';

// 계약 만료일 계산: 계약일 + 갱신기간(년)
function getExpiryDate(contract) {
  if (!contract['계약일'] || !contract['갱신']) return null;
  const match = contract['갱신'].match(/(\d+)/);
  if (!match) return null;
  const years = parseInt(match[1]);
  const start = new Date(contract['계약일']);
  if (isNaN(start.getTime())) return null;
  return new Date(start.getFullYear() + years, start.getMonth(), start.getDate());
}

// 만료까지 남은 일수
function daysUntilExpiry(expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  return Math.floor((exp - today) / (1000 * 60 * 60 * 24));
}

const OverdueAlerts = () => {
  const { getOverdueEntries, master } = useData();
  const [overdueExpanded, setOverdueExpanded] = useState(false);
  const [contractExpanded, setContractExpanded] = useState(false);

  const overdueItems = getOverdueEntries();
  const totalAmount = overdueItems.reduce((s, e) => s + (e['미수금'] || 0), 0);

  // 계약 만료 임박 (90일 이내)
  const contractAlerts = master
    .map(c => {
      const expiry = getExpiryDate(c);
      if (!expiry) return null;
      const remaining = daysUntilExpiry(expiry);
      if (remaining > 90) return null;
      let level = 'green';
      if (remaining <= 0) level = 'red';
      else if (remaining <= 30) level = 'red';
      else if (remaining <= 60) level = 'yellow';
      else level = 'blue';
      return {
        name: c['거래처'],
        product: c['제품'] || '',
        expiryDate: expiry.toISOString().slice(0, 10),
        remaining,
        level,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.remaining - b.remaining);

  // 브라우저 알림 (계약 만료)
  useEffect(() => {
    if (contractAlerts.length === 0) return;
    const notifiedKey = 'billing_contract_notified';
    const notified = JSON.parse(localStorage.getItem(notifiedKey) || '[]');
    const urgent = contractAlerts.filter(c => c.remaining <= 30 && !notified.includes(c.name + c.expiryDate));
    if (urgent.length === 0) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      urgent.forEach(c => {
        new Notification('계약 만료 알림', {
          body: `${c.name} (${c.product}) - ${c.remaining <= 0 ? '만료됨' : c.remaining + '일 남음'} (${c.expiryDate})`,
          icon: '/stamp.jpg',
        });
      });
    }
    localStorage.setItem(notifiedKey, JSON.stringify([
      ...notified, ...urgent.map(c => c.name + c.expiryDate)
    ]));
  }, [contractAlerts]);

  const hasOverdue = overdueItems.length > 0;
  const hasContract = contractAlerts.length > 0;

  if (!hasOverdue && !hasContract) return null;

  return (
    <div className="border-b border-gray-200">
      {/* 연체 알림 */}
      {hasOverdue && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <button onClick={() => setOverdueExpanded(!overdueExpanded)}
              className="w-full flex items-center justify-between text-sm">
              <span className="text-red-700 font-medium">
                ⚠️ 연체 {overdueItems.length}건 - 미수금 {fmt(totalAmount)}원
              </span>
              <span className="text-red-400 text-xs">{overdueExpanded ? '접기 ▲' : '상세보기 ▼'}</span>
            </button>
            {overdueExpanded && (
              <div className="mt-2 space-y-1 pb-2">
                {overdueItems.map((item, i) => {
                  const dday = calculateDday(item['입금예정일']);
                  return (
                    <div key={i} className="flex items-center justify-between text-xs text-red-600 bg-red-100 rounded px-3 py-1.5">
                      <span>{item['거래처명']} | {item['제품명']} | {item['청구기준']}</span>
                      <span className="font-semibold">{fmt(item['미수금'])}원 (D+{dday})</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 계약 만료 알림 */}
      {hasContract && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <button onClick={() => setContractExpanded(!contractExpanded)}
              className="w-full flex items-center justify-between text-sm">
              <span className="text-amber-700 font-medium">
                📋 계약 만료 임박 {contractAlerts.length}건
                {contractAlerts.filter(c => c.remaining <= 0).length > 0 &&
                  <span className="text-red-600 ml-1">
                    ({contractAlerts.filter(c => c.remaining <= 0).length}건 만료)
                  </span>
                }
              </span>
              <span className="text-amber-400 text-xs">{contractExpanded ? '접기 ▲' : '상세보기 ▼'}</span>
            </button>
            {contractExpanded && (
              <div className="mt-2 space-y-1 pb-2">
                {contractAlerts.map((c, i) => {
                  const bgColor = c.level === 'red' ? 'bg-red-100 text-red-700'
                    : c.level === 'yellow' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-blue-100 text-blue-700';
                  return (
                    <div key={i} className={`flex items-center justify-between text-xs rounded px-3 py-1.5 ${bgColor}`}>
                      <span>{c.name} | {c.product}</span>
                      <span className="font-semibold">
                        {c.remaining <= 0
                          ? `만료됨 (${c.expiryDate})`
                          : `${c.remaining}일 남음 (${c.expiryDate})`
                        }
                        {c.remaining <= 30 && c.remaining > 0 && ' ⚠️'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OverdueAlerts;
