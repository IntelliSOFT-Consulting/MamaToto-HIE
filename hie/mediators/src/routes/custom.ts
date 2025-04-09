import express from "express";
import { FhirApi, OperationOutcome, redirectToDev, sendTurnNotification } from "../lib/utils";
import { FhirIdentifier } from "../lib/fhir";


// PROD_UAT - PHONE_NUMBER_FILTERING
const _TEST_PHONE_NUMBERS = process.env.TEST_PHONE_NUMBERS ?? "";
const TEST_PHONE_NUMBERS = _TEST_PHONE_NUMBERS.split(",");

export const router = express.Router();

// Custom middleware to handle application/fhir+json content type
router.use(
  express.json({
    type: ["application/json", "application/fhir+json"],
  })
);


/**
 * @openapi
 * /Patient:
 *   post:
 *     summary: Create a new Patient resource
 *     description: Endpoint for creating a Patient resource with validation and routing logic
 *     tags:
 *       - Patient
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resourceType
 *             properties:
 *               resourceType:
 *                 type: string
 *                 enum: ['Patient']
 *                 description: Must be 'Patient'
 *               telecom:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     system:
 *                       type: string
 *                       description: Telecom system (e.g., phone, email)
 *                     value:
 *                       type: string
 *                       description: Telecom contact value
 *     responses:
 *       201:
 *         description: Patient resource successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resourceType:
 *                   type: string
 *                   example: Patient
 *                 id:
 *                   type: string
 *                   description: Unique identifier for the created patient
 *       400:
 *         description: Error in creating Patient resource
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resourceType:
 *                   type: string
 *                   enum: ['OperationOutcome']
 *                 id:
 *                   type: string
 *                 issue:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       severity:
 *                         type: string
 *                         enum: ['error']
 *                       code:
 *                         type: string
 *                         enum: ['exception']
 *                       details:
 *                         type: object
 *                         properties:
 *                           text:
 *                             type: string
 *                             description: Error message
 *     examples:
 *       validPatient:
 *         value:
 *           resourceType: Patient
 *           name:
 *             - use: official
 *               family: Doe
 *               given:
 *                 - John
 *           telecom:
 *             - system: phone
 *               value: "+1-555-123-4567"
 *       invalidResourceType:
 *         value:
 *           resourceType: Practitioner
 */
router.post("/Patient", async (req, res) => {
  try {
    let data = req.body;
    if (data.resourceType !== "Patient") {
      return res.status(400).json(OperationOutcome(`${JSON.stringify(`Invalid Patient resource`)}`));
    }
    data?.identifier.push(FhirIdentifier("https://mamatoto.pharmaccess.io", "WHATSAPP_ENROLLMENT_ID", "Whatsapp Enrollment ID", (data?.telecom?.[0]?.value ?? data?.telecom?.[1]?.value)));
    // support [test phone number -> dev]
    if (TEST_PHONE_NUMBERS.indexOf(`${data?.telecom?.[0]?.value ?? data?.telecom?.[1]?.value}`) > -1) {
      console.log(":-> Redirecting to dev");
      try {
        let response = await redirectToDev("/fhir/Patient", data);
        console.log(JSON.stringify(response));
        if (response.resourceType == "OperationOutcome") {
          return res.status(400).json(response);
        }
        return res.status(201).json(response);
      } catch (error) {
        return res.status(400).json(OperationOutcome(`${JSON.stringify(error)}`));
      }
    }

    // default & production [save to SHR]
    let shrResponse = await (await FhirApi({ url: "/Patient", method: "POST", data: JSON.stringify(data), })).data;
    if (shrResponse.resourceType === "OperationOutcome") {
      return res.status(400).json(shrResponse);
    }
    res.statusCode = 200;
    res.json(shrResponse);
    return;
  } catch (error) {
    console.log(error);
    return res.status(400).json(OperationOutcome(`${JSON.stringify(error)}`));
  }
});

router.get("/Patient/:id", async (req, res) => {
  try {
    let { id } = req.params;
    let shrResponse = await (await FhirApi({ url: `/Patient/${id}`, })).data;
    if (shrResponse.resourceType === "Patient") {
      return res.status(200).json(shrResponse);
    } else {
      let response = await redirectToDev(`/fhir/Patient/${id}`, null, 'GET');
      console.log(JSON.stringify(response));
      if (response.resourceType === "Patient") {
        return res.status(200).json(response);
      }
      return res.status(400).json(shrResponse);
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json(OperationOutcome(`${JSON.stringify(error)}`));
  }
});

router.post("/QuestionnaireResponse", async (req, res) => {
  try {
    let data = req.body;
    data = JSON.parse(JSON.stringify(data).replace('valuecoding', 'valueCoding').replace('valuedate', 'valueDate').replace('valuestring', 'valueString'));
    if (data.resourceType !== "QuestionnaireResponse") {
      res.statusCode = 400;
      res.json({
        resourceType: "OperationOutcome",
        id: "exception",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: `Invalid QuestionnaireResponse Resource`,
            },
          },
        ],
      });
      return;
    }

    let patient = await (
      await FhirApi({ url: `/${data?.subject?.reference}` })
    ).data;
    // support [test phone number -> dev]
    console.log(patient);
    // if (TEST_PHONE_NUMBERS.indexOf(`${patient?.telecom?.[0]?.value ?? patient?.telecom?.[1]?.value}`) > -1) {
    if (patient.resourceType === "OperationOutcome") {
      console.log("...redirecting");
      try {
        let response = await redirectToDev("/fhir/QuestionnaireResponse", data);
        if (response.resourceType == "OperationOutcome") {
          res.statusCode = 400;
          res.json(response);
          return;
        }
        res.statusCode = 201;
        res.json(response);
        return;
      } catch (error) {
        res.statusCode = 400;
        res.json({
          resourceType: "OperationOutcome",
          id: "exception",
          issue: [
            {
              severity: "error",
              code: "exception",
              details: {
                text: `${JSON.stringify(error)}`,
              },
            },
          ],
        });
        return;
      }
    }

    // default & production [save to SHR]
    let shrResponse = await (
      await FhirApi({
        url: "/QuestionnaireResponse",
        method: "POST",
        data: JSON.stringify(data),
      })
    ).data;
    if (shrResponse.resourceType === "OperationOutcome") {
      res.statusCode = 400;
      res.json(shrResponse);
      return;
    }
    res.statusCode = 200;
    res.json(shrResponse);
    return;
  } catch (error) {
    console.error(error);
    res.statusCode = 400;
    res.json({
      resourceType: "OperationOutcome",
      id: "exception",
      issue: [
        {
          severity: "error",
          code: "exception",
          details: {
            text: `${JSON.stringify(error)}`,
          },
        },
      ],
    });
    return;
  }
});

