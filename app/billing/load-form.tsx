"use client";

import { useState } from "react";
import { WALLET_NAME, type WalletId } from "@/lib/billing-config";
import { loadCredits } from "./actions";

const input =
  "w-full rounded-xl border border-foreground/12 bg-white/80 px-3.5 py-2.5 text-sm placeholder:text-foreground/35 focus:border-[#0a66d6] focus:outline-none focus:ring-4 focus:ring-[#0a66d6]/15";
const label = "flex flex-col gap-1.5 text-sm";

// how the customer sends to a number of this kind
const HOW: Record<string, string> = { personal: "Send Money", agent: "Cash Out", merchant: "Payment" };

// Loading credits by hand: send taka to our number, then tell us what was sent.
export function LoadForm({ wallets, perCredit, minLoad }: { wallets: { id: WalletId; number: string; kind: string }[]; perCredit: number; minLoad: number }) {
  const [method, setMethod] = useState<WalletId>(wallets[0].id);
  const [bdt, setBdt] = useState("");
  const w = wallets.find((x) => x.id === method) ?? wallets[0];
  const credits = Math.floor(Number(bdt) / perCredit + 1e-9) || 0;
  const minBdt = Math.ceil(minLoad * perCredit - 1e-9);

  return (
    <form action={loadCredits} className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-white/80 p-5">
      <input type="hidden" name="method" value={method} />
      <div className="flex flex-wrap gap-2">
        {wallets.map((x) => (
          <button key={x.id} type="button" onClick={() => setMethod(x.id)} aria-pressed={method === x.id} className={`rounded-full border px-4 py-1.5 text-sm ${method === x.id ? "border-[#0a66d6] bg-[#0a66d6]/10 font-medium text-[#0a66d6]" : "border-foreground/12 bg-white/70 hover:border-foreground/30"}`}>
            {WALLET_NAME[x.id]}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-[#0a66d6]/[0.06] px-4 py-3 text-sm">
        <p className="text-foreground/60">
          1. {HOW[w.kind.toLowerCase()] ?? "Send Money"} to our {WALLET_NAME[method]} {w.kind.toLowerCase()} number
        </p>
        <p className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums tracking-wide">
          {w.number}
          <button type="button" onClick={() => navigator.clipboard?.writeText(w.number).catch(() => {})} className="rounded-full border border-foreground/15 px-2 py-0.5 text-[11px] font-medium text-foreground/60 hover:border-foreground/35">
            Copy
          </button>
        </p>
        <p className="mt-2 text-foreground/60">2. Then fill this in with what you sent. We check it and add your credits — usually within a few hours.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          <span className="font-medium">Amount sent (৳)</span>
          <input name="bdt" type="number" inputMode="numeric" min={minBdt} step={1} required value={bdt} onChange={(e) => setBdt(e.target.value)} placeholder={`${minBdt} or more`} className={input} />
        </label>
        <label className={label}>
          <span className="font-medium">Your {WALLET_NAME[method]} number</span>
          <input name="sender" type="tel" inputMode="tel" required maxLength={14} placeholder="01XXXXXXXXX" className={input} />
        </label>
        <label className={label}>
          <span className="font-medium">Transaction ID</span>
          <input name="trx_id" required maxLength={30} autoCapitalize="characters" placeholder="e.g. 9BG7XK2LQA" className={`${input} uppercase`} />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/70">{credits > 0 ? <>You get <b className="tabular-nums">{credits.toLocaleString("en-US")}</b> credits{credits < minLoad && <span className="text-amber-700"> — the smallest load is {minLoad.toLocaleString("en-US")}</span>}</> : `৳${perCredit.toFixed(2)} a credit · at least ${minLoad.toLocaleString("en-US")} credits`}</p>
        <button className="gs-btn" disabled={credits < minLoad}>
          Submit payment
        </button>
      </div>
    </form>
  );
}
