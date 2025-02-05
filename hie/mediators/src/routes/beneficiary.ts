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


// create or register a new patient
router.post('/', async (req, res) => {
  try {
    let data = req.body;
    let nationalId = data.identification[0].number;
    let patientId;
    let _patient = (await FhirApi({ url: `/Patient?identifier=${nationalId}` })).data;
    if (Object.keys(_patient).indexOf('entry') > -1) {
      // patient with the id exists
      patientId = _patient.entry[0].resource.id;
      console.log(patientId);
    } else {
      patientId = uuid();
    }
    let Patient = {
      resourceType: "Patient",
      id: patientId,
      name: [
        {
          prefix: [data.title],
          given: [data.firstName, data.middleName],
          family: data.lastName
        }
      ],
      identifier: [
        {
          type: {
            coding: [{
              system: "http://hl7.org/fhir/administrative-identifier",
              code: data.identification[0].type,
              display: data.identification[0].type
            }],
            text: data.identification[0].type
          },
          system: "identification", value: data.identification[0].number
        }
      ],
      gender: String(data.gender).toLocaleLowerCase(),
      birthDate: data.dateOfBirth,
      maritalStatus: data.maritalStatus,
      telecom: [{ system: "phone", value: data.phoneNumber }, { system: "email", value: data.email }],
      address: { country: data.residentialCountryCode, district: data.residentialCountyCode, city: data.residentialLocationCode },

    }
    // Policy
    let Coverage = {
      "resourceType": "Coverage",
      "id": uuid(),
      "beneficiary": {
        "reference": `Patient/${patientId}`
      },
      "relationship": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/coverage-selfpay",
            "code": data.relationship
          }
        ]
      },
      "identifier": [
        {
          "system": "http://example.com/fhir/coverage-category",
          "value": data.categoryId
        },
        {
          "system": "http://example.com/fhir/coverage-policy",
          "value": data.policyId
        },
        {
          "system": "http://example.com/fhir/coverage-membership",
          "value": data.membershipNumber
        },
        {
          "system": "http://example.com/fhir/coverage-insurance",
          "value": data.insuranceMemberId
        },
        {
          "system": "http://example.com/fhir/coverage-family",
          "value": data.familyIdentifier
        }
      ],
      "status": "active",
      "type": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/coverage-type",
            "code": "medical"
          }
        ]
      },
      "subscriberId": data.membershipNumber,
      "subscriber": {
        "reference": `Patient/${patientId}`
      },
      "dependent": "1",  // Assuming this is the primary member
      "period": {
        "start": data.startDate,
        "end": data.endDate
      },
    }


    let DocumentReference = {
      "resourceType": "DocumentReference",
      "id": uuid(),
      "subject": {
        "reference": `Patient/${patientId}`
      },
      "type": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "34565-2"
          }
        ],
        "text": data.document[0].documentType
      },
      "category": [
        {
          "coding": [
            {
              "system": "http://hl7.org/fhir/ValueSet/document-reference-category",
              "code": "clinical"
            }
          ],
          "text": "Clinical"
        }
      ],
      "content": [
        {
          "attachment": {
            "contentType": "application/pdf",
            "url": data.document[0].documentLocation,
            "title": data.document[0].documentType
          }
        }
      ],
      "status": "current",
    }

    let RelatedPerson = {
      "resourceType": "RelatedPerson",
      "id": uuid(),
      "patient": {
        "reference": `Patient/${patientId}`
      },
      "relationship": [
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
              "code": data.nextOfKin.relationship
            }
          ],
          "text": data.nextOfKin.relationship
        },
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
              "code": "NOK"
            }
          ],
          "text": "Next of Kin"
        },
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
              "code": "EC"
            }
          ],
          "text": "Emergency Contact"
        }
      ],
      "name": {
        "text": data.nextOfKin.name
      },
      "telecom": [
        {
          "system": "phone",
          "value": data.nextOfKin.phoneNumber
        }
      ]
    }

    let patient = (await FhirApi({ url: `/Patient/${patientId}`, data: JSON.stringify(Patient), method: 'PUT' })).data;
    console.log("patient: ", patient);

    let relatedPerson = (await FhirApi({ url: `/RelatedPerson/${RelatedPerson.id}`, data: JSON.stringify(RelatedPerson), method: 'PUT' })).data;
    console.log("relatedPerson: ", relatedPerson);

    let coverage = (await FhirApi({ url: `/Coverage/${Coverage.id}`, data: JSON.stringify(Coverage), method: 'PUT' })).data;
    console.log("coverage: ", coverage);

    let documentReference = (await FhirApi({ url: `/DocumentReference/${DocumentReference.id}`, data: JSON.stringify(DocumentReference), method: 'PUT' })).data;
    console.log("documentReference: ", documentReference);


    // build bundle
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        { resource: patient },
        { resource: relatedPerson },
        { resource: coverage },
        { resource: documentReference }
        // Add more entries if needed
      ]
    };
    if (patient.id) {
      res.statusCode = 200;
      res.json(fhirBundle);
      return;
    }
    res.statusCode = 400;
    res.json(patient);
    return;
  } catch (error) {
    res.statusCode = 400;
    console.log(error);
    res.json({
      "resourceType": "OperationOutcome",
      "id": "exception",
      "issue": [{
        "severity": "error",
        "code": "exception",
        "details": {
          "text": String(error)
        }
      }]
    });
    sendSlackAlert(`Failed to post beneficiary - ${JSON.stringify(error)}`);
    return;
  }
});


