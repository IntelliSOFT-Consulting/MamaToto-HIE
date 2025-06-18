import express, { Request, Response } from "express";
import { FhirApi } from "../lib/utils";
import { v4 } from "uuid";
import { findKeycloakUser, getCurrentUserInfo } from "../lib/keycloak";
import { get } from "http";
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
        
        const consentId = v4();
        let patientData: any = null;
        if(idNumber ?? passport ?? birthCertificate){
            patientData = (await FhirApi(`/Patient?identifier=${idNumber ?? passport ?? birthCertificate}`)).data;
            if (!patientData || patientData.resourceType !== "Bundle" || patientData.total === 0) {
                res.statusCode = 404;
                res.json({ error: "Patient not found", status: "error" });
                return;
            }
            patientData = patientData.entry[0].resource;
        }else if (patient) {
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

        

        // const consentId = `${idNumber ? idNumber : passport ? passport : birthCertificate}-${facility}`;
        let consent = (await FhirApi(`/Consent/${consentId}`, {
            method: 'PUT',
            data: {
                resourceType: "Consent",
                id: consentId,
                status: "active",
                patient: {
                    reference: `Patient/${patient?.id}`
                },
                organization: [
                    {
                        reference: `Organization/${facilityId}`
                    }
                ],
                category: [
                    {
                        coding: [
                            {
                                system: "http://terminology.hl7.org/CodeSystem/consentcategorycodes",
                                code: "HIE"
                            }
                        ]
                    }
                ],
                dateTime: new Date().toISOString(),
            }
        }));
        return res.status(consent.statusCode).json(consent.data);
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