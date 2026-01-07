import { useEffect, useMemo, useState } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useAuth } from "../../context/AuthContext";
import { userApi } from "../../api/userApi";

function fullName(u: any) {
  const n = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
  return n || u?.email || "Account";
}

/**
 * Normalize a user-entered URL so it always becomes absolute.
 * - "test.com" -> "https://test.com"
 * - "https://test.com" -> unchanged
 * - "" -> ""
 * - blocks "javascript:" just in case
 */
function normalizeUrl(raw?: string) {
  const v = (raw || "").trim();
  if (!v) return "";
  if (/^javascript:/i.test(v)) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(mailto:|tel:)/i.test(v)) return v;
  return `https://${v}`;
}

export default function UserMetaCard() {
  const { user, setUser } = useAuth();
  const { isOpen, openModal, closeModal } = useModal();

  const displayName = useMemo(() => fullName(user), [user]);

  const [bio, setBio] = useState(user?.bio || "");
  const [facebook, setFacebook] = useState(user?.socials?.facebook || "");
  const [x, setX] = useState(user?.socials?.x || "");
  const [linkedin, setLinkedin] = useState(user?.socials?.linkedin || "");
  const [instagram, setInstagram] = useState(user?.socials?.instagram || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // keep form in sync when user changes
  useEffect(() => {
    setBio(user?.bio || "");
    setFacebook(user?.socials?.facebook || "");
    setX(user?.socials?.x || "");
    setLinkedin(user?.socials?.linkedin || "");
    setInstagram(user?.socials?.instagram || "");
  }, [user]);

  // ✅ Build visible socials using normalized URL
  const visibleSocials = useMemo(() => {
    const items = [
      { key: "facebook", label: "Facebook", href: normalizeUrl(user?.socials?.facebook) },
      { key: "x", label: "X", href: normalizeUrl(user?.socials?.x) },
      { key: "linkedin", label: "LinkedIn", href: normalizeUrl(user?.socials?.linkedin) },
      { key: "instagram", label: "Instagram", href: normalizeUrl(user?.socials?.instagram) },
    ];
    return items.filter((i) => !!i.href);
  }, [user]);

  async function handleSave(e?: React.MouseEvent) {
    e?.preventDefault();
    setError(null);

    if (!user) return;

    try {
      setSaving(true);

      const updated = await userApi.updateMe({
        bio: bio.trim(),
        socials: {
          facebook: normalizeUrl(facebook),
          x: normalizeUrl(x),
          linkedin: normalizeUrl(linkedin),
          instagram: normalizeUrl(instagram),
        },
      });

      // ✅ update auth context
      setUser(updated);

      closeModal();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save profile.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
            {/* ✅ No image. Simple initials bubble */}
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-xl font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200">
              {(displayName || "?").slice(0, 2).toUpperCase()}
            </div>

            <div className="order-3 xl:order-2">
              <h4 className="mb-2 text-lg font-semibold text-center text-gray-800 dark:text-white/90 xl:text-left">
                {displayName}
              </h4>

              <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {user?.bio || "Bio / Title"}
                </p>
                <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {user?.email || ""}
                </p>
              </div>
            </div>

            {/* ✅ Social buttons (only show if exists) */}
            <div className="flex flex-wrap items-center order-2 gap-2 grow xl:order-3 xl:justify-end">
              {visibleSocials.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 items-center justify-center rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          <button
            onClick={openModal}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
          >
            Edit Profile
          </button>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px]">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Edit Profile
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Add or remove the socials you want displayed on your profile.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
            <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
              <div className="mb-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90">
                  Bio
                </h5>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5">
                  <div className="col-span-1">
                    <Label>Bio / Title</Label>
                    <Input
                      type="text"
                      value={bio}
                      onChange={(e) => setBio((e.target as HTMLInputElement).value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h5 className="mb-2 text-lg font-medium text-gray-800 dark:text-white/90">
                  Social Links
                </h5>
                <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
                  Tip: leave a field empty to hide that social link on your profile.
                </p>

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div>
                    <Label>Facebook</Label>
                    <Input
                      type="text"
                      placeholder="facebook.com/yourpage"
                      value={facebook}
                      onChange={(e) => setFacebook((e.target as HTMLInputElement).value)}
                    />
                  </div>

                  <div>
                    <Label>X</Label>
                    <Input
                      type="text"
                      placeholder="x.com/yourhandle"
                      value={x}
                      onChange={(e) => setX((e.target as HTMLInputElement).value)}
                    />
                  </div>

                  <div>
                    <Label>LinkedIn</Label>
                    <Input
                      type="text"
                      placeholder="linkedin.com/in/you"
                      value={linkedin}
                      onChange={(e) => setLinkedin((e.target as HTMLInputElement).value)}
                    />
                  </div>

                  <div>
                    <Label>Instagram</Label>
                    <Input
                      type="text"
                      placeholder="instagram.com/you"
                      value={instagram}
                      onChange={(e) => setInstagram((e.target as HTMLInputElement).value)}
                    />
                  </div>
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