/* Post patient to Carepay - Channel */
router.post('/carepay', async (req, res) => {
  try {
    let data = req.body;
    if (data.resourceType != "Patient") {
      return res.status(400).json(OperationOutcome(`Invalid Patient resource`));
    }

    let isDependant = false;
    if (data?.identifier?.[0]?.type?.coding?.[0]?.display === "Mother's ID Number"){
      isDependant=true
    }
    const carepayResponse = await postBeneficiaryEndorsement(data, isDependant);
    if (carepayResponse.status === 400) {
      sendTurnNotification(data, "ENROLMENT_REJECTION");
      sendSlackAlert(`Failed to post beneficiary - ${JSON.stringify(carepayResponse)}`);
      return res.status(400).json(OperationOutcome(`Failed to post beneficiary - ${JSON.stringify(carepayResponse)}`));
    }
    res.statusCode = 200;
    let carepayFhirId = FhirIdentifier("http://carepay.com", "CAREPAY-MEMBER-NUMBER", "Carepay Member Number", carepayResponse.membershipNumber);
    if (!data.identifier) {
      data.identifier = [carepayFhirId];
    } else {
      data.identifier.push(carepayFhirId);
    }
    data = await (await (FhirApi({ url: `/Patient/${data.id}`, method: "PUT", data: JSON.stringify(data) }))).data
    sendTurnNotification(data, "ENROLMENT_CONFIRMATION");
    return res.status(201).json(data);
  } catch (error) {
    console.log(error);
    sendSlackAlert(`Failed to post beneficiary - ${JSON.stringify(error)}`);
    return res.status(400).json(OperationOutcome(`Failed to post beneficiary - ${JSON.stringify(error)}`));
  }
});


/* process patient from subscription */
router.put('/notifications/Patient/:id', async (req, res) => {
  try {
    let { id } = req.params;
    let data = await (await FhirApi({ url: `/Patient/${id}` })).data
    let tag = data.meta?.tag ?? null;
    let identifiers = data?.identifier;
    let parsedIds = await processIdentifiers(identifiers);
    // console.log(parsedIds);

    const IDENTIFIERS = String(process.env.IDENTIFIERS).split(",");

    /* If these ids have already been assigned, don't register to Carepay */
    if (tag || IDENTIFIERS.some(id => id in parsedIds)) {
      return res.status(200).json(data);
    }

    /* Post patient to Carepay */
    if (data?.identifier?.[0]?.type?.coding?.[0]?.code === "NATIONAL_ID") {
      const response = await postToBeneficiaryEndorsementMediator(data);
      console.log(JSON.stringify(response));
      if (response.code >= 400) {
        sendSlackAlert(`Failed to post beneficiary to Carepay - ${JSON.stringify(response)}`);
        return res.status(400).json(OperationOutcome(`Failed to post beneficiary- ${JSON.stringify(response)}`));
      }
      res.statusCode = 200;
      res.json(response);
      return;
    }
    return res.status(200).json(data);
  } catch (error) {
    console.log(error);
    sendSlackAlert(`Failed to post beneficiary - ${JSON.stringify(error)}`);
    return res.status(400).json(OperationOutcome(`Failed to post beneficiary- ${JSON.stringify(error)}`));
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
    let parsedIds = await processIdentifiers(identifiers);
    // console.log(parsedIds);


    const IDENTIFIERS = String(process.env.IDENTIFIERS).split(",");

    /* If these ids have already been assigned, don't register to Carepay */
    if (tag || IDENTIFIERS.some(id => id in parsedIds)) {
      res.statusCode = 200;
      res.json(data);
      return;
    }

    /* Post patient to Carepay */
    const response = await postToBeneficiaryEndorsementMediator(data);
    if (response.code >= 400) {
      sendSlackAlert(`Failed to post beneficiary to Carepay - ${JSON.stringify(response)}`);
      return res.status(400).json(OperationOutcome(`Failed to post beneficiary- ${JSON.stringify(response)}`));
    }
    res.statusCode = 200;
    res.json(response);
    return;
  } catch (error) {
    // console.log(error);
    sendSlackAlert(`Failed to post beneficiary - ${JSON.stringify(error)}`);
    return res.status(400).json(OperationOutcome(`Failed to post beneficiary- ${JSON.stringify(error)}`));
  }
});

export default router;
