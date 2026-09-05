import { expect, it } from "vitest";
import AdmZip from "adm-zip";
import { applyApprovedAutomaticFixes } from "../src/engine/fix";
import {
  probeFeatures,
  runStudyProbe,
  runStudyProbes,
  syntheticStudyFixture,
} from "../src/server/study-probes";

it.each(probeFeatures)(
  "automatically checks synthetic %s through repair, integrity and idempotency",
  (feature) => {
    expect(runStudyProbe(feature)).toMatchObject({
      status: "PASS",
      origin: "SYNTHETIC",
      stage: "COMPLETE",
    });
    expect(syntheticStudyFixture(feature)).toEqual(
      syntheticStudyFixture(feature),
    );
  },
);
it("catches a repair regression instead of accepting a successful call", () => {
  const brokenRepair: typeof applyApprovedAutomaticFixes = (workbook, plan) => {
    const zip = new AdmZip(applyApprovedAutomaticFixes(workbook, plan));
    zip.updateFile(
      "xl/worksheets/sheet2.xml",
      Buffer.from(
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>',
      ),
    );
    return zip.toBuffer();
  };
  expect(runStudyProbe("hiddenSheets", brokenRepair)).toMatchObject({
    status: "FAIL",
    stage: "INTEGRITY",
  });
});
it("selects a bounded fixed suite without turning arbitrary signals into code", () => {
  expect(
    runStudyProbes({ formulas: 1, merchantSecret: 100 }).map((r) => r.feature),
  ).toEqual(["baseline", "formulas"]);
});
