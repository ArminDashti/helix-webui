import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { createUser, deleteUser, fetchUsers, updateUser } from "../api/client.js";
import DataGrid from "../components/DataGrid.jsx";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import useFlash from "../lib/useFlash.js";

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

const emptyUserForm = {
  username: "",
  display_name: "",
  is_admin: false,
};

function isArmin(user) {
  return user?.id === "armin" || user?.username === "armin";
}

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useFlash();
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [editingUserId, setEditingUserId] = useState(null);

  async function reload() {
    const userList = await fetchUsers();
    setUsers(userList || []);
  }

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function resetUserForm() {
    setUserForm(emptyUserForm);
    setEditingUserId(null);
  }

  async function handleSaveUser(event) {
    event.preventDefault();
    setError(null);
    try {
      const payload = {
        username: userForm.username.trim(),
        display_name: userForm.display_name.trim(),
        is_admin: userForm.is_admin,
      };
      if (editingUserId) {
        await updateUser(editingUserId, payload);
        setStatus("User saved.");
      } else {
        await createUser(payload);
        setStatus("User created.");
      }
      resetUserForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "User save failed");
    }
  }

  async function handleDeleteUser(user) {
    if (isArmin(user)) {
      setError("Cannot delete the default admin armin");
      return;
    }
    if (!window.confirm(`Delete user “${user.username}”?`)) return;
    setError(null);
    try {
      await deleteUser(user.id);
      if (editingUserId === user.id) resetUserForm();
      setStatus("User deleted.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "User delete failed");
    }
  }

  const userRows = useMemo(
    () => users.map((item) => ({ key: item.id, item })),
    [users],
  );

  const userColumns = [
    { key: "username", label: "Username", render: (user) => user.username },
    { key: "display", label: "Name", render: (user) => user.display_name },
    {
      key: "admin",
      label: "Admin",
      render: (user) => (user.is_admin ? "Yes" : "No"),
    },
    {
      key: "edit",
      label: "Edit",
      render: (user) => (
        <IconButton
          type="button"
          icon={Pencil}
          onClick={() => {
            setEditingUserId(user.id);
            setUserForm({
              username: user.username,
              display_name: user.display_name,
              is_admin: Boolean(user.is_admin),
            });
          }}
          className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
        >
          Edit
        </IconButton>
      ),
    },
    {
      key: "delete",
      label: "Delete",
      render: (user) =>
        isArmin(user) ? (
          <span className="text-xs text-muted">Default admin</span>
        ) : (
        <IconButton
          type="button"
          icon={Trash2}
          onClick={() => handleDeleteUser(user)}
          className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
        >
          Delete
        </IconButton>
        ),
    },
  ];

  if (loading) {
    return <p className="text-sm text-muted">Loading admin…</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader icon={Shield} title="Admin" />
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <FlashMessage message={status} />

      <section className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-line/80 bg-paper/80 p-4">
        <h2 className="font-display text-base text-ink">Users</h2>
        <form onSubmit={handleSaveUser} className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium text-ink">Username</span>
              <input
                value={userForm.username}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, username: e.target.value }))
                }
                className={inputClass}
                required
                disabled={Boolean(editingUserId)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">Display name</span>
              <input
                value={userForm.display_name}
                onChange={(e) =>
                  setUserForm((prev) => ({
                    ...prev,
                    display_name: e.target.value,
                  }))
                }
                className={inputClass}
                required
              />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={userForm.is_admin || isArmin(userForm)}
                disabled={editingUserId === "armin" || isArmin(userForm)}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, is_admin: e.target.checked }))
                }
              />
              <span className="font-medium text-ink">Admin</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <IconButton
              type="submit"
              icon={editingUserId ? Pencil : Plus}
              className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep"
            >
              {editingUserId ? "Save user" : "Add user"}
            </IconButton>
            {editingUserId ? (
              <button
                type="button"
                onClick={resetUserForm}
                className="rounded-xl border border-line px-3 py-2 text-sm"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        <DataGrid columns={userColumns} rows={userRows} emptyLabel="No users" />
      </section>
    </div>
  );
}
