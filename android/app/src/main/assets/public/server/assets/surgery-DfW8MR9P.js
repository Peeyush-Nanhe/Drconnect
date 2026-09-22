import { n as supabase } from "./client-BSmVQfT1.js";
import { useCallback, useEffect, useState } from "react";
//#region src/features/mydox/surgery.ts
var SURGERY_ROLE_LABELS = {
	surgeon: "Surgeon",
	anaesthetist: "Anaesthetist",
	obstetrician: "Obstetrician",
	paediatrician: "Paediatrician",
	ot_technician: "OT Technician",
	scrub_nurse: "Scrub Nurse",
	other: "Other"
};
var PROCEDURE_PRESETS = [
	{
		name: "C-section",
		roles: [
			"obstetrician",
			"anaesthetist",
			"paediatrician",
			"ot_technician",
			"scrub_nurse"
		]
	},
	{
		name: "Normal Delivery",
		roles: [
			"obstetrician",
			"paediatrician",
			"scrub_nurse"
		]
	},
	{
		name: "Appendectomy",
		roles: [
			"surgeon",
			"anaesthetist",
			"ot_technician"
		]
	},
	{
		name: "Fracture / Ortho",
		roles: [
			"surgeon",
			"anaesthetist",
			"ot_technician"
		]
	},
	{
		name: "Cataract",
		roles: [
			"surgeon",
			"anaesthetist",
			"scrub_nurse"
		]
	},
	{
		name: "Emergency Trauma",
		roles: [
			"surgeon",
			"anaesthetist",
			"ot_technician",
			"scrub_nurse"
		]
	}
];
var BLOOD_GROUPS = [
	"A+",
	"A-",
	"B+",
	"B-",
	"AB+",
	"AB-",
	"O+",
	"O-"
];
var SURGERY_TEST_OTP = "0000";
function surgeryChatThreadKey(roleId) {
	return `surgery:${roleId}`;
}
/** Hub confirms the accepted role → generates OTP + stamps paid_at. */
async function hubConfirmSurgeryRole(roleId) {
	const otp = SURGERY_TEST_OTP;
	const { error } = await supabase.from("surgery_booking_roles").update({
		paid_at: (/* @__PURE__ */ new Date()).toISOString(),
		otp
	}).eq("id", roleId).is("paid_at", null);
	if (error) throw error;
	return otp;
}
/** Provider verifies the hub-supplied OTP. Returns true on match. */
async function providerVerifySurgeryOtp(roleId, entered) {
	const { data } = await supabase.from("surgery_booking_roles").select("otp, otp_verified_at").eq("id", roleId).maybeSingle();
	const row = data;
	if (!row || !row.otp) return false;
	if (row.otp_verified_at) return true;
	if (row.otp !== entered) return false;
	const { error } = await supabase.from("surgery_booking_roles").update({ otp_verified_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", roleId).is("otp_verified_at", null);
	return !error;
}
/** One-tap "OTP exchanged" — either party confirms in person. */
async function confirmSurgeryOtpExchanged(roleId) {
	const { error } = await supabase.from("surgery_booking_roles").update({ otp_verified_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", roleId).is("otp_verified_at", null);
	if (error) throw error;
}
async function completeSurgeryRole(roleId) {
	const { error } = await supabase.from("surgery_booking_roles").update({
		status: "accepted",
		completed_at: (/* @__PURE__ */ new Date()).toISOString()
	}).eq("id", roleId);
	if (error) throw error;
}
async function rateSurgeryRole(roleId, side, stars) {
	const patch = side === "hub" ? { rating_hub: Math.max(1, Math.min(5, Math.round(stars))) } : { rating_provider: Math.max(1, Math.min(5, Math.round(stars))) };
	const { error } = await supabase.from("surgery_booking_roles").update(patch).eq("id", roleId);
	if (error) throw error;
}
/** Mark an accepted role as failed (no-show / arrival deadline missed). */
async function failSurgeryRole(roleId) {
	const { error } = await supabase.from("surgery_booking_roles").update({
		status: "declined",
		completed_at: (/* @__PURE__ */ new Date()).toISOString()
	}).eq("id", roleId).eq("status", "accepted");
	if (error) throw error;
}
/** Realtime audit log for a single surgery booking. */
function useSurgeryBookingAuditLog(bookingId) {
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	useEffect(() => {
		if (!bookingId) {
			setEvents([]);
			setLoading(false);
			return;
		}
		let mounted = true;
		setLoading(true);
		(async () => {
			const { data } = await supabase.from("request_audit_log").select("*").eq("booking_id", bookingId).order("created_at", { ascending: true });
			if (!mounted) return;
			setEvents(data ?? []);
			setLoading(false);
		})();
		const ch = supabase.channel(`s_audit_${bookingId}_${Math.random().toString(36).slice(2)}`).on("postgres_changes", {
			event: "INSERT",
			schema: "public",
			table: "request_audit_log",
			filter: `booking_id=eq.${bookingId}`
		}, (payload) => {
			const row = payload.new;
			setEvents((prev) => prev.some((e) => e.id === row.id) ? prev : [...prev, row]);
		}).subscribe();
		return () => {
			mounted = false;
			supabase.removeChannel(ch);
		};
	}, [bookingId]);
	return {
		events,
		loading
	};
}
/** Hub↔provider chat for one accepted role. Auto-closes after chat_expires_at. */
function useSurgeryRoleChat(roleId, counterpartId, chatExpiresAt) {
	const [messages, setMessages] = useState([]);
	const [meId, setMeId] = useState(null);
	const [ready, setReady] = useState(false);
	useEffect(() => {
		let mounted = true;
		if (!roleId) {
			setMessages([]);
			setReady(true);
			return;
		}
		const tk = surgeryChatThreadKey(roleId);
		(async () => {
			const { data: sess } = await supabase.auth.getSession();
			const uid = sess.session?.user?.id ?? null;
			if (!mounted) return;
			setMeId(uid);
			const { data } = await supabase.from("chat_messages").select("*").eq("thread_key", tk).order("created_at", { ascending: true }).limit(500);
			if (!mounted) return;
			setMessages(data ?? []);
			setReady(true);
			const ch = supabase.channel(`surgery_chat_${tk}_${Math.random().toString(36).slice(2)}`).on("postgres_changes", {
				event: "INSERT",
				schema: "public",
				table: "chat_messages",
				filter: `thread_key=eq.${tk}`
			}, (payload) => {
				const m = payload.new;
				setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
			}).subscribe();
			return () => {
				supabase.removeChannel(ch);
			};
		})();
		return () => {
			mounted = false;
		};
	}, [roleId]);
	const expired = !!chatExpiresAt && new Date(chatExpiresAt).getTime() < Date.now();
	return {
		messages,
		send: useCallback(async (body) => {
			const text = body.trim();
			if (!text || !meId || !roleId || !counterpartId || expired) return false;
			const { error } = await supabase.from("chat_messages").insert({
				thread_key: surgeryChatThreadKey(roleId),
				sender_id: meId,
				recipient_id: counterpartId,
				body: text
			});
			return !error;
		}, [
			meId,
			roleId,
			counterpartId,
			expired
		]),
		meId,
		ready,
		expired
	};
}
async function createSurgeryBooking(input) {
	const { data: sess } = await supabase.auth.getSession();
	const uid = sess.session?.user?.id;
	if (!uid) throw new Error("Not signed in");
	const { data: booking, error } = await supabase.from("surgery_bookings").insert({
		facility_id: uid,
		patient_name: input.patient_name,
		patient_phone: input.patient_phone ?? null,
		procedure: input.procedure,
		mode: input.mode,
		scheduled_at: input.mode === "emergency" ? null : input.scheduled_at ?? null,
		notes: input.notes ?? null,
		status: "broadcasting",
		ot_room: input.ot_room ?? null,
		blood_units: input.blood_units ?? null,
		blood_group: input.blood_group ?? null
	}).select("*").single();
	if (error) throw error;
	const rolesToInsert = input.roles.map((r) => ({
		booking_id: booking.id,
		role: r,
		fee: input.role_fees?.[r] ?? null
	}));
	if (rolesToInsert.length > 0) {
		const { error: rErr } = await supabase.from("surgery_booking_roles").insert(rolesToInsert);
		if (rErr) throw rErr;
	}
	return booking;
}
async function cancelSurgeryBooking(id) {
	const { error } = await supabase.from("surgery_bookings").update({ status: "cancelled" }).eq("id", id);
	if (error) throw error;
}
async function acceptSurgeryRole(roleId) {
	const { data: sess } = await supabase.auth.getSession();
	const uid = sess.session?.user?.id;
	if (!uid) throw new Error("Not signed in");
	const { error } = await supabase.from("surgery_booking_roles").update({
		assigned_to: uid,
		status: "accepted",
		accepted_at: (/* @__PURE__ */ new Date()).toISOString()
	}).eq("id", roleId).eq("status", "pending");
	if (error) throw error;
}
async function declineSurgeryRole(roleId) {
	const { data: sess } = await supabase.auth.getSession();
	const uid = sess.session?.user?.id;
	if (!uid) throw new Error("Not signed in");
	const { error } = await supabase.from("surgery_booking_roles").update({
		status: "declined",
		assigned_to: uid
	}).eq("id", roleId);
	if (error) throw error;
}
function useMyFacilitySurgeries() {
	const [bookings, setBookings] = useState([]);
	const [roles, setRoles] = useState([]);
	const [loading, setLoading] = useState(true);
	const refresh = useCallback(async () => {
		const { data: sess } = await supabase.auth.getSession();
		const uid = sess.session?.user?.id;
		if (!uid) {
			setBookings([]);
			setRoles([]);
			setLoading(false);
			return;
		}
		const { data: bs } = await supabase.from("surgery_bookings").select("*").eq("facility_id", uid).order("created_at", { ascending: false }).limit(100);
		const list = bs ?? [];
		setBookings(list);
		if (list.length) {
			const ids = list.map((b) => b.id);
			const { data: rs } = await supabase.from("surgery_booking_roles").select("*").in("booking_id", ids);
			setRoles(rs ?? []);
		} else setRoles([]);
		setLoading(false);
	}, []);
	useEffect(() => {
		refresh();
		const ch = supabase.channel(`surgery_facility_${Math.random().toString(36).slice(2)}`).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "surgery_bookings"
		}, () => refresh()).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "surgery_booking_roles"
		}, () => refresh()).subscribe();
		return () => {
			supabase.removeChannel(ch);
		};
	}, [refresh]);
	return {
		bookings,
		roles,
		loading,
		refresh
	};
}
function useProviderSurgeryInvites() {
	const [roles, setRoles] = useState([]);
	const [bookings, setBookings] = useState([]);
	const [loading, setLoading] = useState(true);
	const refresh = useCallback(async () => {
		const { data: sess } = await supabase.auth.getSession();
		const uid = sess.session?.user?.id;
		if (!uid) {
			setRoles([]);
			setBookings([]);
			setLoading(false);
			return;
		}
		const { data: rs } = await supabase.from("surgery_booking_roles").select("*").or(`status.eq.pending,assigned_to.eq.${uid}`).order("created_at", { ascending: false }).limit(200);
		const list = rs ?? [];
		setRoles(list);
		if (list.length) {
			const ids = Array.from(new Set(list.map((r) => r.booking_id)));
			const { data: bs } = await supabase.from("surgery_bookings").select("*").in("id", ids);
			setBookings(bs ?? []);
		} else setBookings([]);
		setLoading(false);
	}, []);
	useEffect(() => {
		refresh();
		const ch = supabase.channel(`surgery_provider_${Math.random().toString(36).slice(2)}`).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "surgery_booking_roles"
		}, () => refresh()).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "surgery_bookings"
		}, () => refresh()).subscribe();
		return () => {
			supabase.removeChannel(ch);
		};
	}, [refresh]);
	return {
		roles,
		bookings,
		loading,
		refresh
	};
}
//#endregion
export { useSurgeryBookingAuditLog as _, acceptSurgeryRole as a, confirmSurgeryOtpExchanged as c, failSurgeryRole as d, hubConfirmSurgeryRole as f, useProviderSurgeryInvites as g, useMyFacilitySurgeries as h, SURGERY_TEST_OTP as i, createSurgeryBooking as l, rateSurgeryRole as m, PROCEDURE_PRESETS as n, cancelSurgeryBooking as o, providerVerifySurgeryOtp as p, SURGERY_ROLE_LABELS as r, completeSurgeryRole as s, BLOOD_GROUPS as t, declineSurgeryRole as u, useSurgeryRoleChat as v };
