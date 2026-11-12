import { useState, useEffect } from 'react';
import { SCHEMA_FIELD_NOTES, type FieldDoc, type TrustClassification } from '../../content/schemaNotes';
import {
  ShieldCheck,
  User,
  Bot,
  EyeOff,
  Info,
  Copy,
  Check,
  Terminal,
  AlertCircle,
  FileCode,
  ArrowRight,
} from 'lucide-react';
import styles from '../../styles/schemaExplorer.module.css';

// Canonical example payload from API_CONTRACT.md § 2
const EXAMPLE_PAYLOAD = {
  case_id: 'chg_demo_0007',
  tenant_id: 'marketplace_demo',
  seller_id: 'seller_demo_0042',
  state: 'PENDING_OLD_ACCOUNT_AUTH',
  created_at: '2026-11-10T12:00:00Z',
  updated_at: '2026-11-10T12:04:00Z',
  reason: {
    seller_text: 'I opened a new PayPal account for my shop.',
    category_claimed_by_seller: 'NEW_ACCOUNT',
  },
  destinations: {
    active: { masked_payer_id: 'PAYER-***-7A21' },
    proposed: { masked_payer_id: 'PAYER-***-9F44' },
  },
  authentication: {
    new_account: { status: 'VALIDATED', verified_by: 'PAYPAL_CALLBACK', validated_at: '2026-11-10T12:02:00Z' },
    old_account: { status: 'PENDING', verified_by: null, validated_at: null },
  },
  marketplace_review: { status: 'NOT_REQUIRED_YET', decision: null },
  cooling_off: { status: 'NOT_STARTED', ends_at: null },
  payout_control: { proposed_destination_usable: false, hold_reason: 'OLD_ACCOUNT_AUTH_REQUIRED' },
  ai_assessment: {
    status: 'AVAILABLE',
    reason_category: 'NEW_ACCOUNT',
    risk_signals: [],
    missing_information: [],
    recommendation: 'CONTINUE_REQUIRED_VERIFICATION',
    advisory_only: true,
  },
  policy: {
    decision: 'REQUIRE_OLD_ACCOUNT_AUTH',
    reason_codes: ['REQUIRE_OLD_ACCOUNT_AUTH'],
    may_activate_proposed_destination: false,
  },
  audit_trail: [
    { event: 'DESTINATION_CHANGE_REQUESTED', actor: 'seller_demo_0042', timestamp: '2026-11-10T12:00:00Z' },
    { event: 'NEW_ACCOUNT_AUTH_VALIDATED', actor: 'paypal_callback', timestamp: '2026-11-10T12:02:00Z' },
  ],
  version: 3,
};

const ENDPOINT_SPECS = [
  {
    method: 'POST',
    path: '/api/v1/destination-change-requests',
    role: 'Authenticated Seller',
    idempotency: 'Required',
    description: 'Create a new change case for the authenticated seller. Holds payouts to proposed B immediately.',
    forbiddenFields: ['payer_id', 'new_payer_id', 'verified', 'approved', 'hold_released'],
    errors: ['400 INVALID_REQUEST', '401 AUTH_REQUIRED', '409 IDEMPOTENCY_CONFLICT'],
  },
  {
    method: 'GET',
    path: '/api/v1/destination-change-requests/{case_id}',
    role: 'Seller or Operator',
    idempotency: 'N/A (Read-only)',
    description: 'Fetch seller-safe case status. Returns backend-masked identifiers and omits internal risk notes.',
    forbiddenFields: [],
    errors: ['401 AUTH_REQUIRED', '403 SCOPE_DENIED', '404 CASE_NOT_FOUND'],
  },
  {
    method: 'POST',
    path: '/api/v1/destination-change-requests/{case_id}/review',
    role: 'Authorized Operator Only',
    idempotency: 'Case Version Guard',
    description: 'Record human authorization decision (APPROVE / REJECT). Requires expected_version & reason. Never exposed to agents.',
    forbiddenFields: ['activate_now', 'skip_cooling_off', 'override_policy'],
    errors: ['401 AUTH_REQUIRED', '403 OPERATOR_ROLE_REQUIRED', '409 CASE_VERSION_CONFLICT'],
  },
];

