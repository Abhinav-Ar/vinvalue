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
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="text-indigo-400">{money(payload[0].value)}</p>
    </div>
  );
};

export default function DepreciationChart({ retail, vehicleYear }) {
  const data = buildDepreciationData(retail, vehicleYear);
  const drop = retail - data[data.length - 1].value;
  const dropPct = Math.round((drop / retail) * 100);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Depreciation</p>
          <h2 className="text-xl font-bold">Projected value over 5 years</h2>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">5-year drop</p>
            <p className="font-bold text-red-400">−{money(drop)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total loss</p>
            <p className="font-bold text-red-400">−{dropPct}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Value in 5yr</p>
            <p className="font-bold">{money(data[data.length - 1].value)}</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
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
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#depGrad)"
            dot={{ fill: "#6366f1", r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "#818cf8" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
