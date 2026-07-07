const aligoapi = require('aligoapi');

type SendAligoSmsParams = {
    receiver: string;
    message: string;
};

const maskSecret = (value?: string) => {
    if (!value) return '';
    if (value.length <= 8) return '********';

    return `${value.slice(0, 4)}********${value.slice(-4)}`;
};

const normalizeKoreanPhone = (value: unknown) => {
    let phone = String(value || '').replace(/[^\d]/g, '');

    // 821012345678 -> 01012345678
    if (phone.startsWith('82')) {
        phone = `0${phone.slice(2)}`;
    }

    return phone;
};

const getAligoAuthData = () => {
    const key = process.env.ALIGO_API_KEY;
    const userId = process.env.ALIGO_USER_ID;
    const testMode = process.env.ALIGO_TEST_MODE;

    if (!key || !userId) {
        throw new Error('Thiếu cấu hình ALIGO_API_KEY hoặc ALIGO_USER_ID');
    }

    const authData: any = {
        key,
        user_id: userId,
    };

    if (testMode === 'Y') {
        authData.testmode_yn = 'Y';
    }

    return authData;
};

const sendAligoSms = async ({ receiver, message }: SendAligoSmsParams) => {
    const sender = process.env.ALIGO_SENDER;

    if (!sender) {
        throw new Error('Thiếu cấu hình ALIGO_SENDER');
    }

    const cleanSender = normalizeKoreanPhone(sender);
    const cleanReceiver = normalizeKoreanPhone(receiver);
    const authData = getAligoAuthData();

    if (!cleanSender) {
        throw new Error('Số điện thoại gửi SMS không hợp lệ');
    }

    if (!cleanReceiver) {
        throw new Error('Số điện thoại nhận SMS không hợp lệ');
    }

    const messageByteLength = Buffer.byteLength(String(message || ''), 'utf8');
    const msgType = messageByteLength > 90 ? 'LMS' : 'SMS';

    const req: any = {
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
        },
        body: {
            sender: cleanSender,
            receiver: cleanReceiver,
            msg: message,
            msg_type: msgType,
            ...(msgType === 'LMS'
                ? {
                    title: 'VIKOF Mobile',
                }
                : {}),
        },
        files: {},
        file: {},
    };

    console.log('[ALIGO_SMS_NORMALIZED_PHONE]', {
        sender: cleanSender,
        receiver: cleanReceiver,
        receiverLength: cleanReceiver.length,
    });

    console.log('[ALIGO_SMS_REQUEST]', {
        auth: {
            key: maskSecret(authData.key),
            user_id: authData.user_id,
            testmode_yn: authData.testmode_yn || 'N',
        },
        body: req.body,
    });

    try {
        const result = await aligoapi.send(req, authData);

        console.log('[ALIGO_SMS_RESPONSE]', JSON.stringify(result, null, 2));

        if (Number(result?.result_code) < 0) {
            throw new Error(result?.message || 'Aligo SMS gửi thất bại');
        }

        return result;
    } catch (error: any) {
        console.error('[ALIGO_SMS_ERROR]', {
            message: error?.message,
            response: error?.response?.data,
            raw: error,
        });

        throw error;
    }
};

export default sendAligoSms;