import { useState } from 'react';
import type { DestinationChangeCase } from '../../types/case';
import { DecisionCardHero } from './DecisionCardHero';
import { DestinationPairVisual } from './DestinationPairVisual';
import { CoolingOffRing } from './CoolingOffRing';
import { EvidenceAndPolicyTab } from './EvidenceAndPolicyTab';
import { SellerAndAiTab } from './SellerAndAiTab';
import { CompactAuditDrawer } from './CompactAuditDrawer';
import { lazy, Suspense } from 'react';
const AuditGrid = lazy(() => import('./AuditGrid').then((m) => ({ default: m.AuditGrid })));
import { FlowGraph } from '../flow/FlowGraph';
import { ChatConsole } from '../chat/ChatConsole';
import { StickyActionBar } from './StickyActionBar';
import { EvidenceForm } from './EvidenceForm';
import { PayoutsPanel } from './PayoutsPanel';
import { JourneyStepper } from './JourneyStepper';
import { AiInlineCard } from './AiInlineCard';
import { submitReview } from '../../api/client';
import { Button } from '../common/Button';
import {
  ArrowLeft,
  FileCheck2,
  Bot,
  GitGraph,
  MessageSquare,
  History,
  Wallet,
} from 'lucide-react';
import styles from '../../styles/detail.module.css';

interface Props {
  caseData: DestinationChangeCase;
  onBack?: () => void;
  onRefresh?: () => void;
  backendMode?: string;
}

type DetailTab = 'evidence' | 'seller_ai' | 'payouts' | 'flow' | 'chat' | 'audit';

