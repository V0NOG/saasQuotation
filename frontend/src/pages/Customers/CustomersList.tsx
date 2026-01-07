// frontend/src/pages/Customers/CustomersList.tsx
import { useEffect, useMemo, useState } from "react";
import { customersApi, type Customer } from "../../api/customersApi";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import CustomerModal from "./CustomerModal";

export default function CustomersList() {
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const title = useMemo(() => [{ label: "Customers" }], []);

  async function load(p = page, s = debouncedSearch) {
    setLoading(true);
    try {
      const res = await customersApi.list({ search: s, page: p, limit });
      setItems(res.items);
      setTotalPages(res.totalPages);
    } finally {
      setLoading(false);
    }
  }

  // Debounce search input -> debouncedSearch
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reload when page OR debounced search changes
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSave(payload: any) {
    if (editing?._id) {
      await customersApi.update(editing._id, payload);
    } else {
      await customersApi.create(payload);
    }

    closeModal();
    await load(1, debouncedSearch); // ensure the list refreshes predictably
  }

  async function handleDelete(c: Customer) {
    const ok = window.confirm(`Delete customer "${c.name}"?`);
    if (!ok) return;

    await customersApi.remove(c._id);

    // If they deleted the one currently being edited, close modal safely
    if (editing?._id === c._id) closeModal();

    // Keep page in range if we deleted last item on last page
    const nextPage = page > 1 && items.length === 1 ? page - 1 : page;
    setPage(nextPage);
    await load(nextPage, debouncedSearch);
  }

  return (
    <div>
      <PageBreadCrumb title="Customers" breadCrumb={title} />

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-md">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone…"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={openCreate}>Add Customer</Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-gray-200 text-left dark:border-gray-800">
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Email</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Phone</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Suburb</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-600 dark:text-gray-300" colSpan={5}>
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-600 dark:text-gray-300" colSpan={5}>
                    No customers found.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c._id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {c.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {c.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {c.address?.suburb || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => openEdit(c)}
                          className="rounded-lg px-3 py-1 text-sm text-brand-600 hover:bg-brand-50 dark:hover:bg-gray-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
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

        {/* pagination */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Page {page} of {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
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

      <CustomerModal
        open={modalOpen}
        onClose={closeModal}
        onSave={handleSave}
        initial={editing}
      />
    </div>
  );
}