import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ProposalCards } from "./ProposalCards";

it("renders a suggestion's from/to, reason, Super badge, and Apply/Dismiss controls", () => {
  const html = renderToStaticMarkup(createElement(ProposalCards, { cards: [{
    id: "proposal-1", label: "Engine air filter", moves: [{ from: "65,000 mi", to: "48,300 mi" }],
    reason: "Dirt-road dust can clog the filter.", model: "super", state: "pending",
  }] }));
  for (const text of ["Engine air filter", "65,000 mi", "48,300 mi", "Dirt-road dust can clog the filter.", "Super", "Apply", "Dismiss"]) expect(html).toContain(text);
  expect(html).toContain('name="proposalId"');
});