export function CaseDetail({ caseData, onBack, onRefresh, backendMode }: Props) {
  const [activeTab, setActiveTab] = useState<DetailTab>('evidence');
  const [auditView, setAuditView] = useState<'grid' | 'timeline'>('grid');

  // The backend decides. This only sends the operator's choice and reports what came back.
  const handleDecisionSubmitted = (
    decision: 'APPROVE' | 'REJECT',
    reason: string,
    version: number
  ) => submitReview(caseData.case_id, decision, reason, version);

  return (
    <div className={styles.detailContainer} id="case-detail-pane">
      {/* Top Bar Navigation */}
      <div className={styles.topNav}>
        {onBack && (
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowLeft size={14} />}
            onClick={onBack}
            aria-label="Back to destination change queue"
          >
            Back to Queue
          </Button>
        )}

        <div className={styles.caseBreadcrumb}>
          <span className={styles.caseMuted}>Destination Change Cases /</span>
          <strong className={styles.caseHighlight}>{caseData.case_id}</strong>
          <span className={styles.versionPill}>v{caseData.version}</span>
        </div>
      </div>

      {caseData.load_warnings && caseData.load_warnings.length > 0 && (
        <div role="status" data-testid="load-warning"
          style={{ padding: '10px 14px', marginBottom: 'var(--space-4)', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--sky)', color: 'var(--text)', fontSize: 'var(--text-sm)' }}>
          The backend could not return: {caseData.load_warnings.join(', ')}. The case is shown with what it did return.
        </div>
      )}

      {/* ZONE 1: What is happening */}
      <section className={styles.zoneWhat} aria-label="Zone 1: What is happening">
        <DecisionCardHero caseData={caseData} />

        <div style={{ marginTop: 'var(--space-5)' }}>
          <DestinationPairVisual caseData={caseData} />
        </div>

        <JourneyStepper caseData={caseData} />
        <AiInlineCard caseData={caseData} onRefresh={onRefresh} mode={backendMode} />

        {caseData.cooling_off.status === 'ACTIVE' && (
          <CoolingOffRing endsAt={caseData.cooling_off.ends_at} />
        )}
      </section>

      {/* ZONE 2: Why (Progressive Disclosure Tabs) */}
      <section className={styles.zoneWhy} aria-label="Zone 2: Why this state exists">
        <div className={styles.tabList} role="tablist" aria-label="Case Detail Perspectives">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'evidence'}
            aria-controls="panel-evidence"
            id="tab-evidence"
            className={`${styles.tabBtn} ${activeTab === 'evidence' ? styles.activeTabBtn : ''}`}
            onClick={() => setActiveTab('evidence')}
          >
            <FileCheck2 size={15} aria-hidden="true" />
            <span>Evidence & Policy</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'seller_ai'}
            aria-controls="panel-seller-ai"
            id="tab-seller-ai"
            className={`${styles.tabBtn} ${activeTab === 'seller_ai' ? styles.activeTabBtn : ''}`}
            onClick={() => setActiveTab('seller_ai')}
          >
            <Bot size={15} aria-hidden="true" />
            <span>Seller & AI Notes</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-payouts"
            aria-selected={activeTab === 'payouts'}
            aria-controls="panel-payouts"
            className={`${styles.tabBtn} ${activeTab === 'payouts' ? styles.activeTabBtn : ''}`}
            onClick={() => setActiveTab('payouts')}
          >
            <Wallet size={14} aria-hidden="true" />
            <span>Payouts</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'flow'}
            aria-controls="panel-flow"
            id="tab-flow"
            className={`${styles.tabBtn} ${activeTab === 'flow' ? styles.activeTabBtn : ''}`}
            onClick={() => setActiveTab('flow')}
          >
            <GitGraph size={15} aria-hidden="true" />
            <span>Execution Flow</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chat'}
            aria-controls="panel-chat"
            id="tab-chat"
            className={`${styles.tabBtn} ${activeTab === 'chat' ? styles.activeTabBtn : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={15} aria-hidden="true" />
            <span>Messages & Inquiry</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audit'}
            aria-controls="panel-audit"
            id="tab-audit"
            className={`${styles.tabBtn} ${activeTab === 'audit' ? styles.activeTabBtn : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <History size={15} aria-hidden="true" />
            <span>Audit Trail ({caseData.audit_trail.length})</span>
          </button>
        </div>

        {/* Tab Panels */}
        <div className={styles.tabPanelWrapper}>
          {activeTab === 'evidence' && (
            <div id="panel-evidence" role="tabpanel" aria-labelledby="tab-evidence">
              {caseData.state === 'PENDING_REVIEW' && <EvidenceForm caseData={caseData} onRefresh={onRefresh} />}
              <EvidenceAndPolicyTab caseData={caseData} />
              {caseData.state !== 'PENDING_REVIEW' && <EvidenceForm caseData={caseData} onRefresh={onRefresh} />}
            </div>
          )}

          {activeTab === 'seller_ai' && (
            <div id="panel-seller-ai" role="tabpanel" aria-labelledby="tab-seller-ai">
              <SellerAndAiTab caseData={caseData} />
            </div>
          )}

          {activeTab === 'payouts' && (
            <div id="panel-payouts" role="tabpanel" aria-labelledby="tab-payouts">
              <PayoutsPanel caseData={caseData} />
            </div>
          )}

          {activeTab === 'flow' && (
            <div id="panel-flow" role="tabpanel" aria-labelledby="tab-flow">
              <div data-theme="dark" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <FlowGraph caseData={caseData} isLive={true} />
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div id="panel-chat" role="tabpanel" aria-labelledby="tab-chat">
              <ChatConsole caseData={caseData} />
            </div>
          )}

          {activeTab === 'audit' && (
            <div id="panel-audit" role="tabpanel" aria-labelledby="tab-audit">
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }} role="group" aria-label="Audit view">
                <Button variant={auditView === 'grid' ? 'primary' : 'secondary'} size="sm" onClick={() => setAuditView('grid')} aria-pressed={auditView === 'grid'}>Grid</Button>
                <Button variant={auditView === 'timeline' ? 'primary' : 'secondary'} size="sm" onClick={() => setAuditView('timeline')} aria-pressed={auditView === 'timeline'}>Timeline</Button>
              </div>
              {auditView === 'grid'
                ? <Suspense fallback={<p>Loading grid…</p>}><AuditGrid events={caseData.audit_trail} /></Suspense>
                : <CompactAuditDrawer events={caseData.audit_trail} />}
            </div>
          )}
        </div>
      </section>

      {/* ZONE 3: What you can do (Sticky Action Bar) */}
      <StickyActionBar
        caseData={caseData}
        onDecisionSubmitted={handleDecisionSubmitted}
        onRefresh={onRefresh}
        onNeedEvidence={() => setActiveTab('evidence')}
      />
    </div>
  );
}
