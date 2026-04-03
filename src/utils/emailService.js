import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_1wj1mgj';
const TEMPLATE_REPLY_REQUEST = 'template_376r7kx';   // 회신 요청용
const TEMPLATE_COUNT_NOTICE = 'template_24vd0im';     // 건수 안내용
const PUBLIC_KEY = 'KnaxXb-nmGBTB3OrZ';

// EmailJS 초기화
emailjs.init(PUBLIC_KEY);

/**
 * 병원에 이메일 발송
 * @param {Object} params
 * @param {string} params.hospitalName - 거래처명
 * @param {string} params.toEmail - 수신 이메일
 * @param {string} params.contactName - 담당자명
 * @param {string} params.emailType - '회신 요청' | '건수 안내'
 * @param {string} params.year - 연도
 * @param {string} params.month - 월
 * @param {number} [params.casCount] - CAS 건수 (건수 안내용)
 * @param {number} [params.exoCount] - EXO 건수 (건수 안내용)
 * @param {number} [params.totalCount] - 총 건수 (건수 안내용)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function sendBillingEmail(params) {
  const { hospitalName, toEmail, contactName, emailType, year, month,
          casCount = 0, exoCount = 0, totalCount = 0 } = params;

  if (!toEmail) {
    return { success: false, message: '이메일 주소가 등록되지 않았습니다.' };
  }

  const isReplyRequest = emailType === '회신 요청';
  const templateId = isReplyRequest ? TEMPLATE_REPLY_REQUEST : TEMPLATE_COUNT_NOTICE;

  const templateParams = isReplyRequest
    ? {
        hospital_name: hospitalName,
        year,
        month,
        to_email: toEmail,
      }
    : {
        contact_name: contactName || hospitalName + ' 담당자',
        hospital_name: hospitalName,
        year,
        month,
        cas_count: String(casCount),
        exo_count: String(exoCount),
        total_count: String(totalCount),
        to_email: toEmail,
      };

  try {
    await emailjs.send(SERVICE_ID, templateId, templateParams);
    return {
      success: true,
      message: `${hospitalName}에 ${emailType} 메일을 발송했습니다.`,
    };
  } catch (error) {
    console.error('EmailJS 발송 실패:', error);
    return {
      success: false,
      message: `발송 실패: ${error?.text || error?.message || '알 수 없는 오류'}`,
    };
  }
}
