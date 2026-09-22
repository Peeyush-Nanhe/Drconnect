import { n as supabase } from "./client-BSmVQfT1.js";
import { useCallback, useEffect, useState } from "react";
//#region src/features/medconnect/backend.ts
async function fetchRole(userId) {
	const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).order("role", { ascending: true });
	if (!data || data.length === 0) return null;
	const roles = data.map((r) => r.role);
	for (const r of [
		"super_admin",
		"admin",
		"facility",
		"provider",
		"patient"
	]) if (roles.includes(r)) return r;
	return roles[0] ?? null;
}
function useSession() {
	const [state, setState] = useState({
		session: null,
		user: null,
		role: null,
		loading: true
	});
	useEffect(() => {
		let mounted = true;
		const hydrate = async (session) => {
			if (!session?.user) {
				if (mounted) setState({
					session: null,
					user: null,
					role: null,
					loading: false
				});
				return;
			}
			const role = await fetchRole(session.user.id);
			if (mounted) setState({
				session,
				user: session.user,
				role,
				loading: false
			});
		};
		supabase.auth.getSession().then(({ data }) => hydrate(data.session));
		const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
			setTimeout(() => hydrate(session), 0);
		});
		return () => {
			mounted = false;
			sub.subscription.unsubscribe();
		};
	}, []);
	return state;
}
function threadKeyOf(a, b) {
	return [a, b].sort().join(":");
}
var DEMO_USERS = {
	"priya sharma": "098ad3c8-3a77-4702-8494-ec007855e219",
	"rahul verma": "26fe34e0-1757-400b-9ffd-5325aa1b32b6",
	"meena tiwari": "098ad3c8-3a77-4702-8494-ec007855e219",
	"dr. anita rao": "490a20be-87cd-4340-b462-3429472e9d02",
	"anita rao": "490a20be-87cd-4340-b462-3429472e9d02",
	"dr. vikram iyer": "5f27622d-117e-4772-ad6d-f45ce90898fe",
	"vikram iyer": "5f27622d-117e-4772-ad6d-f45ce90898fe"
};
async function lookupUserIdByName(name) {
	if (!name) return null;
	const clean = name.trim();
	const { data } = await supabase.from("profiles").select("id, full_name").ilike("full_name", clean).limit(1);
	if (data && data.length) return data[0].id;
	const bare = clean.replace(/^Dr\.?\s+/i, "");
	const { data: d2 } = await supabase.from("profiles").select("id, full_name").ilike("full_name", `%${bare}%`).limit(1);
	if (d2 && d2.length) return d2[0].id;
	const norm = clean.toLowerCase();
	if (DEMO_USERS[norm]) return DEMO_USERS[norm];
	const bareNorm = bare.toLowerCase();
	if (DEMO_USERS[bareNorm]) return DEMO_USERS[bareNorm];
	return null;
}
function useRealtimeChat(counterpartName) {
	const [messages, setMessages] = useState([]);
	const [meId, setMeId] = useState(null);
	const [otherId, setOtherId] = useState(null);
	const [ready, setReady] = useState(false);
	useEffect(() => {
		let mounted = true;
		setReady(false);
		setMessages([]);
		(async () => {
			const { data: sess } = await supabase.auth.getSession();
			const uid = sess.session?.user?.id ?? null;
			if (!mounted) return;
			setMeId(uid);
			if (!uid || !counterpartName) {
				setReady(true);
				return;
			}
			const other = await lookupUserIdByName(counterpartName);
			if (!mounted) return;
			setOtherId(other);
			if (!other) {
				setReady(true);
				return;
			}
			const tk = threadKeyOf(uid, other);
			const { data } = await supabase.from("chat_messages").select("*").eq("thread_key", tk).order("created_at", { ascending: true }).limit(200);
			if (!mounted) return;
			setMessages(data ?? []);
			setReady(true);
			const ch = supabase.channel(`chat_${tk}`).on("postgres_changes", {
				event: "INSERT",
				schema: "public",
				table: "chat_messages",
				filter: `thread_key=eq.${tk}`
			}, (payload) => {
				setMessages((prev) => {
					const m = payload.new;
					if (prev.some((x) => x.id === m.id)) return prev;
					return [...prev, m];
				});
			}).subscribe();
			return () => {
				supabase.removeChannel(ch);
			};
		})();
		return () => {
			mounted = false;
		};
	}, [counterpartName]);
	return {
		messages,
		send: useCallback(async (body) => {
			const text = body.trim();
			if (!text || !meId || !otherId) return false;
			const tk = threadKeyOf(meId, otherId);
			const { error } = await supabase.from("chat_messages").insert({
				thread_key: tk,
				sender_id: meId,
				recipient_id: otherId,
				body: text
			});
			return !error;
		}, [meId, otherId]),
		meId,
		otherId,
		ready,
		live: !!(meId && otherId)
	};
}
//#endregion
export { useSession as n, useRealtimeChat as t };
