import { useState, useEffect } from 'react';
import { OperatorDashboard } from '../dashboard/OperatorDashboard';
import type { DestinationChangeCase } from '../../types/case';
import { fetchCases, fetchCase, fetchSession, logout, AuthRequiredError, type SessionInfo } from '../../api/client';
import { USE_MOCK_DATA } from '../../config';
import { LoginPanel } from './LoginPanel';
import { Link } from 'react-router-dom';
import { QueueFilters, useQueueFilter } from '../queue/QueueFilters';
import { QueueTable } from '../queue/QueueTable';
import { QueueAgGrid } from '../queue/QueueAgGrid';
import { CaseDetail } from '../detail/CaseDetail';
import { EmptyState } from '../common/EmptyState';
import { Button } from '../common/Button';
import { RefreshCw, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import styles from '../../styles/queue.module.css';
import journey from '../../styles/journey.module.css';
import { Greeting } from '../common/Greeting';

function OperatorConsoleInner() {
  const [allCases, setAllCases] = useState<DestinationChangeCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulateEmptyQueue, setSimulateEmptyQueue] = useState(false);
  const [viewMode, setViewMode] = useState<'ag-grid' | 'table' | 'dashboard'>('ag-grid');
  const [devDrawerOpen, setDevDrawerOpen] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [detail, setDetail] = useState<DestinationChangeCase | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetchCases()
      .then((data) => {
        setAllCases(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof AuthRequiredError) setAuthRequired(true);
        else setError(err.message);
        setLoading(false);
      });
  };

  const start = () => {
    fetchSession()
      .then((info) => {
        setSession(info);
        if (!info.user) {
          setAuthRequired(true);
          setLoading(false);
          return;
        }
        setAuthRequired(false);
        loadData();
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the full case (detail, summary, audit events) from the backend when one is opened.
  const loadDetail = (id: string) =>
    fetchCase(id).then(setDetail).catch((err) => {
      if (err instanceof AuthRequiredError) setAuthRequired(true);
      else setError(err.message);
    });

  useEffect(() => {
    setDetail(null);
    if (selectedCaseId) void loadDetail(selectedCaseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseId]);

  const refreshAll = () => {
    loadData();
    if (selectedCaseId) void loadDetail(selectedCaseId);
  };

  const casesToDisplay = simulateEmptyQueue ? [] : allCases;

  const {
    filtered,
    search, setSearch,
    stateFilter, setStateFilter,
    sortField, setSortField,
    sortDir, setSortDir,
  } = useQueueFilter(casesToDisplay);

  const selectedCase = detail && detail.case_id === selectedCaseId ? detail : null;

  const handleQuickSelect = (caseId: string) => {
    setSimulateEmptyQueue(false);
    setSelectedCaseId(caseId);
  };

  if (authRequired) {
    return <LoginPanel onSignedIn={() => { setLoading(true); start(); }} />;
  }

  if (!USE_MOCK_DATA && session?.user && session.user.role !== 'operator') {
    return (
      <div className={styles.queuePage}>
        <div role="alert" data-testid="not-an-operator"
          style={{ maxWidth: 640, margin: '48px auto', padding: 'var(--space-5)', border: '1px solid var(--line-dark)', borderRadius: 'var(--radius-md)', display: 'grid', gap: 'var(--space-3)' }}>
          <strong>You are signed in as {session.user.id} ({session.user.role}), not as an operator.</strong>
          <span style={{ color: 'var(--muted)' }}>Operators review requests here. Sellers make requests on the Seller page.</span>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Link to="/seller">Go to the Seller page</Link>
            <Button variant="quiet" size="sm" onClick={() => { void logout().then(() => setAuthRequired(true)); }}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.queuePage}>
      {!USE_MOCK_DATA && session?.user && (
        <Greeting userId={session.user.id} role={session.user.role} line="You review requests here. Only you can approve or reject.">
          <span className={journey.pill} style={{ borderColor: 'var(--gold-accent)', color: 'var(--gold-accent)', fontWeight: 700 }} data-testid="operator-pill">OPERATOR</span>
          <span className={`${journey.pill} ${journey.pillLive}`}>LIVE BACKEND</span>
          <span className={journey.pill}>{session.mode === 'demo' ? 'DEMO · simulated PayPal' : session.mode === 'sandbox' ? 'SANDBOX · real PayPal test accounts' : session.mode}</span>
          <span className={journey.pill}>AI: {session.ai_mode}</span>
          <Button variant="quiet" size="sm"
            onClick={() => { void logout().then(() => { setAllCases([]); setSelectedCaseId(null); setAuthRequired(true); }); }}>
            Sign out
          </Button>
        </Greeting>
      )}
      {/* Dev State Switcher Drawer — neatly organized, not dominating screen */}
      {USE_MOCK_DATA && (
      <div className={styles.devDrawer}>
        <button
          type="button"
          className={styles.devHeader}
          onClick={() => setDevDrawerOpen(!devDrawerOpen)}
          aria-expanded={devDrawerOpen}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Terminal size={14} aria-hidden="true" />
            <span>Developer Target State Views (Simulated Fixtures)</span>
          </span>
          {devDrawerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {devDrawerOpen && (
          <div className={styles.devButtons}>
            <button
              type="button"
              className={styles.devBtn}
              onClick={() => handleQuickSelect('chg_demo_0001')}
            >
              State: Needs Review (Alice)
            </button>
            <button
              type="button"
              className={styles.devBtn}
              onClick={() => handleQuickSelect('chg_demo_0002')}
            >
              State: Cooling-Off (Bob)
            </button>
            <button
              type="button"
              className={styles.devBtn}
              onClick={() => handleQuickSelect('chg_demo_0003')}
            >
              State: Rejected (Carol)
            </button>
            <button
              type="button"
              className={styles.devBtn}
              onClick={() => handleQuickSelect('chg_demo_0004')}
            >
              State: Held Pending Old Auth
            </button>
            <button
              type="button"
              className={styles.devBtn}
              onClick={() => handleQuickSelect('chg_demo_0005')}
            >
              State: Approved & Active
            </button>
            <button
              type="button"
              className={styles.devBtn}
              onClick={() => handleQuickSelect('chg_demo_0006')}
            >
              State: Expired
            </button>
            <button
              type="button"
              className={styles.devBtn}
              onClick={() => {
                setSelectedCaseId(null);
                setSimulateEmptyQueue(!simulateEmptyQueue);
              }}
            >
              {simulateEmptyQueue ? 'Restore Queue' : 'Simulate Empty Queue'}
            </button>
          </div>
        )}
      </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 18px',
            background: 'rgba(217, 54, 62, 0.15)',
            border: '1px solid var(--bad)',
            color: 'var(--bad-text)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {selectedCase ? (
        <CaseDetail
          caseData={selectedCase}
          onBack={() => setSelectedCaseId(null)}
          onRefresh={refreshAll}
          backendMode={session?.mode}
        />
      ) : (
        <>
          <div className={styles.pageHeader}>
            <div>
              <h1>Destination Change Queue</h1>
              <p className={styles.count}>
                {filtered.length} {filtered.length === 1 ? 'case' : 'cases'} in operator review queue
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div className={styles.viewModeToggle}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${viewMode === 'table' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('table')}
                  aria-pressed={viewMode === 'table'}
                >
                  Table
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${viewMode === 'ag-grid' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('ag-grid')}
                  aria-pressed={viewMode === 'ag-grid'}
                >
                  AG Grid
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${viewMode === 'dashboard' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('dashboard')}
                  aria-pressed={viewMode === 'dashboard'}
                >
                  Dashboard
                </button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={13} />}
                onClick={loadData}
                loading={loading}
              >
                Refresh
              </Button>
            </div>
          </div>

          <QueueFilters
            search={search}
            onSearchChange={setSearch}
            stateFilter={stateFilter}
            onStateFilterChange={setStateFilter}
            sortField={sortField}
            onSortFieldChange={setSortField}
            sortDir={sortDir}
            onSortDirChange={setSortDir}
          />

          {viewMode === 'dashboard' && !loading ? (
            <OperatorDashboard cases={allCases} />
          ) : loading ? (
            <div style={{ padding: '64px', textAlign: 'center', color: 'var(--muted)' }}>
              <div className={styles.spinner} style={{ margin: '0 auto 12px' }} />
              <p>Loading operator review queue…</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : viewMode === 'ag-grid' ? (
            <QueueAgGrid
              cases={filtered}
              selectedId={selectedCaseId}
              onSelect={(id) => setSelectedCaseId(id)}
            />
          ) : (
            <QueueTable
              cases={filtered}
              selectedId={selectedCaseId}
              onSelect={(id) => setSelectedCaseId(id)}
            />
          )}
        </>
      )}
    </div>
  );
}

/** The operator side is whiteish gold, so it is obvious which kind of account is signed in. The seller side stays navy. */
export function OperatorConsole() {
  return (
    <div data-theme="operator" data-testid="operator-shell">
      <OperatorConsoleInner />
    </div>
  );
}
