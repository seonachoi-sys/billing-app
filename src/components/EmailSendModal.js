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
              <div className="p-5 bg-white text-sm leading-relaxed whitespace-pre-line">
                {isReplyRequest ? (
                  /* 회신 요청 템플릿 (template_376r7kx) */
                  <div className="space-y-2 text-gray-800">
                    <p><span className="font-semibold text-blue-700">{info.hospitalName}</span> 관계자님, 안녕하세요.</p>
                    <p>(주)타이로스코프 경영관리팀입니다.</p>
                    <p>당사의 Glandy 서비스를 이용해 주셔서 깊이 감사드립니다.</p>
                    <p>다름이 아니오라, 신의료기술평가 유예 제도에 따른 데이터 교차 검증을 위해 <span className="font-semibold">{info.year}년 {info.month}월</span> 처방건수 통지를 부탁드립니다.</p>
                    <div className="bg-gray-50 rounded-lg p-3 my-2 text-gray-700">
                      <p className="font-semibold text-gray-800 mb-1">[요청 사항]</p>
                      <p>* 내용: 매 월 Glandy 처방(사용) 건수</p>
                      <p>* 기한: 매월 7일까지 회신 요망<span className="text-xs text-gray-500">(세금계산서 발행 기한 준수를 위함)</span></p>
                    </div>
                    <p>본 확인 절차는 정확한 비용 정산은 물론, 신의료기술평가 유예 기간 동안 심평원에 신고되는 처방 데이터의 정확성을 확보하기 위함입니다.</p>
                    <p>바쁘시더라도 원활한 업무 처리를 위해 <span className="font-semibold text-red-600">기한 내 회신</span> 부탁드리겠습니다.</p>
                    <p>관련하여 문의 사항이 있으시면 연락 주십시오.</p>
                    <p className="mt-2">감사합니다.</p>
                    <p className="text-gray-600">(주)타이로스코프 경영관리팀 드림</p>
                  </div>
                ) : (
                  /* 건수 안내 템플릿 (template_24vd0im) */
                  <div className="space-y-2 text-gray-800">
                    <p><span className="font-semibold text-blue-700">{info.contactName || info.hospitalName + ' 담당자'}</span> 선생님, 안녕하세요.</p>
                    <p>(주)타이로스코프 경영관리팀입니다.</p>
                    <p>당사의 Glandy 서비스를 이용해 주셔서 깊이 감사드립니다.</p>
                    <p><span className="font-semibold">{info.year}년 {info.month}월</span> Glandy 처방 건수 안내드립니다.</p>
                    <div className="bg-blue-50 rounded-lg p-3 my-2">
                      <p className="font-semibold text-gray-800 mb-1">[처방 현황]</p>
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-blue-100">
                            <td className="py-1.5 text-gray-700">- Glandy CAS</td>
                            <td className="py-1.5 text-right font-semibold">{info.casCount}건</td>
                          </tr>
                          <tr className="border-b border-blue-100">
                            <td className="py-1.5 text-gray-700">- Glandy EXO</td>
                            <td className="py-1.5 text-right font-semibold">{info.exoCount}건</td>
                          </tr>
                          <tr>
                            <td className="py-1.5 font-semibold text-gray-800">- 총계</td>
                            <td className="py-1.5 text-right font-bold text-blue-700">{info.totalCount}건</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p>위 내용에 이상이 없는지 확인 부탁드리며, 검토 후 <span className="font-semibold text-red-600">회신</span> 주시면 감사하겠습니다.</p>
                    <p className="mt-2">감사합니다.</p>
                    <p className="text-gray-600">(주)타이로스코프 경영관리팀 드림</p>
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
