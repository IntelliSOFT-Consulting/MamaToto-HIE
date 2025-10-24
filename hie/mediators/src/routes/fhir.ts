import express from 'express';
import { FhirApi, OperationOutcome, sendSlackAlert } from '../lib/utils';
import fetch from 'node-fetch';
import { processIdentifiers } from '../lib/carepay';


const _TEST_PHONE_NUMBERS = process.env.TEST_PHONE_NUMBERS ?? "";


// PHONE_NUMBER_FILTERING

export const router = express.Router();

router.use(express.json());

/* process FHIR Bundle */
router.post('/', async (req, res) => {
  try {
    let data = req.body;
    // console.log("FHIR Bundle Payload", data);
    if (data.resourceType != "Bundle") {
      res.statusCode = 400;
      res.json(OperationOutcome("Invalid FHIR Resource provided. Expects a FHIR transaction Bundle"));
      return;
    }
    let patient = null;
    for (let entry of data.entry) {
      // existing patient
      if (entry?.resource?.resourceType === "Patient" && entry?.request?.method === "PUT") {
        patient = entry?.resource?.id;
        break;
      }
      // create a new patient
      if (entry?.resource?.resourceType === "Patient" && entry?.request?.method === "POST") {
        patient = entry?.resource?.id;
        let fhirPatient = entry?.resource;
        for (let id of fhirPatient.identifiers) {
          // if()
        }
      }
    }
    if (!patient) {
      res.statusCode = 400;
      res.json(OperationOutcome(`Bundle must contain a Patient Resource`));
      return;
    }
    // check if patient exists
    let fhirPatient = (await FhirApi({ url: `/Patient/${patient}` })).data;
    if (fhirPatient.resourceType === "Patient") {
      return res.status(400).json(OperationOutcome("Invalid FHIR Resource provided. Expects a FHIR transaction Bundle"));
    }


    // post to FHIR Server

    return;
  } catch (error) {

  }
});



// process questionnaire response
router.put('/notifications/QuestionnaireResponse/:id', async (req, res) => {
  try {
    let { id } = req.params;
    let qr = await (await FhirApi({ url: `/QuestionnaireResponse/${id}` })).data;
    let data = await (await FhirApi({ url: `/${qr?.subject?.reference}` })).data;
    console.log(data);
    let tag = data.meta?.tag ?? null;
    let identifiers = data?.identifier;
    let parsedIds = await processIdentifiers(identifiers);
    // console.log(parsedIds);

    // if these ids have already been assigned...
    if (tag || Object.keys(parsedIds).indexOf('CAREPAY-MEMBER-NUMBER') > -1 || Object.keys(parsedIds).indexOf('CAREPAY-PATIENT-REF') > -1) {
      res.statusCode = 200;
      res.json(data);
      return;
    }
    let CAREPAY_MEDIATOR_ENDPOINT = process.env['CAREPAY_MEDIATOR_ENDPOINT'] ?? "";
    let OPENHIM_CLIENT_ID = process.env['OPENHIM_CLIENT_ID'] ?? "";
    let OPENHIM_CLIENT_PASSWORD = process.env['OPENHIM_CLIENT_PASSWORD'] ?? "";
    let response = await (await fetch(CAREPAY_MEDIATOR_ENDPOINT, {
      body: JSON.stringify(data),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": 'Basic ' + Buffer.from(OPENHIM_CLIENT_ID + ':' + OPENHIM_CLIENT_PASSWORD).toString('base64')
      }
    })).json();
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
      sendSlackAlert(`Failed to post beneficiary - ${JSON.stringify(response)}`);
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
    sendSlackAlert(`Failed to post beneficiary - ${JSON.stringify(error)}`);
    return;
  }
});


export default router;
