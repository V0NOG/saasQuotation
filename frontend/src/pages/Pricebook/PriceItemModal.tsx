// frontend/src/pages/Pricebook/PriceItemModal.tsx
import { useEffect, useMemo, useState } from "react";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import type { PriceItem, PriceItemType } from "../../api/pricebookApi";

type Props = {
  open: boolean;
  onClose: () => void;
  type: PriceItemType; // service/material for the page
  initial?: PriceItem | null;
  onSave: (payload: any) => Promise<void>;
};

export default function PriceItemModal({ open, onClose, type, initial, onSave }: Props) {
  const isEdit = !!initial?._id;

  const initialForm = useMemo(
    () => ({
      name: initial?.name || "",
      description: initial?.description || "",
      unitPrice: initial?.unitPrice ?? 0,
      taxRate: initial?.taxRate ?? null,
      defaultMinutes: initial?.defaultMinutes ?? null,
      unit: initial?.unit || "",
      isActive: initial?.isActive ?? true,
    }),
    [initial]
  );

  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(initialForm), [initialForm]);

  if (!open) return null;

  const showMinutes = type === "service";
  const showUnit = type === "material";

  async function handleSave() {
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        type,
        name: form.name.trim(),
        description: form.description,
        unitPrice: Number(form.unitPrice || 0),
        taxRate: form.taxRate === null || form.taxRate === "" ? null : Number(form.taxRate),
        defaultMinutes: showMinutes
          ? form.defaultMinutes === null || form.defaultMinutes === ""
            ? null
            : Number(form.defaultMinutes)
          : null,
        unit: showUnit ? form.unit : "",
        isActive: !!form.isActive,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEdit ? "Edit" : "Add"} {type === "service" ? "Service" : "Material"}
          </h3>

          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>

          <div className="md:col-span-2">
            <Label>Description</Label>
            <textarea
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder={type === "service" ? "e.g. Callout fee, install labour…" : "e.g. 20mm copper pipe…"}
            />
          </div>

          <div>
            <Label>Unit price</Label>
            <Input
              type="number"
              value={String(form.unitPrice)}
              onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value as any }))}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label>Tax rate (optional)</Label>
            <Input
              type="number"
              value={form.taxRate === null ? "" : String(form.taxRate)}
              onChange={(e) => setForm((p) => ({ ...p, taxRate: e.target.value === "" ? null : (e.target.value as any) }))}
              placeholder="Leave blank to use org default"
            />
          </div>

          {showMinutes && (
            <div>
              <Label>Default minutes (optional)</Label>
              <Input
                type="number"
                value={form.defaultMinutes === null ? "" : String(form.defaultMinutes)}
                onChange={(e) =>
                  setForm((p) => ({ ...p, defaultMinutes: e.target.value === "" ? null : (e.target.value as any) }))
                }
                placeholder="e.g. 30"
              />
            </div>
          )}

          {showUnit && (
            <div>
              <Label>Unit (optional)</Label>
              <Input
                value={form.unit}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                placeholder="e.g. each, m, box"
              />
            </div>
          )}

          <div className="md:col-span-2 flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={!!form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            <label htmlFor="active" className="text-sm text-gray-700 dark:text-gray-300">
              Active
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}