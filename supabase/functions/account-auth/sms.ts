// SMS gateway adapter for the OTP texts.
// STATUS: NOT CONNECTED. MSG91 is the chosen gateway (decision D3), but its official API has not been read and verified yet,
// and I will not guess an API shape (see CLAUDE.md section 2). Roadmap 1.8: when the owner has an MSG91 account + DLT-approved
// OTP template, implement sendSms() here from MSG91's official docs and make smsConfigured() check the secrets it needs
// (set in Supabase dashboard -> Edge Functions -> Secrets; never in the repo).
// Until then only the dev test numbers (private.test_phones) can complete an OTP; real numbers get SMS_FAILED.

export function smsConfigured(): boolean {
  return false
}

export async function sendSms(_phone: string, _message: string): Promise<void> {
  throw new Error('SMS gateway is not configured')
}
