// frontend/src/pages/PublicQuote/PublicQuoteView.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../../components/ui/button/Button";
import PageMeta from "../../components/common/PageMeta";
import { quoteApi, type Quote } from "../../api/quoteApi";

function money(n: number) {
  return (Number(n || 0)).toFixed(2);
}

export default function PublicQuoteView() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [acting, setActing] = useState<"accept" | "decline" | null>(null);

  const canAct = useMemo(() => {
    return quote?.status === "sent";
  }, [quote?.status]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const q = await quoteApi.getPublic(token);
        if (!cancelled) setQuote(q);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message || "This quote link is invalid or expired.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function doAccept() {
    if (!token || !canAct) return;
    setActing("accept");
    try {
      const q = await quoteApi.acceptPublic(token);
      setQuote(q);
    } catch (e: any) {
      alert(e?.response?.data?.message || "Could not accept quote.");
    } finally {
      setActing(null);
    }
  }

  async function doDecline() {
    if (!token || !canAct) return;
    setActing("decline");
    try {
      const q = await quoteApi.declinePublic(token);
      setQuote(q);
    } catch (e: any) {
      alert(e?.response?.data?.message || "Could not decline quote.");
    } finally {
      setActing(null);
    }
  }

  return (
    <>
      <PageMeta title="Quote" description="Public quote view" />

      <div className="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-900 dark:text-white">Quotify</span>{" "}
              <span className="opacity-70">Public Quote</span>
            </div>
            <Link to="/signin" className="text-sm text-brand-600 hover:underline">
              Business login
            </Link>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {loading ? (
              <div className="text-sm text-gray-600 dark:text-gray-300">Loading…</div>
            ) : error ? (
              <div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">Quote unavailable</div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{error}</div>
              </div>
            ) : quote ? (
              <>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {quote.quoteNumber}
                    </div>
                    {quote.title ? (
                      <div className="text-sm text-gray-600 dark:text-gray-300">{quote.title}</div>
                    ) : null}
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Status:{" "}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {quote.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Customer</div>
                  <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    {quote.customerSnapshot?.name || "—"}
                  </div>
                  {quote.customerSnapshot?.email ? (
                    <div className="text-sm text-gray-700 dark:text-gray-300">{quote.customerSnapshot.email}</div>
                  ) : null}
                  {quote.customerSnapshot?.phone ? (
                    <div className="text-sm text-gray-700 dark:text-gray-300">{quote.customerSnapshot.phone}</div>
                  ) : null}
                  {quote.customerSnapshot?.address ? (
                    <div className="mt-1 text-xs text-gray-500">{quote.customerSnapshot.address}</div>
                  ) : null}
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b border-gray-200 text-left dark:border-gray-800">
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">Item</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">Qty</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">Unit (ex GST)</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-500 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.lines.map((l, i) => (
                        <tr key={l._id || i} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{l.name}</div>
                            {l.description ? <div className="text-xs text-gray-500">{l.description}</div> : null}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{l.quantity}</td>
                          <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{money(l.unitPriceExTax)}</td>
                          <td className="px-3 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                            {money((l.lineTotalIncTax ?? 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {quote.notes ? (
                  <div className="mt-4">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Notes</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                      {quote.notes}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>Subtotal (ex GST)</span>
                    <span>{money(quote.subtotalExTax)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>GST</span>
                    <span>{money(quote.taxTotal)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-base font-semibold text-gray-900 dark:text-white">
                    <span>Total (inc GST)</span>
                    <span>{money(quote.totalIncTax)}</span>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={doDecline}
                    disabled={!canAct || acting !== null}
                  >
                    {acting === "decline" ? "Declining..." : "Decline"}
                  </Button>
                  <Button
                    onClick={doAccept}
                    disabled={!canAct || acting !== null}
                  >
                    {acting === "accept" ? "Accepting..." : "Accept"}
                  </Button>
                </div>

                {!canAct ? (
                  <div className="mt-3 text-xs text-gray-500">
                    This quote can no longer be actioned (status: {quote.status}).
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}