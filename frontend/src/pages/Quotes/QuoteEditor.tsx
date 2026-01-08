// frontend/src/pages/Quotes/QuoteEditor.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";

import { customersApi, type Customer } from "../../api/customersApi";
import { quoteApi, type QuoteLine, type PricingMode, type QuoteStatus, type Quote } from "../../api/quoteApi";
import { pricebookApi, type PriceItem } from "../../api/pricebookApi";
import { http } from "../../api/http"; // ✅ NEW: for authed PDF download

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function displayUnitPrice(line: QuoteLine, mode: PricingMode, orgTaxRate = 0.1) {
  const rate = line.taxRate ?? orgTaxRate;
  const ex = Number(line.unitPriceExTax || 0);
  if (mode === "inclusive") return round2(ex * (1 + rate));
  return round2(ex);
}

function isLockedQuote(q: Quote | null) {
  if (!q) return false;
  return q.status === "accepted" || !!q.lockedAt;
}

// ✅ FIX: Download PDF with Authorization header (window.open can't include Bearer token)
async function downloadQuotePdfAuthed(quoteId: string) {
  try {
    const res = await http.get(`/quotes/${quoteId}/pdf`, { responseType: "blob" });

    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `quote-${quoteId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (e: any) {
    alert(e?.response?.data?.message || "Could not download PDF.");
  }
}

export default function QuoteEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const bread = useMemo(
    () => [{ label: "Quotes", path: "/quotes" }, { label: isNew ? "Create" : "Edit" }],
    [isNew]
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ✅ consolidate into ONE action
  const [sendEmailLoading, setSendEmailLoading] = useState(false);

  const [quoteId, setQuoteId] = useState<string | null>(isNew ? null : (id as string));
  const [publicToken, setPublicToken] = useState<string | null>(null);

  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [lockedAt, setLockedAt] = useState<string | null>(null);

  const [pricingMode, setPricingMode] = useState<PricingMode>("exclusive");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerSnapshot, setCustomerSnapshot] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  const [lines, setLines] = useState<QuoteLine[]>([]);

  const [pbType, setPbType] = useState<"service" | "material">("service");
  const [pbSearch, setPbSearch] = useState("");
  const [pbItems, setPbItems] = useState<PriceItem[]>([]);

  const orgTaxRate = 0.1;

  const isLocked = status === "accepted" || !!lockedAt;

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      if (isNew) return;
      setLoading(true);
      try {
        const q = await quoteApi.getById(id!);
        if (cancelled) return;

        setQuoteId(q._id);
        setStatus(q.status);
        setLockedAt((q.lockedAt as any) ?? null);
        setPublicToken((q.publicToken as any) ?? null);

        setPricingMode(q.pricingMode);
        setTitle(q.title || "");
        setNotes(q.notes || "");

        setCustomerId((q as any).customerId || null);
        setCustomerSnapshot({
          name: q.customerSnapshot?.name || "",
          email: q.customerSnapshot?.email || "",
          phone: q.customerSnapshot?.phone || "",
          address: q.customerSnapshot?.address || "",
        });

        setLines(q.lines || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadQuote();
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  useEffect(() => {
    let cancelled = false;

    const t = setTimeout(async () => {
      try {
        const res = await pricebookApi.list({
          type: pbType,
          search: pbSearch,
          page: 1,
          limit: 10,
        });
        if (cancelled) return;
        setPbItems(res.items);
      } catch {
        if (!cancelled) setPbItems([]);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pbType, pbSearch]);

  useEffect(() => {
    let cancelled = false;

    const t = setTimeout(async () => {
      const q = customerSearch.trim();
      if (!q) {
        setCustomerResults([]);
        return;
      }

      try {
        const res = await customersApi.list({ search: q, page: 1, limit: 8 });
        if (cancelled) return;
        setCustomerResults(res.items);
      } catch {
        if (!cancelled) setCustomerResults([]);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [customerSearch]);

  function addFromPricebook(item: PriceItem) {
    if (isLocked) return;
    const line: QuoteLine = {
      itemId: item._id,
      type: item.type,
      name: item.name,
      description: item.description || "",
      quantity: 1,
      unit: item.unit || "",
      unitPriceExTax: Number(item.unitPrice || 0),
      taxRate: item.taxRate ?? null,
      minutes: item.type === "service" ? item.defaultMinutes ?? null : null,
    };
    setLines((prev) => [line, ...prev]);
  }

  function updateLine(idx: number, patch: Partial<QuoteLine>) {
    if (isLocked) return;
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
    if (isLocked) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function computePreviewTotals() {
    let subtotalEx = 0;
    let tax = 0;

    for (const l of lines) {
      const qty = Number(l.quantity || 0);
      const ex = Number(l.unitPriceExTax || 0);
      const rate = l.taxRate ?? orgTaxRate;

      const lineSub = round2(qty * ex);
      const lineTax = round2(lineSub * rate);

      subtotalEx = round2(subtotalEx + lineSub);
      tax = round2(tax + lineTax);
    }

    return { subtotalEx, tax, totalInc: round2(subtotalEx + tax) };
  }

  function formatCustomerAddress(c: Customer) {
    const a = c.address || {};
    return [a.line1, a.line2, a.suburb, a.state, a.postcode, a.country].filter(Boolean).join(", ");
  }

  async function save() {
    if (isLocked) {
      alert("This quote is locked and cannot be edited.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        pricingMode,
        title,
        notes,
        customerId,
        customerSnapshot,
        lines,
      };

      if (isNew) {
        const created = await quoteApi.create(payload as any);
        navigate(`/quotes/${created._id}`);
      } else {
        await quoteApi.update(id!, payload as any);
      }
    } catch (e: any) {
      alert(e?.response?.data?.message || "Could not save quote.");
    } finally {
      setSaving(false);
    }
  }

  // ✅ NEW: one-click "Send & Email Quote"
  async function sendAndEmailQuote() {
    if (!quoteId) return;

    setSendEmailLoading(true);
    try {
      // 1) ensure public link exists and status is "sent"
      let token = publicToken;
      if (status === "draft" || !token) {
        const q = await quoteApi.send(quoteId);
        setStatus(q.status);
        token = (q.publicToken as any) ?? null;
        setPublicToken(token);
      }

      // 2) email the quote (attach PDF)
      const to = (customerSnapshot.email || "").trim();

      await quoteApi.email(quoteId, {
        to: to || undefined,
        message: "Please review and accept the quote.",
        attachPdf: true,
      });

      alert("Quote sent and emailed! Public link is now available.");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Could not send/email quote.");
    } finally {
      setSendEmailLoading(false);
    }
  }

  const preview = computePreviewTotals();
  const publicUrl = publicToken ? `${window.location.origin}/quote/view/${publicToken}` : null;

  return (
    <div>
      <PageBreadCrumb title={isNew ? "Create Quote" : "Edit Quote"} breadCrumb={bread as any} />

      {isLocked ? (
        <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-900/10 dark:text-yellow-200">
          This quote is <b>locked</b> (status: {status}). Editing is disabled.
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Status: <span className="font-semibold text-gray-900 dark:text-white">{status}</span>
                </div>

                <select
                  className="h-[44px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  value={pricingMode}
                  disabled={isLocked}
                  onChange={(e) => setPricingMode(e.target.value as any)}
                  title="How prices are displayed on this quote"
                >
                  <option value="exclusive">Prices EX GST</option>
                  <option value="inclusive">Prices INC GST</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <Link to="/quotes">
                  <Button variant="outline">Back</Button>
                </Link>

                {/* ✅ Blue primary button does: generate public link + email */}
                {!isNew && quoteId ? (
                  <Button onClick={sendAndEmailQuote} disabled={sendEmailLoading}>
                    {sendEmailLoading ? "Sending..." : "Send & Email Quote"}
                  </Button>
                ) : null}

                <Button onClick={save} disabled={saving || isLocked}>
                  {saving ? "Saving..." : "Save Quote"}
                </Button>
              </div>
            </div>

            {/* ✅ Blue Download button next to Send */}
            {!isNew && quoteId ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => downloadQuotePdfAuthed(quoteId)} disabled={sendEmailLoading}>
                  Download PDF
                </Button>
              </div>
            ) : null}

            {publicUrl ? (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-800/40">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-gray-700 dark:text-gray-200">
                    Public link:{" "}
                    <a className="text-brand-600 hover:underline" href={publicUrl} target="_blank" rel="noreferrer">
                      {publicUrl}
                    </a>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input
                  value={title}
                  disabled={isLocked}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Quote title (optional)"
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Customer</div>

                  <Input
                    value={customerSearch}
                    disabled={isLocked}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search customers by name/email/phone…"
                  />

                  {customerResults.length > 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
                      {customerResults.map((c) => (
                        <button
                          key={c._id}
                          disabled={isLocked}
                          onClick={() => {
                            setCustomerId(c._id);
                            setCustomerSearch("");
                            setCustomerResults([]);
                            setCustomerSnapshot({
                              name: c.name || "",
                              email: c.email || "",
                              phone: c.phone || "",
                              address: formatCustomerAddress(c),
                            });
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-60 dark:hover:bg-gray-800"
                        >
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">{c.name}</div>
                          <div className="text-xs text-gray-500">
                            {[c.email, c.phone].filter(Boolean).join(" • ") || "—"}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {customerId ? (
                    <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {customerSnapshot.name || "Selected customer"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {[customerSnapshot.email, customerSnapshot.phone].filter(Boolean).join(" • ")}
                          </div>
                          {customerSnapshot.address ? (
                            <div className="mt-1 text-xs text-gray-500">{customerSnapshot.address}</div>
                          ) : null}
                        </div>
                        <button
                          disabled={isLocked}
                          onClick={() => {
                            setCustomerId(null);
                            setCustomerSnapshot({ name: "", email: "", phone: "", address: "" });
                          }}
                          className="rounded-lg px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:hover:bg-gray-800"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="md:col-span-2">
                <textarea
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  rows={3}
                  value={notes}
                  disabled={isLocked}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes / Scope / Terms (optional)"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Line items</h3>

            {loading ? (
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">Loading…</div>
            ) : lines.length === 0 ? (
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                No line items yet. Add from the Pricebook on the right.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="border-b border-gray-200 text-left dark:border-gray-800">
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">Item</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">Qty</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">Unit Price</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">GST%</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-500 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{l.name}</div>
                          {l.description ? <div className="text-xs text-gray-500">{l.description}</div> : null}
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                            <Input
                              value={l.name}
                              disabled={isLocked}
                              onChange={(e) => updateLine(idx, { name: e.target.value })}
                              placeholder="Line name"
                            />
                            <Input
                              value={l.description || ""}
                              disabled={isLocked}
                              onChange={(e) => updateLine(idx, { description: e.target.value })}
                              placeholder="Description"
                            />
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            disabled={isLocked}
                            value={String(l.quantity ?? 0)}
                            onChange={(e) => updateLine(idx, { quantity: Number(e.target.value || 0) })}
                          />
                        </td>

                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            disabled={isLocked}
                            value={String(displayUnitPrice(l, pricingMode, orgTaxRate))}
                            onChange={(e) => {
                              const entered = Number(e.target.value || 0);
                              const rate = l.taxRate ?? orgTaxRate;
                              const ex = pricingMode === "inclusive" ? entered / (1 + rate) : entered;
                              updateLine(idx, { unitPriceExTax: round2(ex) });
                            }}
                          />
                          <div className="mt-1 text-[11px] text-gray-500">
                            Stored ex GST: {round2(Number(l.unitPriceExTax || 0)).toFixed(2)}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            disabled={isLocked}
                            value={
                              l.taxRate === null || l.taxRate === undefined
                                ? ""
                                : String(round2((l.taxRate as number) * 100))
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "") return updateLine(idx, { taxRate: null });
                              updateLine(idx, { taxRate: Number(v) / 100 });
                            }}
                            placeholder="Use org"
                          />
                        </td>

                        <td className="px-3 py-3 text-right">
                          <button
                            disabled={isLocked}
                            onClick={() => removeLine(idx)}
                            className="rounded-lg px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:hover:bg-gray-800"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Add from Pricebook</h3>

            <div className="mt-3 flex gap-2">
              <select
                className="h-[44px] w-[160px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                value={pbType}
                disabled={isLocked}
                onChange={(e) => setPbType(e.target.value as any)}
              >
                <option value="service">Services</option>
                <option value="material">Materials</option>
              </select>
              <div className="flex-1">
                <Input
                  value={pbSearch}
                  disabled={isLocked}
                  onChange={(e) => setPbSearch(e.target.value)}
                  placeholder="Search…"
                />
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {pbItems.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-300">No items found.</div>
              ) : (
                pbItems.map((it) => (
                  <button
                    key={it._id}
                    disabled={isLocked}
                    onClick={() => addFromPricebook(it)}
                    className="w-full rounded-xl border border-gray-200 p-3 text-left hover:bg-gray-50 disabled:opacity-60 dark:border-gray-800 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{it.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {Number(it.unitPrice || 0).toFixed(2)}
                      </div>
                    </div>
                    {it.description ? <div className="mt-1 text-xs text-gray-500">{it.description}</div> : null}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Totals (preview)</h3>
            <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Subtotal (ex GST)</span>
                <span>{preview.subtotalEx.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST</span>
                <span>{preview.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900 dark:text-white">
                <span>Total (inc GST)</span>
                <span>{preview.totalInc.toFixed(2)}</span>
              </div>
              <div className="pt-2 text-xs text-gray-500">
                Final totals are calculated server-side using your org’s tax rate.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}