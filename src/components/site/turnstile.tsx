"use client";

import Script from "next/script";

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

/** Asks Cloudflare for a fresh challenge. A token works once, so call this after every submit. */
export function resetTurnstile() {
  window.turnstile?.reset();
}

/**
 * Cloudflare Turnstile in its implicit mode: the script finds this div and adds a hidden
 * `cf-turnstile-response` field to the surrounding form. Usually invisible; it only shows a
 * checkbox when it cannot decide on its own.
 */
export function Turnstile({ siteKey }: { siteKey: string }) {
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="auto" />
    </>
  );
}
