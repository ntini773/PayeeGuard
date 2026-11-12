import React, { useState, useRef, useEffect } from 'react';
import type { DestinationChangeCase } from '../../types/case';
import { Button } from '../common/Button';
import {
  Send,
  Bot,
  User,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  Eye,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import styles from '../../styles/chatConsole.module.css';

interface Message {
  id: string;
  sender: 'seller' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  toolActivity?: string[];
  deniedTool?: string;
  suggestions?: string[];
}

interface Props {
  caseData: DestinationChangeCase;
  isStale?: boolean;
}

export function ChatConsole({ caseData, isStale = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'seller',
      text: caseData.reason.seller_text,
      timestamp: caseData.created_at,
    },
    {
      id: 'm2',
      sender: 'assistant',
      text: `Case evaluation summary: Detected reason "${caseData.reason.category_claimed_by_seller}". Recommendation: ${caseData.ai_assessment?.recommendation || 'CONTINUE_REQUIRED_VERIFICATION'}.`,
      timestamp: caseData.updated_at,
      toolActivity: ['Read case status', 'Read seller claim'],
      suggestions: [
        'Can you provide documentation for the new PayPal account?',
        'Do you still have access to the old account recovery email?',
        'Is this account owned by the same business entity?',
      ],
    },
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (textToSend?: string) => {
    const content = textToSend || input;
    if (!content.trim()) return;

    const userMsg: Message = {
      id: `m_${Date.now()}`,
      sender: 'seller',
      text: content.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');

    // Simulate AI response with read-only tool activity
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const reply: Message = {
        id: `m_${Date.now() + 1}`,
        sender: 'assistant',
        text: 'Extracted seller statement. Evidence remains pending PayPal callback validation. Reminding that assistant output cannot approve changes or release payout holds.',
        timestamp: new Date().toISOString(),
        toolActivity: ['Read seller messages', 'Query case audit history'],
        suggestions: [
          'Authenticate with proposed PayPal account',
          'Contact marketplace support for manual recovery',
        ],
      };
      setMessages((prev) => [...prev, reply]);
    }, 1100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.chatContainer}>
      {/* Safety Banner */}
      <div className={styles.safetyBanner} role="note">
        <ShieldAlert size={14} className={styles.safetyIcon} aria-hidden="true" />
        <span>
          <strong>Advisory only:</strong> The assistant helps investigate seller claims. It cannot approve, activate or move money.
        </span>
      </div>

      {/* Stale State Banner */}
      {isStale && (
        <div className={styles.staleBanner} role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>Assessment out of date: Case state changed. Please re-run investigation.</span>
        </div>
      )}

      {/* Unavailable State */}
      {isUnavailable && (
        <div className={styles.unavailableBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={15} />
            <span>Assistant unavailable: Case remains restricted under default payout hold.</span>
          </div>
          <Button
            variant="quiet"
            size="sm"
            icon={<RefreshCw size={12} />}
            onClick={() => setIsUnavailable(false)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Messages Feed */}
      <div className={styles.messagesFeed} role="log" aria-live="polite" aria-label="Investigation Conversation">
        {messages.map((msg) => {
          const isSeller = msg.sender === 'seller';
          const isAssistant = msg.sender === 'assistant';

          return (
            <div
              key={msg.id}
              className={`${styles.messageWrapper} ${isSeller ? styles.sellerAlign : styles.assistantAlign}`}
            >
              <div className={styles.avatarRow}>
                {isSeller ? (
                  <>
                    <span className={styles.senderName}>Seller</span>
                    <span className={styles.untrustedPill}>Seller says</span>
                    <div className={styles.avatarSeller} aria-hidden="true">
                      <User size={13} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.avatarAssistant} aria-hidden="true">
                      <Bot size={14} />
                    </div>
                    <span className={styles.senderName}>Investigation Assistant</span>
                    <span className={styles.advisoryPill}>Advisory</span>
                  </>
                )}
              </div>

              {/* Tool Activity Line */}
              {msg.toolActivity && msg.toolActivity.length > 0 && (
                <div className={styles.toolActivityLine} aria-label="Assistant tool activity">
                  <Eye size={12} className={styles.toolIcon} aria-hidden="true" />
                  {msg.toolActivity.map((tool, i) => (
                    <span key={i} className={styles.toolPill}>
                      <span className={styles.activeDot} />
                      {tool}
                    </span>
                  ))}
                  {msg.deniedTool && (
                    <span className={styles.deniedPill}>Blocked: not allowed</span>
                  )}
                </div>
              )}

              {/* Bubble */}
              <div className={`${styles.bubble} ${isSeller ? styles.sellerBubble : styles.assistantBubble}`}>
                <p className={styles.bubbleText}>{msg.text}</p>
              </div>

              {/* Tappable suggestion chips */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className={styles.suggestionsContainer}>
                  <span className={styles.suggestionsPrompt}>
                    <Sparkles size={11} aria-hidden="true" /> Suggested follow-ups:
                  </span>
                  <div className={styles.suggestionsList}>
                    {msg.suggestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        className={styles.suggestionChip}
                        onClick={() => handleSend(sug)}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className={styles.typingIndicator} aria-label="Assistant is analyzing">
            <Bot size={13} aria-hidden="true" />
            <span>Assistant is retrieving read-only context…</span>
            <span className={styles.dotPulse} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className={styles.composerArea}>
        <div className={styles.composerWrapper}>
          <textarea
            className={styles.textarea}
            placeholder="Type a message or follow-up question (Enter to send, Shift+Enter for new line)…"
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            aria-label="Case inquiry message"
          />
          <div className={styles.composerFooter}>
            <span className={styles.charCount}>{input.length} / 1000</span>
            <Button
              variant="primary"
              size="sm"
              icon={<Send size={13} />}
              onClick={() => handleSend()}
              disabled={!input.trim()}
              disabledReason={!input.trim() ? 'Enter text to send message' : undefined}
            >
              Send
            </Button>
          </div>
        </div>
        <p className={styles.composerHint}>
          Messages are appended to case investigation history. The assistant cannot approve changes.
        </p>
      </div>
    </div>
  );
}
