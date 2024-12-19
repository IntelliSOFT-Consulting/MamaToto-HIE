import express from 'express';
import { FhirApi, sendTurnNotification } from '../lib/utils';
import fetch from 'node-fetch';

export const router = express.Router();

router.use(express.json());


//process FHIR beneficiary
router.put('/notifications/Encounter/:id', async (req, res) => {
  try {
    let { id } = req.params;
    let data = await (await FhirApi({ url: `/Encounter/${id}` })).data;
    let tag = data.meta?.tag ?? null;
    console.log(data.status);

    // console.log(tag, identifiers);
    if (data.status !== "finished") {
      res.statusCode = 200;
      // console.log("found: ", tag, identifiers);
      res.json(data);
      return;
    }

    let previousVersion = await (await FhirApi({ url: `/Encounter/${id}/_history/${parseInt(data?.meta?.versionId) - 1}` })).data;
    if (previousVersion.status === data.status) {
      // visit status hasn't changed
      res.statusCode = 200;
      res.json(data);
      return;
    }

    let patient = await (await FhirApi({ url: `/${data?.subject?.reference}` })).data;

    let response = await sendTurnNotification(patient, "SURVEY_FOLLOW_UP")
    if (response.code >= 400) {
      res.statusCode = response.code;
      res.json({
        "resourceType": "OperationOutcome",
        "id": "exception",
        "issue": [{
          "severity": "error",
          "code": "exception",
          "details": {
            "text": `Failed to post beneficiary- ${JSON.stringify(response)}`
          }
        }]
      });
      return;
    }
    res.statusCode = 200;
    res.json(response);
    return;
  } catch (error) {
    console.error(error);
    res.statusCode = 400;
    res.json({
      "resourceType": "OperationOutcome",
      "id": "exception",
      "issue": [{
        "severity": "error",
        "code": "exception",
        "details": {
          "text": `Failed to post beneficiary- ${JSON.stringify(error)}`
        }
      }]
    });
    return;
  }
});

export default router;