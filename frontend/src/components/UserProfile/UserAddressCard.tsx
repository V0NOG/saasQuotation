import { useEffect, useState } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useAuth } from "../../context/AuthContext";
import { userApi } from "../../api/userApi";

export default function UserAddressCard() {
  const { user, setUser } = useAuth();
  const { isOpen, openModal, closeModal } = useModal();

  const [country, setCountry] = useState(user?.address?.country || "");
  const [cityState, setCityState] = useState(user?.address?.cityState || "");
  const [postalCode, setPostalCode] = useState(user?.address?.postalCode || "");
  const [taxId, setTaxId] = useState(user?.address?.taxId || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCountry(user?.address?.country || "");
    setCityState(user?.address?.cityState || "");
    setPostalCode(user?.address?.postalCode || "");
    setTaxId(user?.address?.taxId || "");
  }, [user]);

  async function handleSave(e?: React.MouseEvent) {
    e?.preventDefault();
    setError(null);

    try {
      setSaving(true);

      const updated = await userApi.updateMe({
        address: {
          country: country.trim(),
          cityState: cityState.trim(),
          postalCode: postalCode.trim(),
          taxId: taxId.trim(),
        },
      });

      setUser(updated);
      closeModal();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to save address.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
              Address
            </h4>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Country</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">{country || "-"}</p>
              </div>

              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">City/State</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">{cityState || "-"}</p>
              </div>

              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Postal Code</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">{postalCode || "-"}</p>
              </div>

              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">TAX ID</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">{taxId || "-"}</p>
              </div>
            </div>
          </div>

          <button
            onClick={openModal}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
          >
            Edit
          </button>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px]">
        <div className="relative w-full p-4 overflow-y-auto bg-white no-scrollbar rounded-3xl dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Edit Address</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Update your details to keep your profile up-to-date.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
            <div className="px-2 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div>
                  <Label>Country</Label>
                  <Input type="text" value={country} onChange={(e) => setCountry((e.target as HTMLInputElement).value)} />
                </div>

                <div>
                  <Label>City/State</Label>
                  <Input type="text" value={cityState} onChange={(e) => setCityState((e.target as HTMLInputElement).value)} />
                </div>

                <div>
                  <Label>Postal Code</Label>
                  <Input type="text" value={postalCode} onChange={(e) => setPostalCode((e.target as HTMLInputElement).value)} />
                </div>

                <div>
                  <Label>TAX ID</Label>
                  <Input type="text" value={taxId} onChange={(e) => setTaxId((e.target as HTMLInputElement).value)} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={closeModal}>
                Close
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}