import express, { NextFunction, Response, Request } from "express";
import { getCurrentUserInfo } from "../lib/keycloak";
import { FhirApi, OperationOutcome } from "../lib/utils";
import { issueConsent, validateConsent } from "../lib/consent";

const router = express.Router();
const FHIR_BASE_URL = process.env['FHIR_BASE_URL'];

if (!FHIR_BASE_URL) {
    throw new Error('FHIR_BASE_URL environment variable is not set');
}

// Middleware setup
router.use(express.json());

router.post('/fhir', async (req: Request, res: Response) => {
    try {
        const accessToken = req.headers.authorization?.split(' ')[1] || null;
        if (!accessToken || req.headers.authorization?.split(' ')[0] != "Bearer") {
            res.statusCode = 401;
            res.json({ status: "error", error: "Bearer token is required but not provided" });
            return;
        }

        const data = req.body;
        let patientResource = null;
        if (!data || data.resourceType != 'Bundle' || !data.entry || data.entry.length === 0) {
            res.statusCode = 400;
            res.json(OperationOutcome("A valid FHIR resource data is required"));
            return;
        }

        for (let entry of data.entry) {
            if (entry?.resource?.resourceType === "Patient") {
                patientResource = entry?.resource;
            }
        }

        if (!patientResource) {
            return res.status(401).json(OperationOutcome("Invalid FHIR Bundle provided. Missing Patient in Bundle"));
        }

        // find patient resource in FHIR Bundle 
        let currentUser = await getCurrentUserInfo(accessToken);
        if (!currentUser) {
            return res.status(401).json(OperationOutcome("Invalid Bearer token provided"));
        }

        let shrResponse = (await FhirApi('/', { method: 'POST', data })).data;
        return res.status(shrResponse.statusCode).json(shrResponse.data);
    } catch (error) {

    }

});

// get patient by id 
router.get('/fhir/Patient/:id', async (req: Request, res: Response) => {
    try {
        const accessToken = req.headers.authorization?.split(' ')[1] || null;
        if (!accessToken || req.headers.authorization?.split(' ')[0] != "Bearer") {
            return res.status(401).json(OperationOutcome("Bearer token is required but not provided"));
        }
        const { id } = req.params;
        if (!id) {
            return res.status(400).json(OperationOutcome("Patient ID is required"));
        }
        let currentUser = await getCurrentUserInfo(accessToken);
        if (!currentUser) {
            return res.status(401).json(OperationOutcome("Invalid Bearer token provided"));
        }

        let facilityId = currentUser.family_name;

        let isConsentValid = await validateConsent(id, facilityId);
        if (!isConsentValid) {
            return res.status(401).json(OperationOutcome("No consent found for the given patient ID"));
        }
        let patientResource = (await FhirApi(`/Patient/${id}`));
        return res.status(patientResource.statusCode).json(patientResource.data);
    } catch (error) {
        console.error(error);
        return res.status(500).json(OperationOutcome("Internal Server Error"));

    }
});

// get patient summary/everything by id 
router.get('/fhir/Patient/:id/:operation', async (req: Request, res: Response) => {
    try {
        const accessToken = req.headers.authorization?.split(' ')[1] || null;
        if (!accessToken || req.headers.authorization?.split(' ')[0] != "Bearer") {
            return res.status(401).json(OperationOutcome("Bearer token is required but not provided"));
        }
        const { id, operation } = req.params;
        if (!operation || !['$everything', '$summary'].includes(operation)) {
            return res.status(400).json(OperationOutcome("Invalid operation specified."));
        }
        if (!id) {
            return res.status(400).json(OperationOutcome("Patient ID is required"));
        }

        let currentUser = await getCurrentUserInfo(accessToken);
        if (!currentUser) {
            return res.status(401).json(OperationOutcome("Invalid Bearer token provided"));
        }
        let facilityId = currentUser.family_name;


        let isConsentValid = await validateConsent(id, facilityId)
        if (!isConsentValid) {
            return res.status(404).json(OperationOutcome("No active consent found for the given patient ID"));
        }
        let patientResource = (await FhirApi(`/Patient/${id}/${operation}`));
        return res.status(patientResource.statusCode).json(patientResource.data);
    } catch (error) {
        console.error(error);
        return res.status(500).json(OperationOutcome("Internal Server Error"));

    }
});

