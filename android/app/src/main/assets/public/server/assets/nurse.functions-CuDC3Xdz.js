import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
//#region src/lib/nurse.functions.ts
/** Everything the nurse home screen needs: profile, duty lists and open jobs. */
var getNurseBoard = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("7d4e098907740836d6742a6d8e685ccbbca778d6c3fcdcc3f743e3c85ce67155"));
/** Nurse builds or updates their own profile (skills, wards, areas, venues). */
var saveNurseProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.fullName?.trim()) throw new Error("Your name is required");
	if (!Array.isArray(d.skills) || d.skills.length === 0) throw new Error("Pick at least one skill or ward");
	if (d.bio && d.bio.length > 1e3) throw new Error("Keep the summary under 1000 characters");
	return d;
}).handler(createSsrRpc("dd0b9567264e249d03b4dedbe5bbd63991fd879a726db260e3f6b8b43dcde617"));
/** Nurse goes online (open for jobs) or offline. */
var setNurseOnline = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ online: !!d?.online })).handler(createSsrRpc("38dfa00c21f036c16151dbda3b01b563034820202b5c21eb4b67164a51b4772f"));
/** Nurse applies for an open shift / home-care duty. */
var applyToNurseJob = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.jobId) throw new Error("jobId is required");
	if (d.note && d.note.length > 500) throw new Error("Keep the note under 500 characters");
	return d;
}).handler(createSsrRpc("25b1ff230c1e0132ceb16f531ed5589645d5ae9a1d76cc5e1d1f50d39fe9aaaa"));
/** Nurse moves their own duty forward: check in, check out, withdraw. */
var setNurseJobStage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.assignmentId) throw new Error("assignmentId is required");
	if (![
		"checked_in",
		"completed",
		"withdrawn"
	].includes(d.stage)) throw new Error("Unknown stage");
	return d;
}).handler(createSsrRpc("adf7a19fd18bdb3d3de1acc22e31c4634b89d06f48588218ebd6f5cbd25cd9d3"));
/** Hospitals, clinics and home-care requesters screen available nurses. */
var searchNurses = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d) => d ?? {}).handler(createSsrRpc("b8168b802366012a48216678db1a059f07af75a97adf236574c81d2e3b4c72f1"));
//#endregion
export { setNurseJobStage as a, searchNurses as i, getNurseBoard as n, setNurseOnline as o, saveNurseProfile as r, applyToNurseJob as t };
