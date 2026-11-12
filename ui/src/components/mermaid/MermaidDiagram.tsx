import React, { useEffect, useRef, useState, useId } from 'react';
import { Code, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { useMotion } from '../../context/MotionContext';
import styles from '../../styles/mermaid.module.css';

// Mermaid keeps global state, so two render() calls at the same time can return an empty SVG.
// Run every render one after another through this queue.
let renderQueue: Promise<unknown> = Promise.resolve();
let renderCounter = 0; // a new element id per render, because React StrictMode runs effects twice
function enqueueRender<T>(task: () => Promise<T>): Promise<T> {
  const run = renderQueue.then(task, task);
  renderQueue = run.catch(() => undefined);
  return run;
}

interface Props {
  source: string;
  ariaLabel: string;
  title?: string;
}

export function MermaidDiagram({ source, ariaLabel, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const uniqueId = useId().replace(/:/g, '_');
  const { reducedMotion } = useMotion();

  useEffect(() => {
    let isMounted = true;

    async function renderDiagram() {
      try {
        const mermaid = (await import('mermaid')).default;
        // Mermaid measures label text when it renders. Measuring with a fallback font clips the
        // labels, so wait for the web fonts first.
        if (typeof document !== 'undefined' && document.fonts) {
          await Promise.race([
            Promise.all([document.fonts.load('13px Geist'), document.fonts.ready]),
            new Promise((resolve) => setTimeout(resolve, 3000)),
          ]);
        }

        const svg = await enqueueRender(async () => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: {
            darkMode: false,
            background: '#f8f8f2',
            primaryColor: '#edf2e6',
            primaryTextColor: '#1b2b20',
            primaryBorderColor: '#68805a',
            lineColor: '#68805a',
            secondaryColor: '#f8f8f2',
            tertiaryColor: '#edf2e6',
            fontFamily: 'Geist, sans-serif',
            fontSize: 'var(--text-xs)',
            edgeLabelBackground: '#f8f8f2',
            labelBackground: '#f8f8f2',
            noteBkgColor: '#edf2e6',
            noteTextColor: '#4d673c',
            noteBorderColor: '#cdd7c3',
            actorBkg: '#edf2e6',
            actorBorder: '#68805a',
            actorTextColor: '#1b2b20',
            signalColor: '#68805a',
            signalTextColor: '#1b2b20',
          },
        });

        renderCounter += 1;
        const id = `mermaid_${uniqueId}_${renderCounter}`;
        const cleanSource = source.trim();
        const out = await mermaid.render(id, cleanSource);
        if (!out.svg || !out.svg.includes('<svg')) throw new Error('Mermaid returned an empty diagram');
        return out.svg;
        });

        if (isMounted) {
          setSvgHtml(svg);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Unknown diagram render error';
          setError(message);
        }
      }
    }

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [source, uniqueId, reducedMotion]);

  const handleCopy = () => {
    navigator.clipboard.writeText(source.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.wrapper}>
      {title && (
        <div className={styles.titleBar}>
          <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
            {title}
          </strong>
          <span className={styles.repoAuthTag}>REPO-AUTHORED SPEC</span>
        </div>
      )}

      {error ? (
        <div className={styles.errorBox} role="alert">
          <p>Unable to render Mermaid diagram dynamically:</p>
          <pre className={styles.errorPre}>{error}</pre>
          <p style={{ marginTop: 8 }}>Raw source:</p>
          <pre className={styles.sourcePre}>{source}</pre>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={styles.svgContainer}
          role="img"
          aria-label={ariaLabel}
          aria-busy={!svgHtml}
          data-rendered={svgHtml ? 'true' : 'false'}
        >
          {svgHtml ? (
            // Safe: the source is repo-authored (diagrams.ts) and Mermaid runs with securityLevel 'strict'.
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: svgHtml }} />
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>Rendering diagram…</p>
          )}
        </div>
      )}

      {/* Accessible collapsible source drawer */}
      <div className={styles.sourceDrawer}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            className={styles.sourceToggleBtn}
            onClick={() => setShowSource(!showSource)}
            aria-expanded={showSource}
          >
            {showSource ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Code size={13} />
            <span>Diagram Source Code</span>
          </button>

          {showSource && (
            <button
              type="button"
              className={styles.copyBtn}
              onClick={handleCopy}
              aria-label="Copy Mermaid source"
            >
              {copied ? <Check size={12} style={{ color: 'var(--ok)' }} /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>

        {showSource && (
          <pre className={styles.sourceCodeBlock}>
            <code>{source.trim()}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