// receive and process a FHIR Bundle
router.post("/", async (req, res) => {
  try {
    let data = req.body;
    console.log(data);
    if (data.resourceType !== "Bundle") {
      res.statusCode = 400;
      res.json({
        resourceType: "OperationOutcome",
        id: "exception",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: `Invalid Bundle Resource`,
            },
          },
        ],
      });
      return;
    }
    // Extract Individual resources

    // support [test phone number -> dev]
    if (
      TEST_PHONE_NUMBERS.indexOf(
        `${data?.telecom?.[0]?.value ?? data?.telecom?.[1]?.value}`
      ) > -1
    ) {
      console.log("...redirecting");
      try {
        let response = await redirectToDev("/fhir/Patient", data);
        console.log(JSON.stringify(response));
        if (response.resourceType == "OperationOutcome") {
          res.statusCode = 400;
          res.json(response);
          return;
        }
        res.statusCode = 201;
        res.json(response);
        return;
      } catch (error) {
        res.statusCode = 400;
        res.json({
          resourceType: "OperationOutcome",
          id: "exception",
          issue: [
            {
              severity: "error",
              code: "exception",
              details: {
                text: `${JSON.stringify(error)}`,
              },
            },
          ],
        });
        return;
      }
    }

    // default & production [save to SHR]
    let shrResponse = await (
      await FhirApi({
        url: "/Patient",
        method: "POST",
        data: JSON.stringify(data),
      })
    ).data;
    if (shrResponse.resourceType === "OperationOutcome") {
      res.statusCode = 400;
      res.json(shrResponse);
      return;
    }
    res.statusCode = 200;
    res.json(shrResponse);
    return;
  } catch (error) {
    console.error(error);
    res.statusCode = 400;
    res.json({
      resourceType: "OperationOutcome",
      id: "exception",
      issue: [
        {
          severity: "error",
          code: "exception",
          details: {
            text: `${JSON.stringify(error)}`,
          },
        },
      ],
    });
    return;
  }
});

// support custom delete of a Patient
// add a UI to input phone number
router.delete("/Patient/:id", async (req, res) => {
  let data = req.body;
  // let { phoneNumber } = req.params;
  try {
    let response = await redirectToDev("/fhir/Patient", data);
    console.log(JSON.stringify(response));
    if (response.resourceType == "OperationOutcome") {
      res.statusCode = 400;
      res.json(response);
      return;
    }
    res.statusCode = 201;
    res.json(response);
    return;
  } catch (error) {
    res.statusCode = 400;
    res.json({
      resourceType: "OperationOutcome",
      id: "exception",
      issue: [
        {
          severity: "error",
          code: "exception",
          details: {
            text: `${JSON.stringify(error)}`,
          },
        },
      ],
    });
    return;
  }
});


router.post("/Observation", async (req, res) => {
  try {
    let data = req.body;
    if (data.resourceType !== "Ob") {
      res.statusCode = 400;
      res.json({
        resourceType: "OperationOutcome",
        id: "exception",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: `Invalid Observation Resource`,
            },
          },
        ],
      });
      return;
    }

    let patient = await (
      await FhirApi({ url: `/${data?.subject?.reference}` })
    ).data;
    // support [test phone number -> dev]
    console.log(patient);
    // if (TEST_PHONE_NUMBERS.indexOf(`${patient?.telecom?.[0]?.value ?? patient?.telecom?.[1]?.value}`) > -1) {
    if (patient.resourceType === "OperationOutcome") {
      console.log("...redirecting");
      try {
        let response = await redirectToDev("/fhir/Observation", data);
        if (response.resourceType == "OperationOutcome") {
          res.statusCode = 400;
          res.json(response);
          return;
        }
        res.statusCode = 201;
        res.json(response);
        return;
      } catch (error) {
        res.statusCode = 400;
        res.json({
          resourceType: "OperationOutcome",
          id: "exception",
          issue: [
            {
              severity: "error",
              code: "exception",
              details: {
                text: `${JSON.stringify(error)}`,
              },
            },
          ],
        });
        return;
      }
    }

    // default & production [save to SHR]
    let shrResponse = await (
      await FhirApi({
        url: "/Observation", method: "POST", data: JSON.stringify(data), })
    ).data;
    if (shrResponse.resourceType === "OperationOutcome") {
      res.statusCode = 400;
      res.json(shrResponse);
      return;
    }
    res.statusCode = 200;
    res.json(shrResponse);
    return;
  } catch (error) {
    console.error(error);
    res.statusCode = 400;
    res.json({
      resourceType: "OperationOutcome",
      id: "exception",
      issue: [
        {
          severity: "error",
          code: "exception",
          details: {
            text: `${JSON.stringify(error)}`,
          },
        },
      ],
    });
    return;
  }
});


export default router;
