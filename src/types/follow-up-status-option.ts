/**
 * An organization-defined, purely descriptive business label for a
 * Follow-up (e.g. "Customer Interested", "Demo Scheduled", "Proposal
 * Sent") — mirrors SafeFollowUpStatusOption in
 * backend/src/follow-up-statuses/follow-up-statuses.service.ts.
 *
 * Deliberately carries no lifecycle meaning: FollowUp.status
 * (scheduled/completed/cancelled — see src/types/follow-up.ts) remains the
 * only internal state and is never derived from this. There is no fixed
 * list anywhere in the frontend; every available value comes from
 * GET /follow-up-statuses (see src/features/follow-ups/api.ts's
 * listFollowUpStatusOptions) — an organization starts with zero and adds
 * its own through "+ Add option".
 */
export interface FollowUpStatusOption {
  id: string;
  organizationId: string;
  name: string;
  /** No delete — deactivating keeps every Follow-up already using it intact
   * and only stops it from being offered for a *new* selection. */
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}
