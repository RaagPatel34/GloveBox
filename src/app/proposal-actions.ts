"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { getCarSnapshot } from "@/lib/car";
import { loadProposal, saveDecision } from "@/lib/db/proposal-store";
import { CHANGED_SINCE, decideProposal } from "@/lib/proposals";
import { VISITOR_COOKIE } from "@/lib/visitor";

export type ProposalActionState = { message?: string };

// Apply, Dismiss or Hide on a proposal card. Server Functions are reachable by direct POST, so
// the browser only says which card and which button: the car and the proposal are read
// again for the visitor's cookie, and the rules are in decideProposal.
// On success the page re-renders in the same response, so the tile and card update at once.
export async function decideProposalAction(
  _previous: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  const proposalId = formData.get("proposalId");
  const decision = formData.get("decision");
  if (typeof proposalId !== "string" || (decision !== "apply" && decision !== "dismiss" && decision !== "hide")) {
    return { message: "Something went wrong with that button. Reload the page and try again." };
  }

  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  try {
    const car = await getCarSnapshot(visitorId);
    // getCarSnapshot only returns a car for a valid visitor ID.
    const proposal = car && (await loadProposal(visitorId!, proposalId));
    if (!car || !proposal) return { message: "That suggestion is no longer here. Reload the page." };

    const result = decideProposal(car, proposal, decision, new Date());
    if (!result.ok) return { message: result.error };
    const saved = await saveDecision(visitorId!, result);
    // Nothing saved on Apply: the item moved after it was read above.
    if (!saved && result.decision === "apply") return { message: CHANGED_SINCE };
  } catch (error) {
    console.error("decideProposalAction failed", error);
    return { message: "Could not save that. Please try again." };
  }

  refresh();
  return {};
}
