import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllUsers,
  resetUserPassword,
  setUserDisabled,
  deleteUser,
  setUserRole,
  type AppRole,
} from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLE_OPTIONS: AppRole[] = ["patient", "provider", "facility", "admin", "super_admin"];
const ROLE_PRIORITY = [...ROLE_OPTIONS].reverse();

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "User Management — MyDox Admin" },
      { name: "description", content: "Admin: manage all user accounts." },
    ],
  }),
  component: AdminUsersPage,
});

type Row = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  full_name: string | null;
  phone: string | null;
  roles: string[];
  access_request: { requested_role: AppRole; requested_view: string | null; status: string } | null;
};

function AdminUsersPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [pwUser, setPwUser] = useState<Row | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [delUser, setDelUser] = useState<Row | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const listFn = useServerFn(listAllUsers);
  const resetFn = useServerFn(resetUserPassword);
  const disableFn = useServerFn(setUserDisabled);
  const deleteFn = useServerFn(deleteUser);
  const roleFn = useServerFn(setUserRole);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        navigate({ to: "/auth", search: { admin: undefined, next: undefined } });
        return;
      }
      const { data } = await supabase.rpc("has_role", { _user_id: uid, _role: "super_admin" });
      if (!data) {
        toast.error("Super admin access required");
        navigate({ to: "/" });
        return;
      }
      setMeId(uid);
      setChecking(false);
    })();
  }, [navigate]);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listFn();
      setRows(data as Row[]);
    } catch (e: any) {
      setLoadError(e.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!checking) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Checking access…
      </div>
    );
  }

  const filtered = rows.filter((r) => {
    const q = filter.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.full_name ?? "").toLowerCase().includes(q) ||
      r.roles.join(",").toLowerCase().includes(q) ||
      (r.access_request?.requested_role ?? "").toLowerCase().includes(q) ||
      (r.access_request?.requested_view ?? "").toLowerCase().includes(q)
    );
  });

  const isDisabled = (r: Row) =>
    !!r.banned_until && new Date(r.banned_until).getTime() > Date.now();

  const handleResetPassword = async () => {
    if (!pwUser) return;
    setPwBusy(true);
    try {
      await resetFn({ data: { userId: pwUser.id, newPassword: pwValue } });
      toast.success(`Password updated for ${pwUser.email}`);
      setPwUser(null);
      setPwValue("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to reset password");
    } finally {
      setPwBusy(false);
    }
  };

  const handleToggleDisabled = async (r: Row) => {
    setBusyId(r.id);
    try {
      await disableFn({ data: { userId: r.id, disabled: !isDisabled(r) } });
      toast.success(isDisabled(r) ? "User enabled" : "User disabled");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!delUser) return;
    setBusyId(delUser.id);
    try {
      await deleteFn({ data: { userId: delUser.id } });
      toast.success(`Deleted ${delUser.email}`);
      setDelUser(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleRoleChange = async (r: Row, newRole: AppRole) => {
    if (r.roles[0] === newRole && r.roles.length === 1) return;
    setBusyId(r.id);
    try {
      await roleFn({ data: { userId: r.id, role: newRole } });
      toast.success(`Role set to ${newRole} for ${r.email}`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to change role");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">User Management</h1>
            <p className="text-sm text-slate-600">
              View, edit password, disable, or delete accounts.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin/live"
              className="text-sm font-semibold text-teal-700 hover:underline"
            >
              Live stats →
            </Link>
            <Link to="/" className="text-sm font-semibold text-teal-700 hover:underline">
              ← Back
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            aria-label="Search users"
            placeholder="Search email, name or role…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
          <span className="text-xs text-slate-500">
            {loadError ? "User list unavailable" : `${filtered.length} of ${rows.length} users`}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {loadError && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{loadError}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                    {loadError ? "Could not load users. Use Refresh to try again." : "No users found."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const disabled = isDisabled(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.email ?? "—"}</TableCell>
                      <TableCell>{r.full_name ?? "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={ROLE_PRIORITY.find((role) => r.roles.includes(role)) ?? ""}
                          onValueChange={(v) => handleRoleChange(r, v as AppRole)}
                          disabled={
                            busyId === r.id || (r.id === meId && r.roles.includes("super_admin"))
                          }
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue placeholder="No role" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {r.roles.length > 1 ? (
                          <div className="mt-1 text-[10px] text-slate-500">
                            roles: {r.roles.join(", ")}
                          </div>
                        ) : null}
                        {r.access_request ? (
                          <div className="mt-1 text-[10px] text-slate-500">
                            requested: <b>{r.access_request.requested_role}</b>{r.access_request.requested_view ? ` · ${r.access_request.requested_view}` : ""} · {r.access_request.status}
                          </div>
                        ) : null}
                        {r.access_request?.status === "pending" ? (
                          <button
                            type="button"
                            className="mt-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
                            onClick={() => handleRoleChange(r, r.access_request!.requested_role)}
                            disabled={busyId === r.id}
                          >
                            Approve {r.access_request.requested_role}
                          </button>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {disabled ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                            DISABLED
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                            ACTIVE
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {r.last_sign_in_at
                          ? new Date(r.last_sign_in_at).toLocaleString()
                          : "never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPwUser(r);
                              setPwValue("");
                            }}
                            disabled={busyId === r.id}
                          >
                            Password
                          </Button>
                          <Button
                            size="sm"
                            variant={disabled ? "default" : "secondary"}
                            onClick={() => handleToggleDisabled(r)}
                            disabled={busyId === r.id}
                          >
                            {disabled ? "Enable" : "Disable"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDelUser(r)}
                            disabled={busyId === r.id}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Password dialog */}
      <Dialog open={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set new password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              For <span className="font-semibold">{pwUser?.email}</span>
            </p>
            <Input
              type="text"
              placeholder="New password (min 8 chars)"
              value={pwValue}
              onChange={(e) => setPwValue(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-slate-500">
              User will be able to sign in with this password immediately.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwUser(null)} disabled={pwBusy}>
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={pwBusy || pwValue.length < 8}
            >
              {pwBusy ? "Saving…" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!delUser} onOpenChange={(o) => !o && setDelUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently removes <span className="font-semibold">{delUser?.email}</span> and
              their auth account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
