// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ReportEvidencePanel from "./ReportEvidencePanel";
afterEach(cleanup);
it("edits narrative text without changing facts or references", () => {
  const onRevise = vi.fn();
  render(<ReportEvidencePanel factsJson='{"d1":[]}' narrativeJson={JSON.stringify({ schemaVersion: "vedic-narrative.v1", sections: [{ title: "Themes", paragraphs: ["Original text"], factRefs: ["d1"], warnings: [] }] })} versions={[]} onRevise={onRevise} />);
  fireEvent.click(screen.getByText("Edit narrative · create a new PDF version"));
  fireEvent.change(screen.getByLabelText("Edit Themes"), { target: { value: "Reviewed interpretation" } });
  fireEvent.click(screen.getByRole("button", { name: "Save text & render new PDF" }));
  expect(JSON.parse(onRevise.mock.calls[0][0]).sections[0]).toMatchObject({ paragraphs: ["Reviewed interpretation"], factRefs: ["d1"] });
  expect(screen.getByLabelText("Calculation facts")).toHaveTextContent('"d1": []');
});
