// frontend/src/pages/Pricebook/Services.tsx
import { useEffect, useMemo, useState } from "react";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import { pricebookApi, type PriceItem } from "../../api/pricebookApi";
import PriceItemModal from "./PriceItemModal";

export default function Services() {
  const type = "service" as const;

  const breadCrumb = useMemo(() => [{ label: "Pricebook" }, { label: "Services" }], []);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [items, setItems] = useState<PriceItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PriceItem | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await pricebookApi.list({ type, search, page, limit });
      setItems(res.items);
      setTotalPages(res.totalPages);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item: PriceItem) {
    setEditing(item);
    setModalOpen(true);
  }

  async function onSave(payload: any) {
    if (editing?._id) await pricebookApi.update(editing._id, payload);
    else await pricebookApi.create(payload);
    await load();
  }

  async function onDelete(item: PriceItem) {
    const ok = window.confirm(`Delete "${item.name}"?`);
    if (!ok) return;
    await pricebookApi.remove(item._id);
    await load();
  }

  return (
    <div>
      <PageBreadCrumb title="Services" breadCrumb={breadCrumb} />

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-md">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services…"
            />
          </div>

          <Button onClick={openCreate}>Add Service</Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-gray-200 text-left dark:border-gray-800">
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Minutes</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Unit Price</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Active</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-gray-600 dark:text-gray-300">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-gray-600 dark:text-gray-300">
                    No services found.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it._id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{it.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {it.defaultMinutes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {it.unitPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {it.isActive ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => openEdit(it)}
                          className="rounded-lg px-3 py-1 text-sm text-brand-600 hover:bg-brand-50 dark:hover:bg-gray-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(it)}
                          className="rounded-lg px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-gray-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
              Prev
            </Button>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <PriceItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        type={type}
        initial={editing}
        onSave={onSave}
      />
    </div>
  );
}