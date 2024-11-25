import express from 'express';
import { FhirApi, redirectToDev, sendTurnNotification } from '../lib/utils';


const _TEST_PHONE_NUMBERS = process.env.TEST_PHONE_NUMBERS ?? "";
const TEST_PHONE_NUMBERS = _TEST_PHONE_NUMBERS.split(",");



// PHONE_NUMBER_FILTERING

export const router = express.Router();

// router.use(express.json());

// Custom middleware to handle application/fhir+json content type
router.use(express.json({
    type: ['application/json', 'application/fhir+json']
  }));


//process FHIR Beneficiary
router.post('/Patient', async (req, res) => {
    try {
        let data = req.body;
        console.log(data);
        if (data.resourceType !== "Patient") {
            res.statusCode = 400;
            res.json({
                "resourceType": "OperationOutcome",
                "id": "exception",
                "issue": [{
                    "severity": "error",
                    "code": "exception",
                    "details": {
                        "text": `Invalid Patient Resource`
                    }
                }]
            });
            return;
        }
        // support [test phone number -> dev]
        if (TEST_PHONE_NUMBERS.indexOf(`${data?.telecom?.[0]?.value ?? data?.telecom?.[1]?.value}`) > -1) {
            console.log("...redirecting")
            try {
                let response = await redirectToDev("/fhir/Patient", data, "POST");
                console.log(JSON.stringify(response));
                if (response.resourceType == "OperationOutcome") {
                    res.statusCode = 400;
                    res.json(response);
                    return;

                }
                res.statusCode = 201
                res.json(response);
                return;
            } catch (error) {
                res.statusCode = 400;
                res.json({
                    "resourceType": "OperationOutcome",
                    "id": "exception",
                    "issue": [{
                        "severity": "error",
                        "code": "exception",
                        "details": {
                            "text": `${JSON.stringify(error)}`
                        }
                    }]
                });
                return;
            }

        }

        // default & production [save to SHR]
        let shrResponse = await (await FhirApi({
            url: '/Patient', method: "POST", data: JSON.stringify(data)
        })).data;
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
            "resourceType": "OperationOutcome",
            "id": "exception",
            "issue": [{
                "severity": "error",
                "code": "exception",
                "details": {
                    "text": `${JSON.stringify(error)}`
                }
            }]
        });
        return;
    }
});


router.post('/QuestionnaireResponse', async (req, res) => {
    try {
        let data = req.body;
        if (data.resourceType !== "QuestionnaireResponse") {
            res.statusCode = 400;
            res.json({
                "resourceType": "OperationOutcome",
                "id": "exception",
                "issue": [{
                    "severity": "error",
                    "code": "exception",
                    "details": {
                        "text": `Invalid QuestionnaireResponse Resource`
                    }
                }]
            });
            return;
        }

        let patient = await (await FhirApi({ url: `/${data?.subject?.reference}` })).data;
        // support [test phone number -> dev]
        console.log(patient);
        // if (TEST_PHONE_NUMBERS.indexOf(`${patient?.telecom?.[0]?.value ?? patient?.telecom?.[1]?.value}`) > -1) {
        if (patient.resourceType === "OperationOutcome"){
            console.log("...redirecting");
            try {
                let response = await redirectToDev("/fhir/QuestionnaireResponse", data, "POST");
                if (response.resourceType == "OperationOutcome") {
                    res.statusCode = 400;
                    res.json(response);
                    return;
                }
                res.statusCode = 201
                res.json(response);
                return;
            } catch (error) {
                res.statusCode = 400;
                res.json({
                    "resourceType": "OperationOutcome",
                    "id": "exception",
                    "issue": [{
                        "severity": "error",
                        "code": "exception",
                        "details": {
                            "text": `${JSON.stringify(error)}`
                        }
                    }]
                });
                return;
            }

        }

        // default & production [save to SHR]
        let shrResponse = await (await FhirApi({
            url: '/QuestionnaireResponse', method: "POST", data: JSON.stringify(data)
        })).data;
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
            "resourceType": "OperationOutcome",
            "id": "exception",
            "issue": [{
                "severity": "error",
                "code": "exception",
                "details": {
                    "text": `${JSON.stringify(error)}`
                }
            }]
        });
        return;
    }
});

router.post("/Observation", async (req, res) => {
    try {
      let data = req.body;
      if (data.resourceType !== "Observation") {
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
      if (TEST_PHONE_NUMBERS.indexOf(`${patient?.telecom?.[0]?.value ?? patient?.telecom?.[1]?.value}`) > -1) {
      if (patient.resourceType === "Observation") {
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
          url: "/Observation",
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
    }
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


router.get('/Patient/:id', async (req, res) => {
    try {
        let {id} = req.params;

        let patient = await (await FhirApi({ url: `/Patient/${id}` })).data;
        // support [test phone number -> dev]
        console.log(patient);
        // if (TEST_PHONE_NUMBERS.indexOf(`${patient?.telecom?.[0]?.value ?? patient?.telecom?.[1]?.value}`) > -1) {
        if (patient.resourceType === "OperationOutcome"){
            console.log("...checking in dev");
            try {
                let response = await redirectToDev(`/fhir/Patient/${id}?_format=json`, null, "GET");
                console.log(JSON.stringify(response));
                if (response.resourceType == "OperationOutcome") {
                    res.statusCode = 404;
                    res.json(response);
                    return;
                }
                res.statusCode = 200;
                res.json(response);
                return;
            } catch (error) {
                res.statusCode = 404;
                res.json(patient);
                return;
            }

        }
        res.statusCode = 200;
        res.json(patient);
        return;
    } catch (error) {
        console.error(error);
        res.statusCode = 404;
        res.json({
            "resourceType": "OperationOutcome",
            "id": "exception",
            "issue": [{
                "severity": "error",
                "code": "exception",
                "details": {
                    "text": `${JSON.stringify(error)}`
                }
            }]
        });
        return;
    }
});


export default router;