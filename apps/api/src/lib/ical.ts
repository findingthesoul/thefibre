// Re-export shim. The implementation moved to @thefibre/shared/ical in
// v0.68.28 so the visitor portal could render an agenda item's .ics without
// a second copy. Per CLAUDE.md's shared-component rule: edit the shared one,
// never fork this back into an implementation.
export { buildBookingIcal, type IcalEventInput } from '@thefibre/shared/ical';
