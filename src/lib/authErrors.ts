import { isAuthError } from '@supabase/supabase-js';

import { t, type MessageKey } from '@/i18n';

const BY_CODE: Record<string, MessageKey> = {
  invalid_credentials: 'authErrors.invalidCredentials',
  email_not_confirmed: 'authErrors.emailNotConfirmed',
  user_already_exists: 'authErrors.emailTaken',
  email_exists: 'authErrors.emailTaken',
  weak_password: 'authErrors.weakPassword',
  otp_expired: 'authErrors.badCode',
  over_email_send_rate_limit: 'authErrors.tooManyEmails',
  over_request_rate_limit: 'authErrors.tooManyRequests',
  anonymous_provider_disabled: 'authErrors.guestDisabled',
  email_address_invalid: 'authErrors.invalidEmail',
  validation_failed: 'authErrors.invalidEmail',
};

/** Message français lisible pour une erreur Supabase Auth (ou réseau). */
export function authErrorMessage(error: unknown): string {
  if (isAuthError(error)) {
    if (error.name === 'AuthRetryableFetchError' || error.status === 0) return t('authErrors.network');
    const key = error.code ? BY_CODE[error.code] : undefined;
    if (key) return t(key);
  }
  // Erreurs réseau : fetch lève un TypeError, PostgREST le renvoie dans error.message.
  const message = error instanceof Error ? error.message : (error as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && /network request failed|failed to fetch|network/i.test(message)) {
    return t('authErrors.network');
  }
  return t('authErrors.unknown');
}

/** Codes Supabase utiles aux écrans (ex. rediriger vers la saisie du code). */
export function authErrorCode(error: unknown): string | undefined {
  return isAuthError(error) ? error.code : undefined;
}
