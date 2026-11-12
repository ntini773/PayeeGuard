import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronRight, Clock3, Fingerprint, LockKeyhole, ScanLine, ShieldCheck } from 'lucide-react';
import { useMotion } from '../../context/MotionContext';
import { PayoutIllustration } from './PayoutIllustration';
import { BuiltWithLogos } from './BuiltWithLogos';
import styles from '../../styles/landing.module.css';

const chapters = [
  { title: 'A request, not a reroute.', label: 'Request', description: 'The seller asks to change their payout account. Their current approved destination stays on file. The proposed account starts pending.', detail: 'Current destination retained', icon: Fingerprint },
  { title: 'Evidence over explanations.', label: 'Verify', description: 'PayPal authenticates the accounts. The marketplace checks entitlement and recovery evidence. AI can help investigate; it cannot turn a claim into proof.', detail: 'Authentication is supporting evidence', icon: ScanLine },
  { title: 'Time to catch a bad change.', label: 'Wait', description: 'An authorized change enters the configured cooling-off period. New risk or stale evidence can send it back for review. The server keeps time.', detail: 'Proposed destination remains inactive', icon: Clock3 },
  { title: 'The gate has the final word.', label: 'Activate', description: 'After the waiting period and a fresh policy check, the backend activates the approved destination. The payout path reads that stored destination only.', detail: 'Stored, approved destination only', icon: ShieldCheck },
];

