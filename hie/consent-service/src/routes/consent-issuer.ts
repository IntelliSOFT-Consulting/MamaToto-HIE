import express, { Request, Response } from "express";
import { FhirApi, OperationOutcome } from "../lib/utils";
import { v4 } from "uuid";
import { findKeycloakUser, getCurrentUserInfo } from "../lib/keycloak";
import { get } from "http";
import { extension } from "mime-types";
import { issueConsent } from "../lib/consent";
const router = express.Router();
router.use(express.json());


router.post("/request", async (req: Request, res: Response) => {
    try {
        let { passport, idNumber, birthCertificate, patient } = req.body;

        let token = req.headers.authorization?.split(' ')[1] || null;
        if (!token || req.headers.authorization?.split(' ')[0] != "Bearer") {
            res.statusCode = 401;
            res.json({ status: "error", error: "Bearer token is required but not provided" });
            return;
        }
        let currentUser = await getCurrentUserInfo(token);
        if (!currentUser) {
            res.statusCode = 401;
            res.json({ status: "error", error: "Invalid access token" });
            return;
        }
        // let userInfo = await findKeycloakUser(currentUser.preferred_username);

        let facilityId = currentUser.family_name;

        let patientData: any = null;
        if (idNumber ?? passport ?? birthCertificate) {
            patientData = (await FhirApi(`/Patient?identifier=${idNumber ?? passport ?? birthCertificate}`)).data;
            if (!patientData || patientData.resourceType !== "Bundle" || patientData.total === 0) {
                res.statusCode = 404;
                res.json({ error: "Patient not found", status: "error" });
                return;
            }
            patientData = patientData.entry[0].resource;
        } else if (patient) {
            patientData = (await FhirApi(`/Patient/${patient}`)).data;
            if (!patientData || patientData.resourceType !== "Patient") {
                res.statusCode = 404;
                res.json({ error: "Patient not found", status: "error" });
                return;
            }
        }

        patient = (await FhirApi(`/Patient/${patientData?.id}`)).data;
        if (patient?.resourceType !== "Patient") {
            res.statusCode = 404;
            res.json({ error: "Patient not found", status: "error" });
            return;
        }

        // check if patient has consent resource
        let consentStatus = await issueConsent(patient?.id, facilityId);
        if (!consentStatus) {
            return res.status(400).json(OperationOutcome("Failed to issue consent. Try again later"));
        }

        return res.status(200).json(consentStatus);
    }
    catch (error) {
        console.log(error);
        res.statusCode = 401;
        res.json({ error: "incorrect email or password", status: "error" });
        return;
    }
});

router.post("/revoke", async (req: Request, res: Response) => {
    try {
        let { patient, facility } = req.body;
        res.statusCode = 200;
        res.json({ status: "success", message: "Consent revoked successfully" });
        return;
    }
    catch (error) {
        console.log(error);
        res.statusCode = 401;
        res.json({ error: "incorrect email or password", status: "error" });
        return;
    }
});

export default router