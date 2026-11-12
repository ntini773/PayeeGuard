import type { DestinationChangeCase } from '../types/case';

/**
 * Which PayPal account is which, from backend data only. Never "A" or "B":
 * the same real account can be the current one in one case and the new one in the next.
 * IDs are backend-masked and shown as received.
 */
export interface AccountNames {
  /** True once the backend has switched payouts to the new account. */
  activated: boolean;
  /** Masked ID of the account that is paid today. Null after activation (the backend no longer sends the old one). */
  currentId: string | null;
  /** Masked ID of the proposed account, or null before the seller logs in with it. */
  newId: string | null;
}

export function accountNames(c: DestinationChangeCase): AccountNames {
  const activated = c.state === 'ACTIVE_NEW_DESTINATION';
  return {
    activated,
    currentId: activated ? null : c.destinations.active.masked_payer_id,
    newId: c.destinations.proposed ? c.destinations.proposed.masked_payer_id : null,
  };
}

export function withId(label: string, id: string | null): string {
  return id ? `${label} (${id})` : label;
}

/** FIELD_NAME to "Field name". */
export function plainWords(code: string): string {
  const words = code.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