const scenarios = [
  { title: 'A compromised session', category: 'The attack', quote: '“I have a new PayPal account. Please send my earnings there.”', description: 'A valid login to account B proves control of B. It does not prove the account is entitled to the seller’s earnings.', status: 'Change held', tone: 'held', account: 'A', checks: ['New PayPal account authenticated', 'Marketplace authorization still required', 'Proposed account B remains inactive'] },
  { title: 'Lost account access', category: 'The recovery', quote: '“I can’t access my old account anymore. Can we skip that check?”', description: 'Losing access is a recovery problem, not an approval. Marketplace-controlled evidence and authorized review are still required.', status: 'Recovery review', tone: 'held', account: 'A', checks: ['Recovery claim recorded', 'Marketplace evidence required', 'No automatic activation'] },
  { title: 'Approved, still waiting', category: 'The safeguard', quote: '“The change was approved. Why isn’t the new account active yet?”', description: 'Approval starts the configured cooling-off period. Account B stays inactive while the backend waits and checks for new blocking signals.', status: 'Cooling off', tone: 'cooling', account: 'A', checks: ['Authorization recorded', 'Server-controlled waiting period', 'Proposed account B remains inactive'] },
  { title: 'A completed change', category: 'The outcome', quote: '“All checks are complete. My new account is ready.”', description: 'The deadline has elapsed and policy has been checked again. The backend has activated B as the stored approved destination.', status: 'New destination active', tone: 'active', account: 'B', checks: ['Required evidence accepted', 'Cooling-off complete', 'Destination B activated by the backend'] },
];

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useMotion();
  const [chapter, setChapter] = useState(0);
  const [scenario, setScenario] = useState(0);
  const selected = scenarios[scenario];

  useEffect(() => {
    if (!root.current || !('IntersectionObserver' in window)) return;
    const nodes = root.current.querySelectorAll<HTMLElement>('[data-reveal]');
    const reveal = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        (entry.target as HTMLElement).dataset.visible = 'true';
        reveal.unobserve(entry.target);
      }
    }), { threshold: 0, rootMargin: '0px 0px -30px 0px' });
    if (!reducedMotion) nodes.forEach((node) => { node.dataset.visible = 'false'; reveal.observe(node); });
    else nodes.forEach((node) => { node.dataset.visible = 'true'; });
    return () => { reveal.disconnect(); nodes.forEach((node) => { delete node.dataset.visible; }); };
  }, [reducedMotion]);

  useEffect(() => {
    if (!root.current || !('IntersectionObserver' in window)) return;
    const nodes = [...root.current.querySelectorAll<HTMLElement>('[data-chapter]')];
    const desktop = window.matchMedia('(min-width: 701px)');
    const observer = new IntersectionObserver(() => {
      // Read current geometry: queued entries may describe an earlier scroll position.
      const focus = window.innerHeight * 0.45;
      const nearest = nodes.reduce((best, node) => {
        const distance = (item: HTMLElement) => {
          const rect = item.getBoundingClientRect();
          return Math.abs(rect.top + rect.height / 2 - focus);
        };
        return distance(node) < distance(best) ? node : best;
      });
      setChapter(Number(nearest.dataset.chapter));
    }, { rootMargin: '-30% 0px -40% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
    const connect = () => {
      observer.disconnect();
      // Mobile places the illustration after the text; its controls stay local.
      if (desktop.matches) nodes.forEach((node) => observer.observe(node));
    };
    desktop.addEventListener('change', connect);
    connect();
    return () => {
      observer.disconnect();
      desktop.removeEventListener('change', connect);
    };
  }, []);

  const selectChapter = (index: number) => {
    setChapter(index);
    if (window.matchMedia('(min-width: 701px)').matches) {
      root.current?.querySelector(`[data-chapter="${index}"]`)?.scrollIntoView({
        block: 'center', behavior: reducedMotion ? 'instant' : 'smooth',
      });
    }
  };

  return (
    <div ref={root} className={styles.landing}>
      <section className={styles.hero} aria-labelledby="hero-heading">
        <div className={styles.heroEyebrow}><span /> PAYPAL PAYOUT DESTINATION PROTECTION</div>
        <h1 id="hero-heading" className={styles.heroHeading}>
          <span className={styles.textMask}><span>A new account.</span></span>
          <span className={styles.textMask}><span>Not a free pass<span className={styles.headingDot}>.</span></span></span>
        </h1>
        <div className={styles.heroMeta}>
        <p className={styles.heroDescription}>Let sellers change their PayPal account.<br className={styles.desktopBreak} /> Keep control of where marketplace earnings go.</p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryLink} to="/console">Explore the console <ArrowUpRight size={17} aria-hidden="true" /></Link>
          <a className={styles.textLink} href="#the-boundary">See the boundary <ArrowDown size={15} aria-hidden="true" /></a>
        </div>
        </div>
        <div className={styles.heroStage}>
          <div className={styles.stageCaption}><span><span className={styles.statusDot} /> THE AUTHORIZATION BOUNDARY</span><span>ILLUSTRATIVE WORKFLOW · NO PAYMENT EXECUTED</span></div>
          <PayoutIllustration />
          <div className={styles.stageFootnote}><LockKeyhole size={13} aria-hidden="true" /><span>A PayPal login authenticates an account. It doesn’t authorize a destination change.</span></div>
        </div>
        <BuiltWithLogos />
      </section>

      <section id="the-boundary" className={styles.boundary} aria-labelledby="boundary-heading">
        <div className={styles.sectionIntro} data-reveal>
          <span className={styles.eyebrow}>01 / THE PROBLEM BETWEEN THE LOGINS</span>
          <h2 id="boundary-heading">The account is real.<br /><span>The entitlement may not be.</span></h2>
        </div>
        <div className={styles.boundaryGrid}>
          <div className={styles.boundaryCopy} data-reveal>
            <p>An attacker with a stolen marketplace session can connect their own, perfectly valid PayPal account.</p>
            <p>Both logins can succeed. The seller’s earnings still shouldn’t move.</p>
            <a href="#how-it-works" className={styles.textLink}>Meet the missing layer <ArrowDown size={15} aria-hidden="true" /></a>
            <div className={styles.smallNote}>Illustrated attack scenario. Not a claim about fraud prevalence or complete account-takeover protection.</div>
          </div>
          <div className={styles.boundaryProof} data-reveal aria-label="Illustration of authentication versus authorization">
            <div className={styles.proofRow}><Fingerprint size={20} /><span>Marketplace session</span><span className={styles.proofSuccess}><Check size={13} /> Signed in</span></div>
            <div className={styles.proofRow}><CheckCheck size={20} /><span>New PayPal account</span><span className={styles.proofSuccess}><Check size={13} /> Authenticated</span></div>
            <div className={styles.proofDivider}><span>THE MISSING QUESTION</span></div>
            <p className={styles.proofQuestion}>Is this account entitled<br />to these earnings?</p>
            <div className={styles.proofHold}><ShieldCheck size={18} /><div><strong>PayeeGuard holds the change.</strong><span>The marketplace must establish authorization.</span></div><LockKeyhole size={16} /></div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.journey} aria-labelledby="journey-heading">
        <div className={styles.journeyIntro} data-reveal>
          <span className={styles.eyebrow}>02 / A CHANGE HAS TO EARN ITS WAY THROUGH</span>
          <h2 id="journey-heading">A little friction.<br /><span>In exactly the right place.</span></h2>
          <p>From a seller’s request to an approved destination,<br className={styles.desktopBreak} /> every step has a different job.</p>
        </div>
        <div className={styles.journeyGrid}>
          <div className={styles.chapterList}>
            {chapters.map((step, index) => (
              <article key={step.label} data-chapter={index} className={`${styles.chapter} ${chapter === index ? styles.currentChapter : ''}`}>
                <span className={styles.chapterNumber}>0{index + 1}</span>
                <div><h3>{step.title}</h3><p>{step.description}</p><span className={styles.chapterDetail}><step.icon size={14} aria-hidden="true" />{step.detail}</span></div>
              </article>
            ))}
          </div>
          <div className={styles.journeyVisual}>
            <div className={styles.journeyVisualTop}><span>DESTINATION CHANGE</span><span>Illustration</span></div>
            <div className={styles.journeyProgress} aria-label={`Illustrated step ${chapter + 1}: ${chapters[chapter].label}`}>
              {chapters.map((step, index) => <button type="button" key={step.label} aria-pressed={chapter === index} aria-label={`Illustrate ${step.label.toLowerCase()} step`} onClick={() => selectChapter(index)} className={index <= chapter ? styles.progressReached : ''}><span>{index < chapter ? <Check size={14} /> : `0${index + 1}`}</span><small>{step.label}</small></button>)}
            </div>
            <div className={styles.journeyAccount} key={chapter}>
              <span className={styles.journeyAccountLetter}>{chapter === 3 ? 'B' : 'A'}</span>
              <span className={styles.journeyAccountLabel}>ACTIVE APPROVED DESTINATION</span>
              <strong>{chapter === 3 ? 'The approved new account.' : 'The current account stays.'}</strong>
              <p>{chapter === 3 ? 'Activated after the deadline and a fresh backend check.' : 'Account B is proposed. It cannot receive through the controlled payout path yet.'}</p>
              <div className={`${styles.journeyStatus} ${chapter === 3 ? styles.journeyComplete : ''}`}>{chapter === 3 ? <Check size={13} /> : <LockKeyhole size={13} />}{chapter === 3 ? 'New destination active' : chapter === 2 ? 'Cooling-off in progress' : 'Proposed destination held'}</div>
            </div>
            <div className={styles.journeyVisualBottom}><ShieldCheck size={14} /><span>Backend policy controls activation. The browser doesn’t.</span></div>
          </div>
        </div>
      </section>

      <section id="scenarios" className={styles.scenarios} aria-labelledby="scenarios-heading">
        <div className={styles.scenarioIntro} data-reveal>
          <span className={styles.eyebrow}>03 / TRY THE BOUNDARY</span>
          <h2 id="scenarios-heading">Different stories.<br /><span>The same guardrails.</span></h2>
          <p>Choose a scenario. See what changes—and what doesn’t.</p>
          <span className={styles.simulationLabel}>Interactive illustration · no backend or payment calls</span>
        </div>
        <div className={styles.scenarioWorkspace} data-reveal>
          <div className={styles.scenarioChoices} aria-label="Illustrative scenarios">
            {scenarios.map((item, index) => <button type="button" key={item.title} aria-pressed={scenario === index} onClick={() => setScenario(index)} className={scenario === index ? styles.scenarioSelected : ''}><span>0{index + 1}</span>{item.title}<ChevronRight size={15} aria-hidden="true" /></button>)}
          </div>
          <div className={styles.scenarioResult} aria-live="polite" aria-atomic="true">
            <div key={scenario} className={styles.scenarioResultContent}>
              <div className={styles.resultHeader}><span>{selected.category}</span><span className={`${styles.resultStatus} ${selected.tone === 'active' ? styles.resultActive : ''}`}><span />{selected.status}</span></div>
              <blockquote>{selected.quote}</blockquote>
              <p>{selected.description}</p>
              <div className={styles.resultChecklist}>{selected.checks.map((check) => <span key={check}><Check size={14} aria-hidden="true" />{check}</span>)}</div>
              <div className={styles.resultDestination}><span>Active approved destination</span><strong>Account {selected.account}<ArrowRight size={17} aria-hidden="true" /></strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.roles} aria-labelledby="roles-heading">
        <div className={styles.rolesIntro} data-reveal><span className={styles.eyebrow}>04 / CLEAR LINES OF RESPONSIBILITY</span><h2 id="roles-heading">Intelligence helps.<br /><span>Authority stays explicit.</span></h2></div>
        <div className={styles.rolesGrid} data-reveal>
          <article><span className={styles.roleIndex}>01 / AI</span><h3>Investigates.</h3><p>Interprets seller explanations, surfaces advisory signals, and asks follow-up questions.</p><span>Never approves or moves money.</span></article>
          <article><span className={styles.roleIndex}>02 / MARKETPLACE</span><h3>Authorizes.</h3><p>Owns entitlement, trusted evidence, deterministic policy, and authorized review where required.</p><span>Never trusts a claim as proof.</span></article>
          <article><span className={styles.roleIndex}>03 / PAYPAL</span><h3>Authenticates.<br />Executes.</h3><p>Authenticates PayPal accounts and executes payouts submitted through the controlled backend path.</p><span>Never replaced by an AI decision.</span></article>
        </div>
        <div className={styles.boundaryNote} data-reveal><ShieldCheck size={20} aria-hidden="true" /><p>PayeeGuard controls the marketplace payout path wired through its gate. It doesn’t freeze funds held by PayPal or protect payout paths that bypass it.</p><Link to="/how-it-works">Explore the architecture <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      </section>

      <section className={styles.closing} data-reveal aria-labelledby="closing-heading">
        <span className={styles.eyebrow}>SEE THE GUARDRAILS IN ACTION</span>
        <h2 id="closing-heading">Let the account change.<br /><span>Keep the trust.</span></h2>
        <div className={styles.closingLinks}><Link className={styles.primaryLink} to="/console">Open operator console <ArrowUpRight size={17} aria-hidden="true" /></Link><Link className={styles.textLink} to="/seller">Explore the seller flow <ArrowRight size={16} aria-hidden="true" /></Link></div>
        <p>Hackathon prototype. PayPal sandbox. Marketplace risk signals are simulated.</p>
      </section>
    </div>
  );
}
