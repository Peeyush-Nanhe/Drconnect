import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyBookings from "./tools/list-my-bookings";
import getMyProfile from "./tools/get-my-profile";
import createCareRequest from "./tools/create-care-request";

// The OAuth issuer MUST be the direct Supabase host (never the .lovable.cloud proxy).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mydox-mcp",
  title: "MyDox",
  version: "0.1.0",
  instructions:
    "MyDox tools for the signed-in user. Use `get_my_profile` and `list_my_bookings` to read, and `create_care_request` to book a doctor, nurse, lab, scan, physio or home-care visit.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listMyBookings, createCareRequest],
});
