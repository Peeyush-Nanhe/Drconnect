import { n as supabase } from "./client-BSmVQfT1.js";
import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { n as buttonVariants, r as cn, t as Button } from "./button-BT328xhy.js";
import * as React$1 from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as SelectPrimitive from "@radix-ui/react-select";
//#region src/lib/admin-users.functions.ts
var APP_ROLES = [
	"patient",
	"provider",
	"facility",
	"admin",
	"super_admin"
];
var setUserRole = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.userId) throw new Error("userId required");
	if (!APP_ROLES.includes(d?.role)) throw new Error("Invalid role");
	return d;
}).handler(createSsrRpc("1e217167414b4924fd876e4f13f21b9d69fbcae54912212d8878ffdec680c99c"));
var listAllUsers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("e10435005fbac1eac489e1efa296b898180e9603592872b2bf2191ae3ef05607"));
var resetUserPassword = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.userId) throw new Error("userId required");
	if (!d?.newPassword || d.newPassword.length < 8) throw new Error("Password must be at least 8 characters");
	return d;
}).handler(createSsrRpc("caa28eec3705d80cf8888fdf03635fee6e854df598deaf7fd8a2507a3298541b"));
var setUserDisabled = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.userId) throw new Error("userId required");
	return d;
}).handler(createSsrRpc("ad9a5c076a7d8f335ed4449b0286d4bdb6e50cbd144aeb61ec8696c075b88db6"));
var deleteUser = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.userId) throw new Error("userId required");
	return d;
}).handler(createSsrRpc("6825df580faeca88f7d9ef3e1218c16ef32fd7ee1ff3bd0b96717bcccd44ccfb"));
//#endregion
//#region src/components/ui/input.tsx
var Input = React$1.forwardRef(({ className, type, ...props }, ref) => {
	return /* @__PURE__ */ jsx("input", {
		type,
		className: cn("flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className),
		ref,
		...props
	});
});
Input.displayName = "Input";
//#endregion
//#region src/components/ui/table.tsx
var Table = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx("div", {
	className: "relative w-full overflow-auto",
	children: /* @__PURE__ */ jsx("table", {
		ref,
		className: cn("w-full caption-bottom text-sm", className),
		...props
	})
}));
Table.displayName = "Table";
var TableHeader = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx("thead", {
	ref,
	className: cn("[&_tr]:border-b", className),
	...props
}));
TableHeader.displayName = "TableHeader";
var TableBody = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx("tbody", {
	ref,
	className: cn("[&_tr:last-child]:border-0", className),
	...props
}));
TableBody.displayName = "TableBody";
var TableFooter = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx("tfoot", {
	ref,
	className: cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className),
	...props
}));
TableFooter.displayName = "TableFooter";
var TableRow = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx("tr", {
	ref,
	className: cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className),
	...props
}));
TableRow.displayName = "TableRow";
var TableHead = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx("th", {
	ref,
	className: cn("h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className),
	...props
}));
TableHead.displayName = "TableHead";
var TableCell = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx("td", {
	ref,
	className: cn("p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className),
	...props
}));
TableCell.displayName = "TableCell";
var TableCaption = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx("caption", {
	ref,
	className: cn("mt-4 text-sm text-muted-foreground", className),
	...props
}));
TableCaption.displayName = "TableCaption";
//#endregion
//#region src/components/ui/dialog.tsx
var Dialog = DialogPrimitive.Root;
var DialogPortal = DialogPrimitive.Portal;
var DialogOverlay = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(DialogPrimitive.Overlay, {
	ref,
	className: cn("fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props
}));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
var DialogContent = React$1.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs(DialogPortal, { children: [/* @__PURE__ */ jsx(DialogOverlay, {}), /* @__PURE__ */ jsxs(DialogPrimitive.Content, {
	ref,
	className: cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg", className),
	...props,
	children: [children, /* @__PURE__ */ jsxs(DialogPrimitive.Close, {
		className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
		children: [/* @__PURE__ */ jsx(X, { className: "h-4 w-4" }), /* @__PURE__ */ jsx("span", {
			className: "sr-only",
			children: "Close"
		})]
	})]
})] }));
DialogContent.displayName = DialogPrimitive.Content.displayName;
var DialogHeader = ({ className, ...props }) => /* @__PURE__ */ jsx("div", {
	className: cn("flex flex-col space-y-1.5 text-center sm:text-left", className),
	...props
});
DialogHeader.displayName = "DialogHeader";
var DialogFooter = ({ className, ...props }) => /* @__PURE__ */ jsx("div", {
	className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className),
	...props
});
DialogFooter.displayName = "DialogFooter";
var DialogTitle = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(DialogPrimitive.Title, {
	ref,
	className: cn("text-lg font-semibold leading-none tracking-tight", className),
	...props
}));
DialogTitle.displayName = DialogPrimitive.Title.displayName;
var DialogDescription = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(DialogPrimitive.Description, {
	ref,
	className: cn("text-sm text-muted-foreground", className),
	...props
}));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
//#endregion
//#region src/components/ui/alert-dialog.tsx
var AlertDialog = AlertDialogPrimitive.Root;
var AlertDialogPortal = AlertDialogPrimitive.Portal;
var AlertDialogOverlay = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(AlertDialogPrimitive.Overlay, {
	className: cn("fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
	...props,
	ref
}));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;
var AlertDialogContent = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxs(AlertDialogPortal, { children: [/* @__PURE__ */ jsx(AlertDialogOverlay, {}), /* @__PURE__ */ jsx(AlertDialogPrimitive.Content, {
	ref,
	className: cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg", className),
	...props
})] }));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;
var AlertDialogHeader = ({ className, ...props }) => /* @__PURE__ */ jsx("div", {
	className: cn("flex flex-col space-y-2 text-center sm:text-left", className),
	...props
});
AlertDialogHeader.displayName = "AlertDialogHeader";
var AlertDialogFooter = ({ className, ...props }) => /* @__PURE__ */ jsx("div", {
	className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className),
	...props
});
AlertDialogFooter.displayName = "AlertDialogFooter";
var AlertDialogTitle = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(AlertDialogPrimitive.Title, {
	ref,
	className: cn("text-lg font-semibold", className),
	...props
}));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;
var AlertDialogDescription = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(AlertDialogPrimitive.Description, {
	ref,
	className: cn("text-sm text-muted-foreground", className),
	...props
}));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;
var AlertDialogAction = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(AlertDialogPrimitive.Action, {
	ref,
	className: cn(buttonVariants(), className),
	...props
}));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;
var AlertDialogCancel = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(AlertDialogPrimitive.Cancel, {
	ref,
	className: cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className),
	...props
}));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;
//#endregion
//#region src/components/ui/select.tsx
var Select = SelectPrimitive.Root;
var SelectValue = SelectPrimitive.Value;
var SelectTrigger = React$1.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs(SelectPrimitive.Trigger, {
	ref,
	className: cn("flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background cursor-pointer data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1", className),
	...props,
	children: [children, /* @__PURE__ */ jsx(SelectPrimitive.Icon, {
		asChild: true,
		children: /* @__PURE__ */ jsx(ChevronDown, { className: "h-4 w-4 opacity-50" })
	})]
}));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;
var SelectScrollUpButton = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(SelectPrimitive.ScrollUpButton, {
	ref,
	className: cn("flex cursor-default items-center justify-center py-1", className),
	...props,
	children: /* @__PURE__ */ jsx(ChevronUp, { className: "h-4 w-4" })
}));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;
var SelectScrollDownButton = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(SelectPrimitive.ScrollDownButton, {
	ref,
	className: cn("flex cursor-default items-center justify-center py-1", className),
	...props,
	children: /* @__PURE__ */ jsx(ChevronDown, { className: "h-4 w-4" })
}));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;
var SelectContent = React$1.forwardRef(({ className, children, position = "popper", ...props }, ref) => /* @__PURE__ */ jsx(SelectPrimitive.Portal, { children: /* @__PURE__ */ jsxs(SelectPrimitive.Content, {
	ref,
	className: cn("relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-select-content-transform-origin)", position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1", className),
	position,
	...props,
	children: [
		/* @__PURE__ */ jsx(SelectScrollUpButton, {}),
		/* @__PURE__ */ jsx(SelectPrimitive.Viewport, {
			className: cn("p-1", position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"),
			children
		}),
		/* @__PURE__ */ jsx(SelectScrollDownButton, {})
	]
}) }));
SelectContent.displayName = SelectPrimitive.Content.displayName;
var SelectLabel = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(SelectPrimitive.Label, {
	ref,
	className: cn("px-2 py-1.5 text-sm font-semibold", className),
	...props
}));
SelectLabel.displayName = SelectPrimitive.Label.displayName;
var SelectItem = React$1.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs(SelectPrimitive.Item, {
	ref,
	className: cn("relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className),
	...props,
	children: [/* @__PURE__ */ jsx("span", {
		className: "absolute right-2 flex h-3.5 w-3.5 items-center justify-center",
		children: /* @__PURE__ */ jsx(SelectPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx(Check, { className: "h-4 w-4" }) })
	}), /* @__PURE__ */ jsx(SelectPrimitive.ItemText, { children })]
}));
SelectItem.displayName = SelectPrimitive.Item.displayName;
var SelectSeparator = React$1.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(SelectPrimitive.Separator, {
	ref,
	className: cn("-mx-1 my-1 h-px bg-muted", className),
	...props
}));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;
//#endregion
//#region src/routes/admin.users.tsx?tsr-split=component
var ROLE_OPTIONS = [
	"patient",
	"provider",
	"facility",
	"admin",
	"super_admin"
];
var ROLE_PRIORITY = [...ROLE_OPTIONS].reverse();
function AdminUsersPage() {
	const navigate = useNavigate();
	const [checking, setChecking] = useState(true);
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState(null);
	const [filter, setFilter] = useState("");
	const [pwUser, setPwUser] = useState(null);
	const [pwValue, setPwValue] = useState("");
	const [pwBusy, setPwBusy] = useState(false);
	const [delUser, setDelUser] = useState(null);
	const [busyId, setBusyId] = useState(null);
	const listFn = useServerFn(listAllUsers);
	const resetFn = useServerFn(resetUserPassword);
	const disableFn = useServerFn(setUserDisabled);
	const deleteFn = useServerFn(deleteUser);
	const roleFn = useServerFn(setUserRole);
	const [meId, setMeId] = useState(null);
	useEffect(() => {
		(async () => {
			const { data: sess } = await supabase.auth.getSession();
			const uid = sess.session?.user?.id;
			if (!uid) {
				navigate({
					to: "/auth",
					search: {
						admin: void 0,
						next: void 0
					}
				});
				return;
			}
			const { data } = await supabase.rpc("has_role", {
				_user_id: uid,
				_role: "super_admin"
			});
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
			setRows(data);
		} catch (e) {
			setLoadError(e.message ?? "Failed to load users");
		} finally {
			setLoading(false);
		}
	};
	useEffect(() => {
		if (!checking) refresh();
	}, [checking]);
	if (checking) return /* @__PURE__ */ jsx("div", {
		className: "flex min-h-screen items-center justify-center text-sm text-slate-500",
		children: "Checking access…"
	});
	const filtered = rows.filter((r) => {
		const q = filter.toLowerCase().trim();
		if (!q) return true;
		return (r.email ?? "").toLowerCase().includes(q) || (r.full_name ?? "").toLowerCase().includes(q) || r.roles.join(",").toLowerCase().includes(q) || (r.access_request?.requested_role ?? "").toLowerCase().includes(q) || (r.access_request?.requested_view ?? "").toLowerCase().includes(q);
	});
	const isDisabled = (r) => !!r.banned_until && new Date(r.banned_until).getTime() > Date.now();
	const handleResetPassword = async () => {
		if (!pwUser) return;
		setPwBusy(true);
		try {
			await resetFn({ data: {
				userId: pwUser.id,
				newPassword: pwValue
			} });
			toast.success(`Password updated for ${pwUser.email}`);
			setPwUser(null);
			setPwValue("");
		} catch (e) {
			toast.error(e.message ?? "Failed to reset password");
		} finally {
			setPwBusy(false);
		}
	};
	const handleToggleDisabled = async (r) => {
		setBusyId(r.id);
		try {
			await disableFn({ data: {
				userId: r.id,
				disabled: !isDisabled(r)
			} });
			toast.success(isDisabled(r) ? "User enabled" : "User disabled");
			await refresh();
		} catch (e) {
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
		} catch (e) {
			toast.error(e.message ?? "Delete failed");
		} finally {
			setBusyId(null);
		}
	};
	const handleRoleChange = async (r, newRole) => {
		if (r.roles[0] === newRole && r.roles.length === 1) return;
		setBusyId(r.id);
		try {
			await roleFn({ data: {
				userId: r.id,
				role: newRole
			} });
			toast.success(`Role set to ${newRole} for ${r.email}`);
			await refresh();
		} catch (e) {
			toast.error(e.message ?? "Failed to change role");
		} finally {
			setBusyId(null);
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen bg-slate-50 px-4 py-8",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "mx-auto max-w-6xl",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "mb-6 flex flex-wrap items-center justify-between gap-3",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
							className: "text-2xl font-extrabold text-slate-900",
							children: "User Management"
						}), /* @__PURE__ */ jsx("p", {
							className: "text-sm text-slate-600",
							children: "View, edit password, disable, or delete accounts."
						})] }), /* @__PURE__ */ jsxs("div", {
							className: "flex gap-2",
							children: [/* @__PURE__ */ jsx(Link, {
								to: "/admin/live",
								className: "text-sm font-semibold text-teal-700 hover:underline",
								children: "Live stats →"
							}), /* @__PURE__ */ jsx(Link, {
								to: "/",
								className: "text-sm font-semibold text-teal-700 hover:underline",
								children: "← Back"
							})]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mb-4 flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ jsx(Input, {
								"aria-label": "Search users",
								placeholder: "Search email, name or role…",
								value: filter,
								onChange: (e) => setFilter(e.target.value),
								className: "max-w-sm"
							}),
							/* @__PURE__ */ jsx(Button, {
								variant: "outline",
								size: "sm",
								onClick: refresh,
								disabled: loading,
								children: loading ? "Loading…" : "Refresh"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "text-xs text-slate-500",
								children: loadError ? "User list unavailable" : `${filtered.length} of ${rows.length} users`
							})
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "overflow-hidden rounded-lg border border-slate-200 bg-white",
						children: [loadError && /* @__PURE__ */ jsx("p", {
							role: "alert",
							className: "m-4 rounded-lg bg-red-50 p-3 text-sm text-red-800",
							children: loadError
						}), /* @__PURE__ */ jsxs(Table, { children: [/* @__PURE__ */ jsx(TableHeader, { children: /* @__PURE__ */ jsxs(TableRow, { children: [
							/* @__PURE__ */ jsx(TableHead, { children: "Email" }),
							/* @__PURE__ */ jsx(TableHead, { children: "Name" }),
							/* @__PURE__ */ jsx(TableHead, { children: "Roles" }),
							/* @__PURE__ */ jsx(TableHead, { children: "Status" }),
							/* @__PURE__ */ jsx(TableHead, { children: "Last sign-in" }),
							/* @__PURE__ */ jsx(TableHead, {
								className: "text-right",
								children: "Actions"
							})
						] }) }), /* @__PURE__ */ jsx(TableBody, { children: loading ? /* @__PURE__ */ jsx(TableRow, { children: /* @__PURE__ */ jsx(TableCell, {
							colSpan: 6,
							className: "py-8 text-center text-slate-500",
							children: "Loading…"
						}) }) : filtered.length === 0 ? /* @__PURE__ */ jsx(TableRow, { children: /* @__PURE__ */ jsx(TableCell, {
							colSpan: 6,
							className: "py-8 text-center text-slate-500",
							children: loadError ? "Could not load users. Use Refresh to try again." : "No users found."
						}) }) : filtered.map((r) => {
							const disabled = isDisabled(r);
							return /* @__PURE__ */ jsxs(TableRow, { children: [
								/* @__PURE__ */ jsx(TableCell, {
									className: "font-medium",
									children: r.email ?? "—"
								}),
								/* @__PURE__ */ jsx(TableCell, { children: r.full_name ?? "—" }),
								/* @__PURE__ */ jsxs(TableCell, { children: [
									/* @__PURE__ */ jsxs(Select, {
										value: ROLE_PRIORITY.find((role) => r.roles.includes(role)) ?? "",
										onValueChange: (v) => handleRoleChange(r, v),
										disabled: busyId === r.id || r.id === meId && r.roles.includes("super_admin"),
										children: [/* @__PURE__ */ jsx(SelectTrigger, {
											className: "h-8 w-[130px]",
											children: /* @__PURE__ */ jsx(SelectValue, { placeholder: "No role" })
										}), /* @__PURE__ */ jsx(SelectContent, { children: ROLE_OPTIONS.map((role) => /* @__PURE__ */ jsx(SelectItem, {
											value: role,
											children: role
										}, role)) })]
									}),
									r.roles.length > 1 ? /* @__PURE__ */ jsxs("div", {
										className: "mt-1 text-[10px] text-slate-500",
										children: ["roles: ", r.roles.join(", ")]
									}) : null,
									r.access_request ? /* @__PURE__ */ jsxs("div", {
										className: "mt-1 text-[10px] text-slate-500",
										children: [
											"requested: ",
											/* @__PURE__ */ jsx("b", { children: r.access_request.requested_role }),
											r.access_request.requested_view ? ` · ${r.access_request.requested_view}` : "",
											" · ",
											r.access_request.status
										]
									}) : null,
									r.access_request?.status === "pending" ? /* @__PURE__ */ jsxs("button", {
										type: "button",
										className: "mt-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100",
										onClick: () => handleRoleChange(r, r.access_request.requested_role),
										disabled: busyId === r.id,
										children: ["Approve ", r.access_request.requested_role]
									}) : null
								] }),
								/* @__PURE__ */ jsx(TableCell, { children: disabled ? /* @__PURE__ */ jsx("span", {
									className: "rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700",
									children: "DISABLED"
								}) : /* @__PURE__ */ jsx("span", {
									className: "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700",
									children: "ACTIVE"
								}) }),
								/* @__PURE__ */ jsx(TableCell, {
									className: "text-xs text-slate-500",
									children: r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString() : "never"
								}),
								/* @__PURE__ */ jsx(TableCell, {
									className: "text-right",
									children: /* @__PURE__ */ jsxs("div", {
										className: "flex justify-end gap-2",
										children: [
											/* @__PURE__ */ jsx(Button, {
												size: "sm",
												variant: "outline",
												onClick: () => {
													setPwUser(r);
													setPwValue("");
												},
												disabled: busyId === r.id,
												children: "Password"
											}),
											/* @__PURE__ */ jsx(Button, {
												size: "sm",
												variant: disabled ? "default" : "secondary",
												onClick: () => handleToggleDisabled(r),
												disabled: busyId === r.id,
												children: disabled ? "Enable" : "Disable"
											}),
											/* @__PURE__ */ jsx(Button, {
												size: "sm",
												variant: "destructive",
												onClick: () => setDelUser(r),
												disabled: busyId === r.id,
												children: "Delete"
											})
										]
									})
								})
							] }, r.id);
						}) })] })]
					})
				]
			}),
			/* @__PURE__ */ jsx(Dialog, {
				open: !!pwUser,
				onOpenChange: (o) => !o && setPwUser(null),
				children: /* @__PURE__ */ jsxs(DialogContent, { children: [
					/* @__PURE__ */ jsx(DialogHeader, { children: /* @__PURE__ */ jsx(DialogTitle, { children: "Set new password" }) }),
					/* @__PURE__ */ jsxs("div", {
						className: "space-y-3",
						children: [
							/* @__PURE__ */ jsxs("p", {
								className: "text-sm text-slate-600",
								children: ["For ", /* @__PURE__ */ jsx("span", {
									className: "font-semibold",
									children: pwUser?.email
								})]
							}),
							/* @__PURE__ */ jsx(Input, {
								type: "text",
								placeholder: "New password (min 8 chars)",
								value: pwValue,
								onChange: (e) => setPwValue(e.target.value),
								autoFocus: true
							}),
							/* @__PURE__ */ jsx("p", {
								className: "text-xs text-slate-500",
								children: "User will be able to sign in with this password immediately."
							})
						]
					}),
					/* @__PURE__ */ jsxs(DialogFooter, { children: [/* @__PURE__ */ jsx(Button, {
						variant: "outline",
						onClick: () => setPwUser(null),
						disabled: pwBusy,
						children: "Cancel"
					}), /* @__PURE__ */ jsx(Button, {
						onClick: handleResetPassword,
						disabled: pwBusy || pwValue.length < 8,
						children: pwBusy ? "Saving…" : "Update password"
					})] })
				] })
			}),
			/* @__PURE__ */ jsx(AlertDialog, {
				open: !!delUser,
				onOpenChange: (o) => !o && setDelUser(null),
				children: /* @__PURE__ */ jsxs(AlertDialogContent, { children: [/* @__PURE__ */ jsxs(AlertDialogHeader, { children: [/* @__PURE__ */ jsx(AlertDialogTitle, { children: "Delete this user?" }), /* @__PURE__ */ jsxs(AlertDialogDescription, { children: [
					"Permanently removes ",
					/* @__PURE__ */ jsx("span", {
						className: "font-semibold",
						children: delUser?.email
					}),
					" and their auth account. This cannot be undone."
				] })] }), /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [/* @__PURE__ */ jsx(AlertDialogCancel, { children: "Cancel" }), /* @__PURE__ */ jsx(AlertDialogAction, {
					onClick: handleDelete,
					className: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
					children: "Delete permanently"
				})] })] })
			})
		]
	});
}
//#endregion
export { AdminUsersPage as component };
