/**
 * Mask a payer ID to show only the last 4 characters.
 * SECURITY: Full payer IDs must never appear in page text or DOM attributes.
 */
export function maskPayerId(id: string | null | undefined): string {
  if (!id) return '————';
  if (id.length <= 4) return id;
  return '••••' + id.slice(-4);
}
