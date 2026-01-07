// frontend/src/pages/Quotes/QuoteEditor.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";

import { quoteApi, type QuoteLine, type PricingMode, type QuoteStatus } from "../../api/quoteApi";
import { pricebookApi, type PriceItem } from "../../api/pricebookApi";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// UI helper: display unit price based on mode
function displayUnitPrice(line: QuoteLine, mode: PricingMode, orgTaxRate = 0.1) {
  const rate = line.taxRate ?? orgTaxRate;
  if (mode === "inclusive") return round2(line.unitPriceExTax * (1 + rate));
  return round2(line.unitPriceExTax);
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

  // Basic fields
  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [pricingMode, setPricingMode] = useState<PricingMode>("exclusive");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  // Customer snapshot (Phase 4 we’ll build full customer picker; for now manual is fine)
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Lines
  const [lines, setLines] = useState<QuoteLine[]>([]);

  // Pricebook search
  const [pbType, setPbType] = useState<"service" | "material">("service");
  const [pbSearch, setPbSearch] = useState("");
  const [pbItems, setPbItems] = useState<PriceItem[]>([]);

  // Totals shown (server calculates final totals, but we show quick estimate)
  const orgTaxRate = 0.1; // UI estimate; backend uses org taxRate. (Phase 4: fetch org tax rate in editor)

  useEffect(() => {
    async function loadQuote() {
      if (isNew) return;
      setLoading(true);
      try {
        const q = await quoteApi.getById(id!);
        setStatus(q.status);
        setPricingMode(q.pricingMode);
        setTitle(q.title || "");
        setNotes(q.notes || "");

        setCustomerName(q.customerSnapshot?.name || "");
        setCustomerEmail(q.customerSnapshot?.email || "");
        setCustomerPhone(q.customerSnapshot?.phone || "");
        setCustomerAddress(q.customerSnapshot?.address || "");

        setLines(q.lines || []);
      } finally {
        setLoading(false);
      }
    }
    loadQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let t: any;
    async function loadPricebook() {
      const res = await pricebookApi.list({ type: pbType, search: pbSearch, page: 1, limit: 10 });
      setPbItems(res.items);
    }
    t = setTimeout(loadPricebook, 250);
    return () => clearTimeout(t);
  }, [pbType, pbSearch]);

  function addFromPricebook(item: PriceItem) {
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
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
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

  async function save() {
    setSaving(true);
    try {
      const payload = {
        status,
        pricingMode,
        title,
        notes,
        customerSnapshot: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address: customerAddress,
        },
        lines,
      };

      if (isNew) {
        const created = await quoteApi.create(payload as any);
        navigate(`/quotes/${created._id}`);
      } else {
        await quoteApi.update(id!, payload as any);
      }
    } finally {
      setSaving(false);
    }
  }

  const preview = computePreviewTotals();

  return (
    <div>
      <PageBreadCrumb title={isNew ? "Create Quote" : "Edit Quote"} breadCrumb={bread as any} />

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* LEFT: Quote + Customer */}
        <div className="xl:col-span-2 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <select
                  className="h-[44px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                </select>

                <select
                  className="h-[44px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  value={pricingMode}
                  onChange={(e) => setPricingMode(e.target.value as any)}
                  title="How prices are displayed on this quote"
                >
                  <option value="exclusive">Prices EX GST</option>
                  <option value="inclusive">Prices INC GST</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Link to="/quotes">
                  <Button variant="outline">Back</Button>
                </Link>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save Quote"}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quote title (optional)" />
              </div>

              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" />
              <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Customer email" />
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Customer phone" />
              <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Customer address" />

              <div className="md:col-span-2">
                <textarea
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes / Scope / Terms (optional)"
                />
              </div>
            </div>
          </div>

          {/* Lines */}
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
                              onChange={(e) => updateLine(idx, { name: e.target.value })}
                              placeholder="Line name"
                            />
                            <Input
                              value={l.description || ""}
                              onChange={(e) => updateLine(idx, { description: e.target.value })}
                              placeholder="Description"
                            />
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            value={String(l.quantity)}
                            onChange={(e) => updateLine(idx, { quantity: Number(e.target.value || 0) })}
                          />
                        </td>

                        <td className="px-3 py-3">
                          {/* Store EX GST always. If pricingMode is inclusive, we show converted value but still store EX. */}
                          <Input
                            type="number"
                            value={String(displayUnitPrice(l, pricingMode, orgTaxRate))}
                            onChange={(e) => {
                              const entered = Number(e.target.value || 0);
                              const rate = l.taxRate ?? orgTaxRate;
                              const ex = pricingMode === "inclusive" ? entered / (1 + rate) : entered;
                              updateLine(idx, { unitPriceExTax: round2(ex) });
                            }}
                          />
                          <div className="mt-1 text-[11px] text-gray-500">
                            Stored ex GST: {round2(l.unitPriceExTax).toFixed(2)}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            value={l.taxRate === null || l.taxRate === undefined ? "" : String(round2((l.taxRate as number) * 100))}
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
                            onClick={() => removeLine(idx)}
                            className="rounded-lg px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-gray-800"
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

        {/* RIGHT: Pricebook picker + Totals */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Add from Pricebook</h3>

            <div className="mt-3 flex gap-2">
              <select
                className="h-[44px] w-[160px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                value={pbType}
                onChange={(e) => setPbType(e.target.value as any)}
              >
                <option value="service">Services</option>
                <option value="material">Materials</option>
              </select>
              <div className="flex-1">
                <Input value={pbSearch} onChange={(e) => setPbSearch(e.target.value)} placeholder="Search…" />
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {pbItems.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-300">No items found.</div>
              ) : (
                pbItems.map((it) => (
                  <button
                    key={it._id}
                    onClick={() => addFromPricebook(it)}
                    className="w-full rounded-xl border border-gray-200 p-3 text-left hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{it.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">{Number(it.unitPrice).toFixed(2)}</div>
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