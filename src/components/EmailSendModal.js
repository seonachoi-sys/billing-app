import React, { useState } from 'react';
import { sendBillingEmail } from '../utils/emailService';

/**
 * 이메일 발송 모달 (미리보기 + 발송)
 * @param {Object} props
 * @param {Object} props.info - { hospitalName, email, contactName, emailType, year, month, casCount, exoCount, totalCount, billingMonth }
 * @param {Function} props.onClose
 * @param {Function} props.onSent - (historyEntry) => void
 */
const EmailSendModal = ({ info, onClose, onSent }) => {
  const [step, setStep] = useState('preview'); // 'preview' | 'confirm'
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  if (!info) return null;

  const isReplyRequest = info.emailType === '회신 요청';

  const handleSend = async () => {
    setSending(true);
    const res = await sendBillingEmail({
      hospitalName: info.hospitalName,
      toEmail: info.email,
      contactName: info.contactName,
      emailType: info.emailType,
      year: info.year,
      month: info.month,
      casCount: info.casCount || 0,
      exoCount: info.exoCount || 0,
      totalCount: info.totalCount || 0,
    });
    setSending(false);
    setResult(res);

    // 발송 이력 전달
    onSent({
      _id: Date.now().toString(),
      발송일시: new Date().toLocaleString('ko-KR'),
      거래처명: info.hospitalName,
      이메일: info.email,
      템플릿: info.emailType,
      청구기준: info.billingMonth,
      결과: res.success ? '성공' : '실패',
      메시지: res.message,
    });

    // 성공 시 2초 후 자동 닫기
    if (res.success) {
      setTimeout(() => onClose(), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-gray-800">📧 메일 발송</h3>
            <div className="flex items-center gap-1 text-xs">
              <span className={`px-2 py-0.5 rounded-full ${step === 'preview' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                1. 미리보기
              </span>
              <span className="text-gray-300">→</span>
              <span className={`px-2 py-0.5 rounded-full ${step === 'confirm' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                2. 발송
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {/* 발송 정보 요약 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">수신</span>
              <span className="font-medium text-blue-600">{info.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">거래처</span>
              <span className="font-medium">{info.hospitalName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">청구기준</span>
              <span className="font-medium">{info.year}년 {info.month}월</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">템플릿</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                isReplyRequest ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {info.emailType}
              </span>
            </div>
          </div>

          {/* 미리보기 단계 */}
          {step === 'preview' && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 border-b flex items-center gap-2">
                <span className="text-xs text-gray-500">미리보기</span>
              </div>
              <div className="p-5 bg-white text-sm leading-relaxed">
                {isReplyRequest ? (
                  /* 회신 요청 템플릿 미리보기 */
                  <div className="space-y-3">
                    <p className="text-gray-800">
                      안녕하세요, <span className="font-semibold text-blue-700">{info.hospitalName}</span> 담당자님.
                    </p>
                    <p className="text-gray-800">
                      ㈜타이로스코프입니다.
                    </p>
                    <p className="text-gray-800">
                      <span className="font-semibold">{info.year}년 {info.month}월</span> 이용 건수 확인을 위해 연락드립니다.
                    </p>
                    <p className="text-gray-800">
                      이번 달 이용 건수를 확인하시어 <span className="font-semibold text-red-600">회신</span> 부탁드립니다.
                    </p>
                    <p className="text-gray-600 text-xs mt-4 pt-3 border-t">
                      ※ 본 메일은 이용 건수 회신 요청 메일입니다.
                    </p>
                  </div>
                ) : (
                  /* 건수 안내 템플릿 미리보기 */
                  <div className="space-y-3">
                    <p className="text-gray-800">
                      안녕하세요, <span className="font-semibold text-blue-700">{info.contactName || info.hospitalName + ' 담당자'}</span>님.
                    </p>
                    <p className="text-gray-800">
                      ㈜타이로스코프입니다.
                    </p>
                    <p className="text-gray-800">
                      <span className="font-semibold">{info.year}년 {info.month}월</span>{' '}
                      <span className="font-semibold text-blue-700">{info.hospitalName}</span>의 이용 건수를 안내드립니다.
                    </p>
                    <div className="bg-blue-50 rounded-lg p-4 my-3">
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-blue-100">
                            <td className="py-1.5 text-gray-600">Glandy CAS</td>
                            <td className="py-1.5 text-right font-semibold">{info.casCount}건</td>
                          </tr>
                          <tr className="border-b border-blue-100">
                            <td className="py-1.5 text-gray-600">Glandy EXO</td>
                            <td className="py-1.5 text-right font-semibold">{info.exoCount}건</td>
                          </tr>
                          <tr>
                            <td className="py-1.5 font-semibold text-gray-800">합계</td>
                            <td className="py-1.5 text-right font-bold text-blue-700">{info.totalCount}건</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-gray-800">
                      건수 확인 후 이상이 있으시면 회신 부탁드립니다.
                    </p>
                    <p className="text-gray-600 text-xs mt-4 pt-3 border-t">
                      ※ 본 메일은 월별 이용 건수 안내 메일입니다.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 발송 확인 단계 */}
          {step === 'confirm' && !result && (
            <div className="text-center py-4">
              <p className="text-lg mb-2">📧</p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{info.hospitalName}</span>에<br />
                <span className="font-semibold text-blue-600">{info.emailType}</span> 메일을 발송하시겠습니까?
              </p>
              <p className="text-xs text-gray-400 mt-2">수신: {info.email}</p>
            </div>
          )}

          {/* 발송 결과 */}
          {result && (
            <div className={`text-center py-4 rounded-lg ${
              result.success ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <p className="text-3xl mb-2">{result.success ? '✅' : '❌'}</p>
              <p className={`text-sm font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.success ? '발송 완료!' : '발송 실패'}
              </p>
              <p className="text-xs text-gray-500 mt-1">{result.message}</p>
            </div>
          )}

          {/* 버튼 */}
          {!result && (
            <div className="flex justify-end gap-3">
              {step === 'preview' && (
                <>
                  <button onClick={onClose}
                    className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50">취소</button>
                  <button onClick={() => setStep('confirm')}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600">
                    발송하기 →
                  </button>
                </>
              )}
              {step === 'confirm' && (
                <>
                  <button onClick={() => setStep('preview')}
                    className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50">← 미리보기</button>
                  <button onClick={handleSend} disabled={sending}
                    className="px-4 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {sending ? (
                      <><span className="animate-spin">⏳</span> 발송 중...</>
                    ) : (
                      <>✉️ 발송 확인</>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailSendModal;
