"use client";

import { ArrowUp, Sparkles } from "lucide-react";

const MODES = ["Query", "Action", "Create", "Automate"] as const;

export function AIBar() {
  return (
    <div className="relative w-full">
      {/* Ambient orange glow bloom */}
      <div className="pointer-events-none absolute inset-x-8 -bottom-2 h-10 rounded-full bg-brand-400/25 blur-2xl" />
      <div className="pointer-events-none absolute inset-x-16 bottom-0 h-6 rounded-full bg-brand-500/20 blur-xl" />

      {/* Bar */}
      <div className="relative flex h-[52px] items-center gap-3 rounded-2xl border border-brand-200/80 bg-background px-4 shadow-[0_0_0_4px_rgba(249,115,22,0.06),0_4px_20px_rgba(249,115,22,0.10),0_1px_4px_rgba(0,0,0,0.06)]">
        <Sparkles size={16} className="flex-none text-brand-400" aria-hidden="true" />

        {/* Mode pills */}
        <div className="hidden items-center gap-1 sm:flex">
          {MODES.map((mode, i) => (
            <span
              key={mode}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                i === 0 ? "bg-brand-100 text-brand-700" : "text-muted-foreground"
              }`}
            >
              {mode}
            </span>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden h-4 w-px bg-brand-100 sm:block" />

        {/* Input */}
        <input
          type="text"
          placeholder="Ask AI anything, or describe a task to create..."
          disabled
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-default"
          aria-label="AI assistant input"
        />

        {/* Send button */}
        <button
          disabled
          aria-label="Send"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-500 text-white opacity-30 transition-opacity"
        >
          <ArrowUp size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
