"use strict";

/*
 * LingoLearn BN — popup stylesheet.
 * A plain CSS string (not a file) so the popup controller can inject it into
 * the shadow root via constructable stylesheets, which keeps it isolated from
 * the host page and immune to the page's CSP.
 */

const LL_POPUP_STYLES = `
  :host { all: initial; }

  .ll-card {
    --ll-bg: #ffffff;
    --ll-fg: #1f2430;
    --ll-muted: #6a7188;
    --ll-border: rgba(15, 23, 42, 0.10);
    --ll-accent: #6a5cf5;
    --ll-accent-weak: #efedfe;
    --ll-chip: #f3f4fa;
    --ll-danger: #b3261e;

    position: fixed;
    left: 0;
    top: 0;
    min-width: 190px;
    max-width: min(360px, calc(100vw - 16px));
    max-height: min(340px, 50vh);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--ll-bg);
    color: var(--ll-fg);
    border: 1px solid var(--ll-border);
    border-radius: 12px;
    box-shadow: 0 4px 10px rgba(2, 6, 23, 0.08), 0 16px 40px rgba(2, 6, 23, 0.16);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", "Nirmala UI", Vrinda, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    text-align: left;
    pointer-events: auto;
    user-select: none;
    opacity: 0;
    transform: translateY(6px) scale(0.97);
    visibility: hidden;
    transition: opacity 0.14s ease-out, transform 0.14s ease-out, visibility 0s linear 0.15s;
  }

  .ll-card.ll-visible {
    opacity: 1;
    transform: none;
    visibility: visible;
    transition: opacity 0.14s ease-out, transform 0.14s ease-out, visibility 0s;
  }

  :host([data-ll-theme="dark"]) .ll-card {
    --ll-bg: #1b1e29;
    --ll-fg: #e9ebf4;
    --ll-muted: #9aa2bb;
    --ll-border: rgba(255, 255, 255, 0.10);
    --ll-accent: #a08fff;
    --ll-accent-weak: #2b2847;
    --ll-chip: #262a38;
    --ll-danger: #ff9089;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35), 0 18px 48px rgba(0, 0, 0, 0.45);
  }

  .ll-card * { box-sizing: border-box; margin: 0; padding: 0; font: inherit; }

  .ll-head {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 7px 7px 12px;
    border-bottom: 1px solid var(--ll-border);
  }

  .ll-lang {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ll-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ll-tools { display: flex; gap: 2px; flex: none; }

  .ll-btn {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--ll-muted);
    width: 26px;
    height: 26px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: background-color 0.12s, color 0.12s;
  }
  .ll-btn:hover { background: var(--ll-chip); color: var(--ll-fg); }
  .ll-btn:focus-visible { outline: 2px solid var(--ll-accent); outline-offset: 1px; }
  .ll-btn svg { width: 15px; height: 15px; fill: currentColor; }
  .ll-btn[hidden] { display: none !important; }

  .ll-speak.ll-active { color: var(--ll-accent); background: var(--ll-accent-weak); }
  .ll-speak.ll-active svg { animation: ll-pulse 1.1s ease-in-out infinite; }
  @keyframes ll-pulse { 50% { transform: scale(1.18); } }

  .ll-body {
    padding: 10px 12px 12px;
    overflow: auto;
    overscroll-behavior: contain;
  }

  .ll-view[hidden] { display: none !important; }

  .ll-view-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--ll-muted);
    font-size: 13px;
  }

  .ll-spinner {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--ll-chip);
    border-top-color: var(--ll-accent);
    animation: ll-spin 0.7s linear infinite;
  }
  @keyframes ll-spin { to { transform: rotate(360deg); } }

  .ll-meaning {
    font-size: 16px;
    line-height: 1.55;
    word-break: break-word;
  }

  .ll-note { margin-top: 6px; font-size: 11.5px; color: var(--ll-muted); }

  .ll-roman { margin-top: 6px; font-size: 12.5px; font-style: italic; color: var(--ll-muted); }

  .ll-ipa { margin-top: 5px; font-size: 12px; color: var(--ll-muted); }

  .ll-dict {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .ll-dict-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ll-pos { flex: none; font-size: 11.5px; font-style: italic; color: var(--ll-muted); }

  .ll-terms { display: flex; flex-wrap: wrap; gap: 4px; }

  .ll-term {
    background: var(--ll-chip);
    border-radius: 6px;
    padding: 2px 8px;
    font-size: 13px;
  }

  .ll-view-error {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: var(--ll-danger);
    font-size: 13px;
  }

  .ll-error-icon { flex: none; }
  .ll-error-icon svg { display: block; width: 14px; height: 14px; fill: currentColor; margin-top: 2px; }

  .ll-foot {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 12px 6px;
    border-top: 1px solid var(--ll-border);
  }

  .ll-gt {
    appearance: none;
    background: transparent;
    border: 0;
    padding: 2px 3px;
    color: var(--ll-muted);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    font-family: inherit;
  }
  .ll-gt svg { width: 13px; height: 13px; fill: currentColor; }
  .ll-gt:hover { color: var(--ll-accent); }
  .ll-gt:focus-visible { outline: 2px solid var(--ll-accent); outline-offset: 2px; border-radius: 3px; }

  .ll-foot a {
    color: var(--ll-muted);
    text-decoration: none;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    transition: color 0.12s;
  }
  .ll-foot a:hover { color: var(--ll-accent); }
  .ll-foot a:focus-visible { outline: 2px solid var(--ll-accent); outline-offset: 2px; border-radius: 3px; }

  @media (prefers-reduced-motion: reduce) {
    .ll-card { transition: none; }
    .ll-speak.ll-active svg { animation: none; }
    .ll-spinner { animation-duration: 1.4s; }
  }
`;
