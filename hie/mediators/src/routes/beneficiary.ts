import express from 'express';
import { FhirApi, OperationOutcome, sendSlackAlert, sendTurnNotification } from '../lib/utils';
import { v4 as uuid } from 'uuid';
import fetch from 'node-fetch';
import { postBeneficiaryEndorsement, postToBeneficiaryEndorsementMediator, processIdentifiers } from '../lib/carepay';
import { FhirIdentifier } from '../lib/fhir';


const _TEST_PHONE_NUMBERS = process.env.TEST_PHONE_NUMBERS ?? "";
const TEST_PHONE_NUMBERS = _TEST_PHONE_NUMBERS.split(",");

const CAREPAY_BASE_URL = process.env['CAREPAY_BASE_URL'];
const CAREPAY_USERNAME = process.env['CAREPAY_USERNAME'];
const CAREPAY_PASSWORD = process.env['CAREPAY_PASSWORD'];
const CAREPAY_POLICY_ID = process.env['CAREPAY_POLICY_ID'];



export const router = express.Router();

router.use(express.json());


/* Post patient to Carepay - Channel */
router.post('/carepay', async (req, res) => {
  try {
    let data = req.body;
    if (data.resourceType != "Patient") {
      return res.status(400).json(OperationOutcome(`Invalid Patient resource`));
    }
    const parsedIds = processIdentifiers(data.identifier);
    let isDependant = false;
    if (data?.identifier?.[0]?.type?.coding?.[0]?.display === "Mother's ID Number") {
      isDependant = true;
    }
    const carepayResponse = await postBeneficiaryEndorsement(data, isDependant);
    if (JSON.stringify(carepayResponse).includes('error')) {
      if (Object.keys(parsedIds).indexOf("WHATSAPP_ENROLLMENT_ID") > -1) {
        sendTurnNotification(data, "ENROLMENT_REJECTION");
      }
      sendSlackAlert(`Failed to register beneficiary to payer - ${JSON.stringify(carepayResponse)}`);
      return res.status(400).json(OperationOutcome(`Failed to register beneficiary to payer - ${JSON.stringify(carepayResponse)}`));
    }
    res.statusCode = 200;
    let carepayFhirId = FhirIdentifier("http://carepay.com", "CAREPAY-MEMBER-NUMBER", "Carepay Member Number", carepayResponse.membershipNumber);
    if (!data.identifier) {
      data.identifier = [carepayFhirId];
    } else {
      data.identifier.push(carepayFhirId);
    }
    data = await (await (FhirApi({ url: `/Patient/${data.id}`, method: "PUT", data: JSON.stringify(data) }))).data;
    if (Object.keys(parsedIds).indexOf("WHATSAPP_ENROLLMENT_ID") > -1) {
      sendTurnNotification(data, "ENROLMENT_CONFIRMATION");
    }
    return res.status(201).json(data);
  } catch (error) {
    console.log(error);
    sendSlackAlert(`Failed to register beneficiary to payer - ${JSON.stringify(error)}`);
    return res.status(202).json(OperationOutcome(`Failed to register beneficiary to payer - ${JSON.stringify(error)}`));
  }
});


/* process patient from subscription */
router.put('/notifications/Patient/:id', async (req, res) => {
  try {
    let { id } = req.params;
    let data = await (await FhirApi({ url: `/Patient/${id}` })).data
    let tag = data.meta?.tag ?? null;
    let identifiers = data?.identifier;
    let parsedIds = processIdentifiers(identifiers);
    console.log(parsedIds);

    const IDENTIFIERS = String(process.env.IDENTIFIERS).split(",");

    /* If these ids have already been assigned, don't register to Carepay */
    if (tag || IDENTIFIERS.some(id => Object.keys(parsedIds).includes(id))) {
      return res.status(200).json(data);
    }

    /* Post patient to Carepay - webforms */
    if (Object.keys(parsedIds).indexOf("NATIONAL_ID") > -1) {
      const response = await postToBeneficiaryEndorsementMediator(data);
      console.log(JSON.stringify(response));
      if (JSON.stringify(response).includes('error')) {
        sendSlackAlert(`Failed to register beneficiary to payer - ${JSON.stringify(response)}`);
        return res.status(202).json(OperationOutcome(`Failed to register beneficiary to payer- ${JSON.stringify(response)}`));
      }
      res.statusCode = 200;
      res.json(response);
      return;
    }
    return res.status(200).json(data);
  } catch (error) {
    console.log(error);
    sendSlackAlert(`Failed to register beneficiary to payer - ${JSON.stringify(error)}`);
    return res.status(400).json(OperationOutcome(`Failed to register beneficiary to payer- ${JSON.stringify(error)}`));
  }
});

/* process questionnaire response from subscription */
router.put('/notifications/QuestionnaireResponse/:id', async (req, res) => {
  try {
    let { id } = req.params;
    let qr = await (await FhirApi({ url: `/QuestionnaireResponse/${id}` })).data;
    let data = await (await FhirApi({ url: `/${qr?.subject?.reference}` })).data;
    console.log(data);
    let tag = data.meta?.tag ?? null;
    let identifiers = data?.identifier;
    let parsedIds = processIdentifiers(identifiers);


    const IDENTIFIERS = String(process.env.IDENTIFIERS).split(",");
    IDENTIFIERS.push("NATIONAL_ID")
    IDENTIFIERS.push("HEYFORM_ID")

    /* If these ids have already been assigned, don't register to Carepay */
    if (tag || IDENTIFIERS.some(id => Object.keys(parsedIds).includes(id))) {
      console.log("Aborting.....");
      return res.status(202).json(data);
    }

    /* Post patient to Carepay */
    const response = await postToBeneficiaryEndorsementMediator(data);
    if (JSON.stringify(response).includes('error')) {
      sendSlackAlert(`Failed to register beneficiary to payer to Carepay - ${JSON.stringify(response)}`);
      return res.status(400).json(OperationOutcome(`Failed to register beneficiary to payer to Carepay - ${JSON.stringify(response)}`));
    }
    res.statusCode = 200;
    res.json(response);
    return;
  } catch (error) {
    // console.log(error);
    sendSlackAlert(`Failed to register beneficiary to payer - ${JSON.stringify(error)}`);
    return res.status(400).json(OperationOutcome(`Failed to register beneficiary to payer- ${JSON.stringify(error)}`));
  }
});

export default router;
