import nodemailer from 'nodemailer';
import { db } from './db';

/**
 * Helper to normalize and format a Ghanaian phone number to the standard international format (233XXXXXXXXX)
 */
export function formatGhanaPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('233') && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return '233' + digits.substring(1);
  }
  if (digits.length === 9) {
    return '233' + digits;
  }
  return digits; // fallback
}

/**
 * Sends a real SMS using either Arkesel or mNotify SMS Gateways if API keys are configured.
 * Falls back to simulation log if no keys are found.
 */
export async function sendRealSms(phone: string, message: string, maskId?: string): Promise<boolean> {
  const formattedPhone = formatGhanaPhone(phone);
  
  let settings: any = {};
  try {
    settings = await db.getSettings();
  } catch (err) {
    console.warn('[SMS settings] Could not load from DB, falling back to process.env:', err);
  }

  const activeArkeselKey = settings.arkesel_api_key || process.env.ARKESEL_API_KEY;
  const activeMnotifyKey = settings.mnotify_api_key || process.env.MNOTIFY_API_KEY;
  const activeSmsSenderId = settings.sms_sender_id || maskId || process.env.SMS_SENDER_ID || 'MAC-HUB';

  const senderId = activeSmsSenderId
    .toUpperCase()
    .replace(/[^A-Z0-9\-]/g, '')
    .slice(0, 11) || 'NO-REPLY';

  // --- ARKESEL SMS GATEWAY INTEGRATION ---
  if (activeArkeselKey) {
    try {
      console.log(`[SMS] Sending live SMS via Arkesel Gateway to +${formattedPhone}...`);
      
      // Preferred POST JSON approach for Arkesel
      const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': activeArkeselKey,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: senderId,
          recipients: [formattedPhone],
          message: message
        })
      });

      const result = await response.json().catch(() => ({}));
      if (response.ok && (result.status === 'success' || result.code === 1000)) {
        console.log(`[SMS success] Arkesel dispatches successful! Target: +${formattedPhone}`);
        return true;
      } else {
        // Fallback to GET method if POST is rejected for credential style
        const getUrl = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${encodeURIComponent(activeArkeselKey)}&to=${encodeURIComponent(formattedPhone)}&from=${encodeURIComponent(senderId)}&sms=${encodeURIComponent(message)}`;
        const fallbackRes = await fetch(getUrl);
        const fallbackText = await fallbackRes.text();
        if (fallbackRes.ok && (fallbackText.includes('1000') || fallbackText.toLowerCase().includes('success'))) {
          console.log(`[SMS success] Arkesel fallback GET request successful!`);
          return true;
        }

        console.error(`[SMS Error] Arkesel returned bad status code: ${response.status}. Payload:`, result, 'GET response:', fallbackText);
      }
    } catch (err) {
      console.error('[SMS Exception] Failed to send SMS via Arkesel:', err);
    }
  }

  // --- mNOTIFY SMS GATEWAY INTEGRATION ---
  if (activeMnotifyKey) {
    try {
      console.log(`[SMS] Sending live SMS via mNotify Gateway to +${formattedPhone}...`);
      
      const response = await fetch(`https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(activeMnotifyKey)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient: [formattedPhone],
          sender: senderId,
          message: message,
          is_schedule: false
        })
      });

      const result = await response.json().catch(() => ({}));
      if (response.ok && (result.status === 'success' || result.code === '1000')) {
        console.log(`[SMS success] mNotify dispatches successful! Target: +${formattedPhone}`);
        return true;
      } else {
        console.error(`[SMS Error] mNotify returned response:`, result);
      }
    } catch (err) {
      console.error('[SMS Exception] Failed to send SMS via mNotify:', err);
    }
  }

  // Fallback Simulation Log if credentials aren't deployed
  console.log(`\n================== [SIMULATED] OUTBOUND SMS GATEWAY ==================`);
  console.log(`[Recipient Phone]: +${formattedPhone}`);
  console.log(`[Sender Mask-ID]: ${senderId}`);
  console.log(`[Payload Message]: ${message}`);
  console.log(`[Gateway Status]: Simulated (Credentials not set up in settings)`);
  console.log(`====================================================================\n`);
  return false;
}

/**
 * Sends a real SMTP email using dynamic credentials if available.
 * Falls back to simulation log if credentials are not configured.
 */
export async function sendRealEmail(email: string, subject: string, textBody: string, htmlBody?: string): Promise<boolean> {
  let settings: any = {};
  try {
    settings = await db.getSettings();
  } catch (err) {
    console.warn('[Email settings] Could not load from DB, falling back to process.env:', err);
  }

  const sHost = settings.smtp_host || process.env.SMTP_HOST;
  const sPort = Number(settings.smtp_port || process.env.SMTP_PORT || 465);
  const sUser = settings.smtp_user || process.env.SMTP_USER;
  const sPass = settings.smtp_pass || process.env.SMTP_PASS;
  const sFrom = settings.smtp_from || process.env.SMTP_FROM || 'noreply@mac-hub.com';
  const sFromName = settings.smtp_from_name || process.env.SMTP_FROM_NAME || 'Mac Data Hub';
  const isSecure = settings.smtp_secure !== undefined ? (String(settings.smtp_secure) === 'true') : (sPort === 465 || process.env.SMTP_SECURE === 'true');

  if (sHost && sUser && sPass) {
    try {
      console.log(`[Email] Dispatching live email to ${email} via SMTP...`);
      
      const transporter = nodemailer.createTransport({
        host: sHost,
        port: sPort,
        secure: isSecure,
        auth: {
          user: sUser,
          pass: sPass
        },
        tls: {
          rejectUnauthorized: false // Helps avoid SSL handshake disruptions with certain VPS servers
        }
      });

      const info = await transporter.sendMail({
        from: `"${sFromName}" <${sFrom}>`,
        to: email,
        subject: subject,
        text: textBody,
        html: htmlBody || textBody.replace(/\n/g, '<br>')
      });

      console.log(`[Email success] Message sent successfully. ID: ${info.messageId}`);
      return true;
    } catch (err) {
      console.error('[Email Exception] Failed to deliver SMTP email:', err);
    }
  }

  // Fallback Simulation Log if credentials aren't deployed
  console.log(`\n================== [SIMULATED] OUTBOUND SMTP NODE ==================`);
  console.log(`[Recipient Email]: ${email}`);
  console.log(`[Sender Address]: "${sFromName}" <${sFrom}>`);
  console.log(`[Subject Line]: ${subject}`);
  console.log(`[Body Payload]: ${textBody}`);
  console.log(`[SMTP Status]: Simulated (SMTP settings not set up in settings)`);
  console.log(`==================================================================\n`);
  return false;
}
