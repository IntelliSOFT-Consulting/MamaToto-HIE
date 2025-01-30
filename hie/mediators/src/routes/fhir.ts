import express from 'express';
import { FhirApi, OperationOutcome, sendSlackAlert, sendTurnNotification } from '../lib/utils';
import { v4 as uuid } from 'uuid';
import fetch from 'node-fetch';
import { fetchVisits, fhirPatientToCarepayBeneficiary, processIdentifiers } from '../lib/payloadMapping';
import { processJsonData, transformToFhir } from '../lib/heyforms';


const _TEST_PHONE_NUMBERS = process.env.TEST_PHONE_NUMBERS ?? "";
const TEST_PHONE_NUMBERS = _TEST_PHONE_NUMBERS.split(",");

const CAREPAY_BASE_URL = process.env['CAREPAY_BASE_URL'];
const CAREPAY_USERNAME = process.env['CAREPAY_USERNAME'];
const CAREPAY_PASSWORD = process.env['CAREPAY_PASSWORD'];
const CAREPAY_POLICY_ID = process.env['CAREPAY_POLICY_ID'];


// PHONE_NUMBER_FILTERING

export const router = express.Router();

router.use(express.json());

//process FHIR Beneficiary
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
    for(let entry of data.entry){
        // existing patient
        if(entry?.resource?.resourceType === "Patient" && entry?.request?.method === "PUT"){
            patient = entry?.resource?.id;
            break;
        }
        // create a new patient
        if (entry?.resource?.resourceType === "Patient" && entry?.request?.method === "POST"){
            patient = entry?.resource?.id;
            let fhirPatient = entry?.resource;
            for (let id of fhirPatient.identifiers){
                // if()
            }
        }
    }
    if(!patient){
        res.statusCode = 400;
        res.json(OperationOutcome(`Bundle must contain a Patient Resource`));
        return;
    }
    // check if patient exists
    let fhirPatient = (await FhirApi({url:  `/Patient/${patient}`})).data;
    if(fhirPatient.resourceType === "Patient"){
        res.statusCode = 400;
        res.json(OperationOutcome("Invalid FHIR Resource provided. Expects a FHIR transaction Bundle"));
        return;
    }


    // post to FHIR Server

    return;
  }catch (error){

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


router.post('/webform', async (req, res) => {
  try {
    const processedData = processJsonData(req.body);
    const bundle = transformToFhir(processedData);

    let shrResponse = await (
      await FhirApi({
        url: "/",
        method: "POST",
        data: JSON.stringify(bundle),
      })
    ).data;
    // console.log(bundle);
    res.json(shrResponse);
    return;
  } catch (error) {
    console.error('Error transforming to FHIR:', error);
    res.status(500).json({
      error: 'Error transforming data to FHIR format',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

export default router;
