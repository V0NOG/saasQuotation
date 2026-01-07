// frontend/src/pages/Customers/CustomerModal.tsx
import { useEffect, useMemo, useState } from "react";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import type { Customer } from "../../api/customersApi";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (payload: Partial<Customer> & { name: string }) => Promise<void>;
  initial?: Customer | null;
};

export default function CustomerModal({ open, onClose, onSave, initial }: Props) {
  const isEdit = !!initial?._id;

  const initialForm = useMemo(
    () => ({
      name: initial?.name || "",
      email: initial?.email || "",
      phone: initial?.phone || "",
      notes: initial?.notes || "",
      address: {
        line1: initial?.address?.line1 || "",
        line2: initial?.address?.line2 || "",
        suburb: initial?.address?.suburb || "",
        state: initial?.address?.state || "",
        postcode: initial?.address?.postcode || "",
        country: initial?.address?.country || "Australia",
      },
    }),
    [initial]
  );

  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(initialForm), [initialForm]);

  if (!open) return null;

  const setField = (key: keyof typeof form, value: any) => setForm((p) => ({ ...p, [key]: value }));
  const setAddr = (key: keyof typeof form.address, value: string) =>
    setForm((p) => ({ ...p, address: { ...p.address, [key]: value } }));

  async function handleSave() {
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        notes: form.notes,
        address: form.address,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* modal */}
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEdit ? "Edit Customer" : "Add Customer"}
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
            <Input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. John Smith"
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="e.g. john@email.com"
            />
          </div>

          <div>
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="e.g. 04xx xxx xxx"
            />
          </div>

          <div className="md:col-span-2">
            <Label>Address line 1</Label>
            <Input value={form.address.line1} onChange={(e) => setAddr("line1", e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <Label>Address line 2</Label>
            <Input value={form.address.line2} onChange={(e) => setAddr("line2", e.target.value)} />
          </div>

          <div>
            <Label>Suburb</Label>
            <Input value={form.address.suburb} onChange={(e) => setAddr("suburb", e.target.value)} />
          </div>

          <div>
            <Label>State</Label>
            <Input value={form.address.state} onChange={(e) => setAddr("state", e.target.value)} />
          </div>

          <div>
            <Label>Postcode</Label>
            <Input value={form.address.postcode} onChange={(e) => setAddr("postcode", e.target.value)} />
          </div>

          <div>
            <Label>Country</Label>
            <Input value={form.address.country} onChange={(e) => setAddr("country", e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <Label>Notes</Label>
            <textarea
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
              rows={3}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Anything important about this customer…"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create customer"}
          </Button>
        </div>
      </div>
    </div>
  );
}