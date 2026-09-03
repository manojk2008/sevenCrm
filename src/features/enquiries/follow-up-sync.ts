/**
 * Keeps an Enquiry's single *active* automatic Follow-up (and, once the
 * Enquiry is already in the Follow-up sequence, its pipeline stage) in sync
 * with the Enquiry's Next Follow-up date.
 *
 * Shared by src/features/enquiries/enquiries-content.tsx (Enquiry
 * create/edit) and src/features/clients/clients-content.tsx (Client -> Add
 * Enquiry). The two call sites used to duplicate this function verbatim;
 * now that it also owns the stage-advance rule below, keeping one copy
 * matters more than it used to.
 *
 * Identity is exclusively isAutoManaged + enquiryId + status === "scheduled"
 * (see FollowUp.isAutoManaged in backend/prisma/schema.prisma) — never
 * subject text, so a manually-created Follow-up (even one literally titled
 * "Follow up: <same title>") can never be mistaken for the automatic one.
 *
 * listFollowUps({ enquiryId, isAutoManaged: true }) is the existence check
 * that makes this safe to call on every save: reopening/refreshing/
 * re-editing the Enquiry, or saving without changing the date, all find the
 * same scheduled match and update it in place rather than creating another.
 * A Follow-up the user has already marked Completed/Cancelled is
 * deliberately excluded from the match (status !== "scheduled") and left
 * untouched as history — a new Scheduled one is created instead.
 *
 * Stage sync (approved design): New/Contacted -> Follow-up 1 is always a
 * manual, user-driven transition (Kanban drag or the "Change Stage" menu) —
 * this function never performs it, so Contacted can never be automatically
 * skipped. Once an Enquiry is already at Follow-up 1 or Follow-up 2,
 * *creating* the next automatic Follow-up (i.e. the previous one was
 * completed/cancelled, or none existed) also advances the stage one step
 * (Follow-up 1 -> 2, Follow-up 2 -> 3) via the existing
 * PATCH /enquiries/:id/stage. There is no Follow-up 4: once at Follow-up 3
 * (or New/Contacted/Won/Lost), the Follow-up record itself is still synced
 * as normal, but the stage is left untouched.
 */
import { toast } from "sonner";
import {
  createAutoManagedFollowUp,
  getFollowUpErrorMessage,
  listFollowUps,
  updateFollowUp,
} from "@/features/follow-ups/api";
import { updateEnquiryStage } from "./api";
import type { Enquiry, EnquiryStage } from "@/types/enquiry";

/**
 * Only these two transitions are automatic. New/Contacted/Follow-up 3/Won/
 * Lost are deliberately absent — see this module's doc comment.
 */
const NEXT_STAGE: Partial<Record<EnquiryStage, EnquiryStage>> = {
  "follow-up-1": "follow-up-2",
  "follow-up-2": "follow-up-3",
};

export async function ensureNextFollowUp(enquiry: Enquiry): Promise<Enquiry> {
  if (!enquiry.expectedCloseDate) return enquiry;
  const subject = `Follow up: ${enquiry.title}`;

  try {
    const existing = await listFollowUps({
      enquiryId: enquiry.id,
      isAutoManaged: true,
      pageSize: 100,
    });
    const match = existing.data.find((followUp) => followUp.status === "scheduled");

    if (match) {
      // Updating the still-scheduled active Follow-up in place never moves
      // the stage — it's the same interaction, just re-dated/re-detailed.
      await updateFollowUp(match.id, {
        clientId: enquiry.clientId,
        enquiryId: enquiry.id,
        assignedToId: enquiry.assignedTo || "",
        subject,
        description: match.description ?? "",
        type: match.type,
        priority: enquiry.priority,
        scheduledAt: enquiry.expectedCloseDate,
        notes: match.notes ?? "",
        reminder: match.reminder,
      });
      return enquiry;
    }

    // No scheduled auto-managed Follow-up exists (brand new Enquiry, or the
    // previous one was completed/cancelled) — create the next one.
    await createAutoManagedFollowUp({
      clientId: enquiry.clientId,
      enquiryId: enquiry.id,
      assignedToId: enquiry.assignedTo || "",
      subject,
      description: "",
      type: "call",
      priority: enquiry.priority,
      scheduledAt: enquiry.expectedCloseDate,
      notes: "",
      reminder: false,
    });

    const nextStage = NEXT_STAGE[enquiry.stage];
    if (nextStage) {
      return await updateEnquiryStage(enquiry.id, nextStage);
    }
    return enquiry;
  } catch (error) {
    toast.warning(
      `Enquiry saved, but the follow-up could not be synced: ${getFollowUpErrorMessage(error)}`,
    );
    return enquiry;
  }
}
