import React, { useRef, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import useLocalStorage from '../hooks/useLocalStorage';
import { isOverdue, fmt } from '../utils/calculations';

// 계약 만료일 계산
function getExpiryDate(contract) {
  if (!contract['계약일'] || !contract['갱신']) return null;
  const match = contract['갱신'].match(/(\d+)/);
  if (!match) return null;
  const years = parseInt(match[1]);
  const start = new Date(contract['계약일']);
  if (isNaN(start.getTime())) return null;
  return new Date(start.getFullYear() + years, start.getMonth(), start.getDate());
}

function daysUntil(date) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(date); d.setHours(0,0,0,0);
  return Math.floor((d - today) / 86400000);
}

// Slack 메시지 전송
async function sendSlack(webhookUrl, text) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return true;
  } catch { return false; }
}

const Settings = () => {
  const { ledger, hospitals, master, exportData, importData, resetToSeed, firebaseReady, firebaseError } = useData();
  const fileRef = useRef();
  const [slackUrl, setSlackUrl] = useLocalStorage('billing_slack_url', '');
  const [notifyEmail, setNotifyEmail] = useLocalStorage('billing_notify_email', '');
  const [autoNotify, setAutoNotify] = useLocalStorage('billing_auto_notify', true);
  const [lastNotifyDate, setLastNotifyDate] = useLocalStorage('billing_last_notify_date', '');
  const [testResult, setTestResult] = useState('');

  // 앱 로드 시 자동 알림 (하루 1회)
  useEffect(() => {
    if (!autoNotify) return;
    const today = new Date().toISOString().slice(0, 10);
    if (lastNotifyDate === today) return;

    const alerts = buildAlertMessages();
    if (alerts.length === 0) return;

    const message = '📢 *매출청구 일일 알림*\n' + alerts.join('\n');

    // Slack
    if (slackUrl) {
      sendSlack(slackUrl, message);
    }

    // 이메일 (mailto 링크 자동 열기)
    if (notifyEmail) {
      const subject = encodeURIComponent(`[매출청구] 일일 알림 - ${today}`);
      const body = encodeURIComponent(alerts.join('\n'));
      window.open(`mailto:${notifyEmail}?subject=${subject}&body=${body}`, '_blank');
    }

    // 브라우저 알림
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('매출청구 일일 알림', {
        body: alerts.slice(0, 3).join('\n') + (alerts.length > 3 ? `\n...외 ${alerts.length - 3}건` : ''),
        icon: '/stamp.jpg',
      });
    }

    setLastNotifyDate(today);
  }, []); // 앱 로드 시 1회 실행

  function buildAlertMessages() {
    const messages = [];

    // 연체 알림
    const overdue = ledger.filter(isOverdue);
    if (overdue.length > 0) {
      const total = overdue.reduce((s, e) => s + (e['미수금'] || 0), 0);
      messages.push(`🔴 연체 ${overdue.length}건 - 미수금 ${fmt(total)}원`);
      overdue.forEach(e => {
        messages.push(`   • ${e['거래처명']} | ${e['제품명']} | ${fmt(e['미수금'])}원`);
      });
    }

    // 계약 만료 알림
    master.forEach(c => {
      const expiry = getExpiryDate(c);
      if (!expiry) return;
      const remaining = daysUntil(expiry);
      if (remaining <= 0) {
        messages.push(`🔴 계약 만료: ${c['거래처']} (${c['제품']}) - ${expiry.toISOString().slice(0, 10)} 만료됨`);
      } else if (remaining <= 30) {
        messages.push(`🟡 계약 만료 임박: ${c['거래처']} (${c['제품']}) - ${remaining}일 남음`);
      } else if (remaining <= 60) {
        messages.push(`🟡 계약 만료 2개월 내: ${c['거래처']} (${c['제품']}) - ${remaining}일 남음`);
      } else if (remaining <= 90) {
        messages.push(`🔵 계약 만료 3개월 내: ${c['거래처']} (${c['제품']}) - ${remaining}일 남음`);
      }
    });

    return messages;
  }

  const handleTestSlack = async () => {
    if (!slackUrl) { setTestResult('Webhook URL을 입력해 주세요.'); return; }
    setTestResult('전송 중...');
    const ok = await sendSlack(slackUrl, '✅ 매출청구 알림 테스트 메시지입니다.');
    setTestResult(ok ? '전송 완료! Slack 채널을 확인해 주세요.' : '전송 실패. URL을 확인해 주세요.');
  };

  const handleManualNotify = () => {
    const alerts = buildAlertMessages();
    if (alerts.length === 0) { alert('현재 알림 대상이 없습니다.'); return; }
    const message = '📢 *매출청구 알림 (수동)*\n' + alerts.join('\n');
    if (slackUrl) sendSlack(slackUrl, message);
    if (notifyEmail) {
      const today = new Date().toISOString().slice(0, 10);
      const subject = encodeURIComponent(`[매출청구] 알림 - ${today}`);
      const body = encodeURIComponent(alerts.join('\n'));
      window.open(`mailto:${notifyEmail}?subject=${subject}&body=${body}`, '_blank');
    }
    alert(`${alerts.length}건 알림을 발송했습니다.`);
  };

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `매출청구_백업_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const success = importData(ev.target.result);
      alert(success ? '데이터를 성공적으로 불러왔습니다.' : '파일 형식이 올바르지 않습니다.');
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (window.confirm('모든 데이터를 초기 상태로 되돌리시겠습니까?\n입력한 데이터가 모두 삭제됩니다.')) {
      resetToSeed();
      alert('초기 데이터로 복원되었습니다.');
    }
  };

  const storageUsed = Object.keys(localStorage)
    .filter(k => k.startsWith('billing_'))
    .reduce((s, k) => s + (localStorage.getItem(k) || '').length, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 알림 설정 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">알림 설정</h3>

        {/* 자동 알림 토글 */}
        <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700">일일 자동 알림</p>
            <p className="text-xs text-gray-500">앱 접속 시 하루 1회 연체/계약만료 자동 발송</p>
          </div>
          <button onClick={() => setAutoNotify(!autoNotify)}
            className={`relative w-12 h-6 rounded-full transition-colors ${autoNotify ? 'bg-blue-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoNotify ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Slack 설정 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Slack Webhook URL</label>
          <div className="flex gap-2">
            <input type="text" value={slackUrl}
              onChange={e => setSlackUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm" />
            <button onClick={handleTestSlack}
              className="bg-purple-500 text-white px-3 py-2 rounded-md text-sm hover:bg-purple-600 whitespace-nowrap">
              테스트
            </button>
          </div>
          {testResult && <p className="text-xs text-gray-500 mt-1">{testResult}</p>}
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-500">
            <p>Slack에서 Incoming Webhook 앱 추가 후 URL을 붙여넣기 하세요.</p>
            <p>설정 방법: Slack 앱 → 설정 → Incoming Webhooks → 워크스페이스에 추가</p>
          </div>
        </div>

        {/* 이메일 설정 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">알림 이메일</label>
          <input type="email" value={notifyEmail}
            onChange={e => setNotifyEmail(e.target.value)}
            placeholder="billing@tyroscope.com"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">알림 발생 시 기본 메일 앱으로 초안이 열립니다.</p>
        </div>

        {/* 브라우저 알림 */}
        <div className="mb-4">
          <button
            onClick={() => {
              if ('Notification' in window) {
                Notification.requestPermission().then(perm => {
                  alert(perm === 'granted' ? '알림이 허용되었습니다.' : '알림이 차단되었습니다.');
                });
              }
            }}
            className="bg-yellow-50 text-yellow-700 px-4 py-2 rounded-md text-sm border border-yellow-200 hover:bg-yellow-100">
            브라우저 알림 권한 요청
          </button>
          <span className="ml-2 text-xs text-gray-400">
            {('Notification' in window) ? `현재: ${Notification.permission}` : '미지원'}
          </span>
        </div>

        {/* 수동 발송 */}
        <button onClick={handleManualNotify}
          className="w-full bg-amber-500 text-white px-4 py-3 rounded-md text-sm font-medium hover:bg-amber-600">
          지금 알림 발송 (Slack + 이메일)
        </button>
      </div>

      {/* Firebase 상태 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Firebase 연동</h3>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-3 h-3 rounded-full ${
            firebaseError ? 'bg-red-500' : firebaseReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
          }`} />
          <span className="text-sm font-medium text-gray-700">
            {firebaseError ? 'Firebase 연결 실패' : firebaseReady ? 'Firebase 연결됨' : 'Firebase 연결 중...'}
          </span>
        </div>
        {firebaseError && (
          <p className="text-xs text-red-500 bg-red-50 rounded p-2 mb-3">{firebaseError}</p>
        )}
        <div className="text-xs text-gray-500 space-y-1">
          <p>프로젝트: <span className="font-mono text-gray-600">mgt-task-seona</span></p>
          <p>컬렉션: <span className="font-mono text-gray-600">billing_ledger, billing_hospitals, billing_master</span></p>
          <p>모드: {firebaseReady && !firebaseError ? '실시간 동기화 (Firestore + localStorage 캐시)' : 'localStorage 단독 모드'}</p>
        </div>
      </div>

      {/* 데이터 관리 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">데이터 관리</h3>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{ledger.length}</p>
            <p className="text-xs text-gray-500">매출 건수</p>
          </div>
          <div className="bg-gray-50 rounded p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{hospitals.length}</p>
            <p className="text-xs text-gray-500">거래처 수</p>
          </div>
          <div className="bg-gray-50 rounded p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{master.length}</p>
            <p className="text-xs text-gray-500">계약 건수</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          저장소 사용량: {(storageUsed / 1024).toFixed(1)}KB / 5,000KB
        </p>

        <div className="space-y-3">
          <button onClick={handleExport}
            className="w-full bg-blue-500 text-white px-4 py-3 rounded-md text-sm font-medium hover:bg-blue-600">
            데이터 내보내기 (JSON)
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="w-full bg-gray-100 text-gray-700 px-4 py-3 rounded-md text-sm font-medium hover:bg-gray-200 border">
            데이터 가져오기 (JSON)
          </button>
          <input type="file" ref={fileRef} accept=".json" onChange={handleImport} className="hidden" />
          <button onClick={handleReset}
            className="w-full bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm font-medium hover:bg-red-100 border border-red-200">
            초기 데이터로 복원
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
