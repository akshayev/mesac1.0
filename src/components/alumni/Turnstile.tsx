/**
 * Cloudflare Turnstile widget (spam check) for the public alumni form. The script is loaded only on that
 * page; the site key comes from the server. The token it produces is checked on the server.
 */
import { useEffect, useRef, useState } from "react";

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function useTurnstileApi(): TurnstileApi | null {
  const [api, setApi] = useState<TurnstileApi | null>(null);
  useEffect(() => {
    if (window.turnstile) return setApi(window.turnstile);
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
    const ready = () => window.turnstile && setApi(window.turnstile);
    script.addEventListener("load", ready);
    return () => script?.removeEventListener("load", ready);
  }, []);
  return api;
}

export function Turnstile({
  siteKey,
  onToken,
  resetSignal,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  /** Change this number to get a fresh check (a token can be used only once). */
  resetSignal: number;
}) {
  const api = useTurnstileApi();
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const tokenRef = useRef(onToken);
  tokenRef.current = onToken;

  useEffect(() => {
    if (!api || !box.current || widget.current) return;
    widget.current = api.render(box.current, {
      sitekey: siteKey,
      theme: "dark",
      callback: (t: string) => tokenRef.current(t),
      "expired-callback": () => tokenRef.current(""),
      "error-callback": () => tokenRef.current(""),
    });
    return () => {
      if (widget.current) api.remove(widget.current);
      widget.current = null;
    };
  }, [api, siteKey]);

  useEffect(() => {
    if (resetSignal > 0 && api && widget.current) {
      tokenRef.current("");
      api.reset(widget.current);
    }
  }, [resetSignal, api]);

  return (
    <div>
      <div ref={box} className="min-h-[65px]" />
      {!api && <p className="text-[11px] text-muted-foreground">Loading the spam check…</p>}
    </div>
  );
}