export function SchemaExplorer() {
  const [showComments, setShowComments] = useState(true);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<FieldDoc | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [highlightedJsonHtml, setHighlightedJsonHtml] = useState<string>('');

  const jsonString = JSON.stringify(EXAMPLE_PAYLOAD, null, 2);

  // Lazy-load Shiki for syntax highlighting
  useEffect(() => {
    let isMounted = true;

    async function highlightCode() {
      try {
        const { codeToHtml } = await import('shiki');
        const html = await codeToHtml(jsonString, {
          lang: 'json',
          theme: 'github-light',
        });
        if (isMounted) {
          setHighlightedJsonHtml(html);
        }
      } catch (e) {
        // Fallback if Shiki fails
        if (isMounted) {
          setHighlightedJsonHtml(`<pre><code>${jsonString}</code></pre>`);
        }
      }
    }

    highlightCode();

    return () => {
      isMounted = false;
    };
  }, [jsonString]);

  const copyPayload = () => {
    navigator.clipboard.writeText(jsonString);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const getTrustBadge = (trust: TrustClassification) => {
    switch (trust) {
      case 'backend':
        return (
          <span className={styles.trustBackend}>
            <ShieldCheck size={11} aria-hidden="true" />
            <span>Backend-verified</span>
          </span>
        );
      case 'untrusted':
        return (
          <span className={styles.trustUntrusted}>
            <User size={11} aria-hidden="true" />
            <span>Seller input (untrusted)</span>
          </span>
        );
      case 'advisory':
        return (
          <span className={styles.trustAdvisory}>
            <Bot size={11} aria-hidden="true" />
            <span>AI advisory</span>
          </span>
        );
      case 'masked':
        return (
          <span className={styles.trustMasked}>
            <EyeOff size={11} aria-hidden="true" />
            <span>Masked</span>
          </span>
        );
    }
  };

  const fieldEntries = Object.entries(SCHEMA_FIELD_NOTES);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.kicker}>API CONTRACT & FIELD SCHEMA</span>
        <h1 className={styles.title}>Case Schema & Endpoint Explorer</h1>
        <p className={styles.sub}>
          Derived directly from <code>docs/API_CONTRACT.md</code>. Field-level trust boundaries, plain-English comments, and contract endpoints.
        </p>
      </div>

      {/* Explorer Grid: Field Tree Left, Shiki JSON Payload Right */}
      <div className={styles.explorerGrid}>
        {/* Left: Field Tree */}
        <div className={styles.treePane}>
          <div className={styles.paneHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileCode size={16} className={styles.iconGold} aria-hidden="true" />
              <strong>Case Representation Schema</strong>
            </div>

            <button
              type="button"
              className={styles.toggleCommentsBtn}
              onClick={() => setShowComments(!showComments)}
              aria-pressed={showComments}
            >
              <span>{showComments ? 'Hide comments' : 'Show comments'}</span>
            </button>
          </div>

          <div className={styles.fieldsList}>
            {fieldEntries.map(([path, doc]) => {
              const isHovered = highlightedField === path;

              return (
                <div
                  key={path}
                  className={`${styles.fieldRow} ${isHovered ? styles.fieldRowHovered : ''}`}
                  onMouseEnter={() => setHighlightedField(path)}
                  onMouseLeave={() => setHighlightedField(null)}
                >
                  <div className={styles.fieldTop}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <code className={styles.fieldName}>{doc.path}</code>
                      <span className={styles.typeBadge}>{doc.type}</span>
                      {doc.required && <span className={styles.requiredMarker} title="Required">*</span>}
                      {getTrustBadge(doc.trust)}
                    </div>

                    <button
                      type="button"
                      className={styles.infoBtn}
                      onClick={() => setActiveDoc(doc)}
                      aria-label={`Details for ${doc.path}`}
                    >
                      <Info size={13} />
                    </button>
                  </div>

                  {/* Inline Plain English Comment */}
                  {showComments && (
                    <div className={styles.commentLine}>
                      <span className={styles.commentSlash}>//</span>
                      <span className={styles.commentText}>{doc.comment}</span>
                    </div>
                  )}

                  {/* Enum Pills if any */}
                  {doc.enumValues && (
                    <div className={styles.enumsRow}>
                      <span className={styles.enumLabel}>Enum:</span>
                      {doc.enumValues.map((val) => (
                        <span key={val} className={styles.enumPill}>{val}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Shiki Highlighted JSON Payload */}
        <div className={styles.payloadPane}>
          <div className={styles.paneHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={16} className={styles.iconSky} aria-hidden="true" />
              <strong>Illustrative JSON Payload</strong>
            </div>

            <button
              type="button"
              className={styles.copyBtn}
              onClick={copyPayload}
              aria-label="Copy JSON payload"
            >
              {copiedPayload ? <Check size={13} style={{ color: 'var(--ok)' }} /> : <Copy size={13} />}
              <span>{copiedPayload ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div
            className={styles.shikiCodeBox}
            dangerouslySetInnerHTML={{ __html: highlightedJsonHtml }}
          />
        </div>
      </div>

      {/* Field Detail Modal / Card if clicked */}
      {activeDoc && (
        <div className={styles.docModal} role="dialog" aria-label="Field details">
          <div className={styles.modalHeader}>
            <div>
              <code style={{ fontSize: 'var(--text-md)', color: '#3fd0ff' }}>{activeDoc.path}</code>
              <div style={{ marginTop: 4 }}>{getTrustBadge(activeDoc.trust)}</div>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setActiveDoc(null)}
              aria-label="Close field details"
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <div>
              <span className={styles.metaLabel}>Short Specification Comment</span>
              <p style={{ color: 'var(--text)', fontSize: 'var(--text-sm)', margin: '2px 0 0' }}>
                {activeDoc.comment}
              </p>
            </div>

            {activeDoc.extendedNote && (
              <div>
                <span className={styles.metaLabel}>Extended Security Note</span>
                <p style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)', margin: '2px 0 0' }}>
                  {activeDoc.extendedNote}
                </p>
              </div>
            )}

            {activeDoc.docRef && (
              <div>
                <span className={styles.metaLabel}>Specification Anchor</span>
                <code style={{ color: 'var(--gold)', fontSize: 'var(--text-xs)' }}>
                  {activeDoc.docRef}
                </code>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request & Response Cards Per Endpoint */}
      <div className={styles.endpointsSection}>
        <div className={styles.endpointsHeader}>
          <h2>HTTPS API Contract Endpoints</h2>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
            Strict request boundary rules: no caller-supplied authentication booleans or payer IDs.
          </p>
        </div>

        <div className={styles.endpointsGrid}>
          {ENDPOINT_SPECS.map((ep, i) => (
            <div key={i} className={styles.endpointCard}>
              <div className={styles.epTop}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={ep.method === 'POST' ? styles.methodPost : styles.methodGet}>
                    {ep.method}
                  </span>
                  <code className={styles.epPath}>{ep.path}</code>
                </div>
                <span className={styles.epRole}>{ep.role}</span>
              </div>

              <p className={styles.epDesc}>{ep.description}</p>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                <span>Idempotency: </span>
                <strong style={{ color: 'var(--text)' }}>{ep.idempotency}</strong>
              </div>

              {/* Red Rejected by Server Box */}
              {ep.forbiddenFields.length > 0 && (
                <div className={styles.rejectedBox}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <AlertCircle size={13} style={{ color: 'var(--bad)' }} aria-hidden="true" />
                    <strong style={{ color: '#f87171', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
                      Rejected by Server
                    </strong>
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: '#fca5a5', margin: '0 0 6px' }}>
                    Caller must NOT provide trusted evidence or approval fields:
                  </p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {ep.forbiddenFields.map((f) => (
                      <code key={f} className={styles.forbiddenTag}>✕ {f}</code>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                  Error Codes:
                </span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {ep.errors.map((err) => (
                    <code key={err} className={styles.errorCodePill}>{err}</code>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
