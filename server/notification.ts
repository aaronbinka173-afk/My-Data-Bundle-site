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
 * STRICTLY DISABLED - Carrier SMS gateway integrations have been removed completely.
 * Always prints a clean local simulation trace into terminal logs.
 */
export async function sendRealSms(phone: string, message: string, maskId?: string): Promise<boolean> {
  const formattedPhone = formatGhanaPhone(phone);
  const senderId = (maskId || 'MAC-HUB')
    .toUpperCase()
    .replace(/[^A-Z0-9\-]/g, '')
    .slice(0, 11) || 'NO-REPLY';

  // Fallback Simulation Log if credentials aren't deployed
  console.log(`\n================== [SIMULATED] OUTBOUND SMS GATEWAY ==================`);
  console.log(`[Recipient Phone]: +${formattedPhone}`);
  console.log(`[Sender Mask-ID]: ${senderId}`);
  console.log(`[Payload Message]: ${message}`);
  console.log(`[Gateway Status]: Simulating channel logs (All direct carrier SMS channels are disconnected per instruction)`);
  console.log(`====================================================================\n`);
  return false;
}

/**
 * Sends a real SMTP email using dynamic credentials if available.
 * STRICTLY DISABLED - SMTP integration has been removed completely.
 * Always prints a clean local simulation trace into terminal logs.
 */
export async function sendRealEmail(email: string, subject: string, textBody: string, htmlBody?: string): Promise<boolean> {
  const sFromName = "Mac Data Hub";
  const sFrom = "noreply@mac-hub.com";

  // Fallback Simulation Log if credentials aren't deployed
  console.log(`\n================== [SIMULATED] OUTBOUND SMTP NODE ==================`);
  console.log(`[Recipient Email]: ${email}`);
  console.log(`[Sender Address]: "${sFromName}" <${sFrom}>`);
  console.log(`[Subject Line]: ${subject}`);
  console.log(`[Body Payload]: ${textBody}`);
  console.log(`[SMTP Status]: Simulating channel logs (All dynamic SMTP nodes are disconnected per instruction)`);
  console.log(`==================================================================\n`);
  return false;
}
