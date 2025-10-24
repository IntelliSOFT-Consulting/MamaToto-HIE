import express from "express";
import { FhirApi, OperationOutcome } from "../lib/utils";
import { childFormToFhirBundle } from "../lib/heyforms-child";
import { momFormToFhirBundle } from "../lib/heyforms-mom";
import { momCareSocialToFhirBundle } from "../lib/heyforms-momcare-social";

const router = express.Router();

router.use(
  express.json({
    type: ["application/json"],
  })
);

router.post("/mom", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.answers) {
      return res.status(400).json({ error: "Invalid payload submitted" });
    }

    /* Convert payload to FHIR Bundle */
    const bundle = momFormToFhirBundle(payload);
    console.log(bundle);

    /* Post Bundle to SHR */
    let shrResponse = (await FhirApi({ url: "/", method: "POST", data: JSON.stringify(bundle), })).data;
    console.log(shrResponse)
    return res.status(shrResponse?.resourceType === "Bundle" ? 201: 400).json(shrResponse);

  } catch (error) {
    return res.status(400).json(OperationOutcome(String(error)));
  }
});


router.post("/child", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.answers) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    /* Convert payload to FHIR Bundle */
    const bundle = childFormToFhirBundle(payload);
    console.log(bundle);
    if (!bundle) {
      return res.status(400).json(OperationOutcome("Invalid payload: Failed to convert"));
    }

    /* Post Bundle to SHR */
    let shrResponse = (await FhirApi({ url: "/", method: "POST", data: JSON.stringify(bundle), })).data;
    return res.status(shrResponse?.resourceType === "Bundle" ? 201: 400).json(shrResponse);
  } catch (error) {
    return res.status(400).json(OperationOutcome(String(error)));
  }
});


router.post("/v1/momcare-social", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.answers) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    /* Convert payload to FHIR Bundle */
    const bundle = momCareSocialToFhirBundle(payload);
    console.log(bundle);
    if (!bundle) {
      return res.status(400).json(OperationOutcome("Invalid payload: Failed to convert"));
    }

    /* Post Bundle to SHR */
    let shrResponse = (await FhirApi({ url: "/", method: "POST", data: JSON.stringify(bundle), })).data;
    return res.status(shrResponse?.resourceType === "Bundle" ? 201: 400).json(shrResponse);
  } catch (error) {
    return res.status(400).json(OperationOutcome(String(error)));
  }
});


export default router;
