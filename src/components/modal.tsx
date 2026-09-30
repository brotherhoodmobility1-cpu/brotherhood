"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

let openCount = 0;

/**
 * Popup shown in front of the screen (never inside the page), so it always appears where you are.
 * On phones it slides up from the bottom. The phone's Back button closes it.
 */
export default function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    openCount++;
    document.body.style.overflow = "hidden";
    const id = Math.random().toString(36).slice(2);
    let byBack = false;
    try { history.pushState({ ...(history.state ?? {}), bmModal: id }, ""); } catch { /* ignore */ }
    const onPop = () => { byBack = true; closeRef.current(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      openCount = Math.max(0, openCount - 1);
      if (!openCount) document.body.style.overflow = "";
      if (!byBack && history.state?.bmModal === id) { try { history.back(); } catch { /* ignore */ } }
    };
  }, [open]);

  if (!open || !mounted) return null;
  return createPortal(
    <div id="modal" className="on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="box" role="dialog" aria-modal="true">
        <button className="mclose" aria-label="Close" onClick={onClose}>✕</button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
