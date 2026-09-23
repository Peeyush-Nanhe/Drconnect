import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/admin-users.functions.ts?tss-serverfn-split
async function assertSuperAdmin(ctx) {
	const { data, error } = await ctx.supabase.rpc("has_role", {
		_user_id: ctx.userId,
		_role: "super_admin"
	});
	if (error) throw new Error(error.message);
	if (!data) throw new Error("Forbidden: super admin only");
}
var APP_ROLES = [
	"patient",
	"provider",
	"facility",
	"admin",
	"super_admin"
];
var setUserRole_createServerFn_handler = createServerRpc({
	id: "1e217167414b4924fd876e4f13f21b9d69fbcae54912212d8878ffdec680c99c",
	name: "setUserRole",
	filename: "src/lib/admin-users.functions.ts"
}, (opts) => setUserRole.__executeServer(opts));
var setUserRole = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.userId) throw new Error("userId required");
	if (!APP_ROLES.includes(d?.role)) throw new Error("Invalid role");
	return d;
}).handler(setUserRole_createServerFn_handler, async ({ data, context }) => {
	await assertSuperAdmin(context);
	if (data.userId === context.userId && data.role !== "super_admin") throw new Error("You cannot change your own super_admin role");
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const { error: delErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
	if (delErr) throw new Error(delErr.message);
	const { error: insErr } = await supabaseAdmin.from("user_roles").insert({
		user_id: data.userId,
		role: data.role
	});
	if (insErr) throw new Error(insErr.message);
	const { data: accessRequest } = await supabaseAdmin.from("account_role_requests").select("requested_role, status").eq("user_id", data.userId).maybeSingle();
	if (accessRequest?.status === "pending" && accessRequest.requested_role === data.role) {
		const { error: requestErr } = await supabaseAdmin.from("account_role_requests").update({
			status: "approved",
			reviewed_by: context.userId,
			reviewed_at: (/* @__PURE__ */ new Date()).toISOString(),
			updated_at: (/* @__PURE__ */ new Date()).toISOString()
		}).eq("user_id", data.userId);
		if (requestErr) throw new Error(requestErr.message);
	}
	return { ok: true };
});
var listAllUsers_createServerFn_handler = createServerRpc({
	id: "e10435005fbac1eac489e1efa296b898180e9603592872b2bf2191ae3ef05607",
	name: "listAllUsers",
	filename: "src/lib/admin-users.functions.ts"
}, (opts) => listAllUsers.__executeServer(opts));
var listAllUsers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(listAllUsers_createServerFn_handler, async ({ context }) => {
	await assertSuperAdmin(context);
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const { data, error } = await supabaseAdmin.auth.admin.listUsers({
		page: 1,
		perPage: 200
	});
	if (error) throw new Error(error.message);
	const ids = data.users.map((u) => u.id);
	const [{ data: profiles }, { data: roles }, { data: requests }] = await Promise.all([
		supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", ids),
		supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
		supabaseAdmin.from("account_role_requests").select("user_id, requested_role, requested_view, status").in("user_id", ids)
	]);
	const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
	const roleMap = /* @__PURE__ */ new Map();
	(roles ?? []).forEach((r) => {
		const arr = roleMap.get(r.user_id) ?? [];
		arr.push(r.role);
		roleMap.set(r.user_id, arr);
	});
	const requestMap = new Map((requests ?? []).map((r) => [r.user_id, r]));
	return data.users.map((u) => {
		const p = profileMap.get(u.id);
		return {
			id: u.id,
			email: u.email ?? null,
			created_at: u.created_at,
			last_sign_in_at: u.last_sign_in_at ?? null,
			banned_until: u.banned_until ?? null,
			full_name: p?.full_name ?? null,
			phone: p?.phone ?? u.phone ?? null,
			roles: roleMap.get(u.id) ?? [],
			access_request: requestMap.get(u.id) ?? null
		};
	});
});
var resetUserPassword_createServerFn_handler = createServerRpc({
	id: "caa28eec3705d80cf8888fdf03635fee6e854df598deaf7fd8a2507a3298541b",
	name: "resetUserPassword",
	filename: "src/lib/admin-users.functions.ts"
}, (opts) => resetUserPassword.__executeServer(opts));
var resetUserPassword = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.userId) throw new Error("userId required");
	if (!d?.newPassword || d.newPassword.length < 8) throw new Error("Password must be at least 8 characters");
	return d;
}).handler(resetUserPassword_createServerFn_handler, async ({ data, context }) => {
	await assertSuperAdmin(context);
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.newPassword });
	if (error) throw new Error(error.message);
	return { ok: true };
});
var setUserDisabled_createServerFn_handler = createServerRpc({
	id: "ad9a5c076a7d8f335ed4449b0286d4bdb6e50cbd144aeb61ec8696c075b88db6",
	name: "setUserDisabled",
	filename: "src/lib/admin-users.functions.ts"
}, (opts) => setUserDisabled.__executeServer(opts));
var setUserDisabled = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.userId) throw new Error("userId required");
	return d;
}).handler(setUserDisabled_createServerFn_handler, async ({ data, context }) => {
	await assertSuperAdmin(context);
	if (data.userId === context.userId) throw new Error("You cannot disable your own account");
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: data.disabled ? "876000h" : "none" });
	if (error) throw new Error(error.message);
	return { ok: true };
});
var deleteUser_createServerFn_handler = createServerRpc({
	id: "6825df580faeca88f7d9ef3e1218c16ef32fd7ee1ff3bd0b96717bcccd44ccfb",
	name: "deleteUser",
	filename: "src/lib/admin-users.functions.ts"
}, (opts) => deleteUser.__executeServer(opts));
var deleteUser = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.userId) throw new Error("userId required");
	return d;
}).handler(deleteUser_createServerFn_handler, async ({ data, context }) => {
	await assertSuperAdmin(context);
	if (data.userId === context.userId) throw new Error("You cannot delete your own account");
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
	if (error) throw new Error(error.message);
	return { ok: true };
});
//#endregion
export { deleteUser_createServerFn_handler, listAllUsers_createServerFn_handler, resetUserPassword_createServerFn_handler, setUserDisabled_createServerFn_handler, setUserRole_createServerFn_handler };
