"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

function money(v) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function annualRate(totalAge) {
  if (totalAge <= 1) return 0.19;
  if (totalAge <= 2) return 0.14;
  if (totalAge <= 3) return 0.12;
  if (totalAge <= 5) return 0.10;
  if (totalAge <= 8) return 0.08;
  return 0.05;
}

export function buildDepreciationData(retail, vehicleYear) {
  const currentYear = new Date().getFullYear();
  const age = currentYear - Number(vehicleYear);
  const data = [{ label: "Now", value: retail, year: currentYear }];
  let v = retail;
  for (let i = 1; i <= 5; i++) {
    v = Math.round(v * (1 - annualRate(age + i)));
    data.push({ label: `+${i}yr`, value: v, year: currentYear + i });
  }
  return data;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{money(payload[0].value)}</p>
    </div>
  );
};

export default function DepreciationChart({ retail, vehicleYear }) {
  const data = buildDepreciationData(retail, vehicleYear);
  const drop = retail - data[data.length - 1].value;
  const dropPct = Math.round((drop / retail) * 100);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Depreciation</p>
          <h2 className="mt-1 text-xl font-semibold">Projected value over 5 years</h2>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">5-year drop</p>
            <p className="font-semibold">−{money(drop)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total loss</p>
            <p className="font-semibold">−{dropPct}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Value in 5yr</p>
            <p className="font-semibold">{money(data[data.length - 1].value)}</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgba(255,255,255,0.12)" stopOpacity={1} />
              <stop offset="95%" stopColor="rgba(255,255,255,0)" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1.5}
            fill="url(#depGrad)"
            dot={{ fill: "rgba(255,255,255,0.6)", r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#fff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