// search patient
router.get('/fhir/Patient', async (req: Request, res: Response) => {
    try {
        const accessToken = req.headers.authorization?.split(' ')[1] || null;
        if (!accessToken || req.headers.authorization?.split(' ')[0] != "Bearer") {
            return res.status(401).json(OperationOutcome("Bearer token is required but not provided"));
        }

        let currentUser = await getCurrentUserInfo(accessToken);
        if (!currentUser) {
            return res.status(401).json(OperationOutcome("Invalid Bearer token provided"));
        }
        console.log("Current User: ", currentUser);
        let facilityId = currentUser.family_name;


        const searchParams = new URLSearchParams(req.query as Record<string, string>);
        if (!searchParams.has('identifier')) {
            return res.status(400).json(OperationOutcome("'identifier' query parameter is required"));
        }

        let patientResource;
        let patient = (await FhirApi(`/Patient?identifier=${req.query.identifier}`)).data;
        if (patient?.entry?.resource) {
            patientResource = patient?.entry?.resource
        } else {
            return res.status(400).json(OperationOutcome("No active consent found for the given patient ID"));
        }

        const isConsentValid = await validateConsent(patientResource?.id, facilityId);
        console.log(isConsentValid);
        if (!isConsentValid) {
            return res.status(401).json(OperationOutcome("No active consent found for the given patient ID"));
        }

        /* forward search params just incase */
        let shrResponse = (await FhirApi(`/Patient${searchParams.toString() ? `?${searchParams.toString()}` : ''}`));
        return res.status(shrResponse.statusCode).json(shrResponse.data);

    } catch (error) {
        console.error(error);
        return res.status(500).json(OperationOutcome("Internal Server Error"));

    }
});

// register patient with consent
router.post('/fhir/Patient', async (req: Request, res: Response) => {
    try {
        const accessToken = req.headers.authorization?.split(' ')[1] || null;
        if (!accessToken || req.headers.authorization?.split(' ')[0] != "Bearer") {
            return res.status(401).json(OperationOutcome("Bearer token is required but not provided"));
        }

        let currentUser = await getCurrentUserInfo(accessToken);
        if (!currentUser) {
            return res.status(401).json(OperationOutcome("Invalid Bearer token provided"));
        }
        const data = res.json();
        let patient = (await FhirApi(`/Patient`, { method: "POST", data }));
        if(patient.statusCode === 200){
            issueConsent(patient.data.id, currentUser?.family_name );
        }

        return res.status(patient.statusCode).json(patient.data);
    } catch (error) {

    }

})


// get patient by id 
router.get('/fhir/Coverage', async (req: Request, res: Response) => {
    try {
        const accessToken = req.headers.authorization?.split(' ')[1] || null;
        if (!accessToken || req.headers.authorization?.split(' ')[0] != "Bearer") {
            return res.status(401).json(OperationOutcome("Bearer token is required but not provided"));
        }
        const { id } = req.params;
        const searchParams = new URLSearchParams(req.query as Record<string, string>);
        if (!id) {
            return res.status(400).json(OperationOutcome("Patient ID is required"));
        }
        let currentUser = await getCurrentUserInfo(accessToken);
        if (!currentUser) {
            return res.status(401).json(OperationOutcome("Invalid Bearer token provided"));
        }
        let facilityId = currentUser.family_name;
        // let isConsentValid = await validateConsent(id, facilityId);
        // if (!isConsentValid) {
        //     return res.status(401).json(OperationOutcome("No consent found for the given patient ID"));
        // }
        let shrResponse = (await FhirApi(`/Coverage${searchParams.toString() ? `?${searchParams.toString()}` : ''}`));
        return res.status(shrResponse.statusCode).json(shrResponse.data);
    } catch (error) {
        console.error(error);
        return res.status(500).json(OperationOutcome("Internal Server Error"));

    }
});


router.post('/fhir/Observation', async (req: Request, res: Response) => {
    try {
        const accessToken = req.headers.authorization?.split(' ')[1] || null;
        if (!accessToken || req.headers.authorization?.split(' ')[0] != "Bearer") {
            return res.status(401).json(OperationOutcome("Bearer token is required but not provided"));
        }
        
        let currentUser = await getCurrentUserInfo(accessToken);
        if (!currentUser) {
            return res.status(401).json(OperationOutcome("Invalid Bearer token provided"));
        }
        let facilityId = currentUser.family_name;

        let data = req.body;
        // get id from observation
        let patientId = data?.subject?.reference?.split('/')[1];
        if (!patientId) {
            return res.status(400).json(OperationOutcome("Patient ID is required in the observation data"));
        }

        const isConsentValid = await validateConsent(patientId, facilityId);
        console.log(isConsentValid);
        if (!isConsentValid) {
            return res.status(401).json(OperationOutcome("No active consent found for the given patient ID"));
        }
        let shrResponse = (await FhirApi(`/Observation`, { method: 'POST', data })).data;
        if (shrResponse.statusCode !== 201) {
            return res.status(400).json(shrResponse.data);
        }
        return res.status(shrResponse.statusCode).json(shrResponse.data);
    } catch (error) {
        console.error(error);
        return res.status(500).json(OperationOutcome("Internal Server Error"));
    }
});
export default router;