import { describe, it, expect } from 'vitest';
import { SCHEMA_FIELD_NOTES } from '../content/schemaNotes';

/**
 * All fields required by docs/API_CONTRACT.md § 2 and ui/src/types/case.ts.
 * This test fails if any field is added without a short comment note or trust classification.
 */
const REQUIRED_SCHEMA_FIELDS = [
  'case_id',
  'tenant_id',
  'seller_id',
  'state',
  'created_at',
  'updated_at',
  'reason.seller_text',
  'reason.category_claimed_by_seller',
  'destinations.active.masked_payer_id',
  'destinations.proposed.masked_payer_id',
  'authentication.new_account.status',
  'authentication.new_account.verified_by',
  'authentication.new_account.validated_at',
  'authentication.old_account.status',
  'authentication.old_account.verified_by',
  'authentication.old_account.validated_at',
  'marketplace_review.status',
  'marketplace_review.decision',
  'cooling_off.status',
  'cooling_off.ends_at',
  'payout_control.proposed_destination_usable',
  'payout_control.hold_reason',
  'ai_assessment.status',
  'ai_assessment.reason_category',
  'ai_assessment.risk_signals',
  'ai_assessment.missing_information',
  'ai_assessment.recommendation',
  'ai_assessment.advisory_only',
  'policy.decision',
  'policy.reason_codes',
  'policy.may_activate_proposed_destination',
  'audit_trail',
  'version',
];

describe('Schema Explorer & Documentation Completeness (BRIEF § 10.3)', () => {
  it('Every schema field has a short comment and trust classification', () => {
    for (const fieldPath of REQUIRED_SCHEMA_FIELDS) {
      const fieldDoc = SCHEMA_FIELD_NOTES[fieldPath];

      // Must be present
      expect(
        fieldDoc,
        `Field "${fieldPath}" is missing from SCHEMA_FIELD_NOTES in schemaNotes.ts`
      ).toBeDefined();

      // Comment must exist and not be empty
      expect(
        fieldDoc.comment,
        `Field "${fieldPath}" must have a non-empty comment`
      ).toBeTruthy();

      // Word count budget: max 12 words
      const wordCount = fieldDoc.comment.trim().split(/\s+/).length;
      expect(
        wordCount,
        `Comment for "${fieldPath}" has ${wordCount} words; maximum allowed is 12`
      ).toBeLessThanOrEqual(12);

      // Trust level must be defined and valid
      expect(['backend', 'untrusted', 'advisory', 'masked']).toContain(
        fieldDoc.trust
      );
    }
  });

  it('No raw credentials or unmasked fields are documented or permitted', () => {
    // Assert raw payer_id or secrets are NOT schema fields
    expect(SCHEMA_FIELD_NOTES['payer_id']).toBeUndefined();
    expect(SCHEMA_FIELD_NOTES['new_payer_id']).toBeUndefined();
    expect(SCHEMA_FIELD_NOTES['password']).toBeUndefined();
    expect(SCHEMA_FIELD_NOTES['token']).toBeUndefined();
  });
});
