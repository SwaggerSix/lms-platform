"use client";

import { useEffect, useState } from "react";
import { money } from "./store-shared";

type Analytics = {
  grossRevenue: number;
  netRevenue: number;
  refunded: number;
  completedOrders: number;
  totalOrders: number;
  seatsSold: number;
  statusCounts: Record<string, number>;
  topCourses: { name: string; seats: number; revenue: number }[];
  dailyRevenue: { date: string; revenue: number }[];
};

export default function ReportsTab({ storeId }: { storeId: string }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [reportDays, setReportDays] = useState(90);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/storefront/admin/${storeId}/analytics?days=${reportDays}`);
      if (res.ok && !cancelled) setAnalytics(await res.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, reportDays]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm text-gray-500">Window</label>
        <select
          value={reportDays}
          onChange={(e) => setReportDays(parseInt(e.target.value))}
          className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
        >
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 180 days</option>
          <option value={365}>Last 365 days</option>
        </select>
      </div>
      {!analytics ? (
        <div className="text-gray-500 py-12 text-center">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Net revenue", value: money(analytics.netRevenue) },
              { label: "Orders", value: String(analytics.completedOrders) },
              { label: "Seats sold", value: String(analytics.seatsSold) },
              { label: "Refunded", value: money(analytics.refunded) },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500">{c.label}</div>
                <div className="text-xl font-bold mt-1">{c.value}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Top courses</h3>
            {analytics.topCourses.length === 0 ? (
              <div className="text-sm text-gray-500">No sales in this window yet.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Course</th>
                      <th className="px-4 py-2 font-medium">Seats</th>
                      <th className="px-4 py-2 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {analytics.topCourses.map((c) => (
                      <tr key={c.name}>
                        <td className="px-4 py-2">{c.name}</td>
                        <td className="px-4 py-2">{c.seats}</td>
                        <td className="px-4 py-2">{money(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
