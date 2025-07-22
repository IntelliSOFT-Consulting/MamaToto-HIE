import { FhirApi } from "./utils"

const allowedFacilityExtension = (facilityId: string, facilityName: string) => {
    return {
        "url": "http://example.org/fhir/StructureDefinition/facility-allowlist",
        "valueReference": {
            "reference": `Organization/${facilityId}`,
            "display": facilityName
        }
    }
}

export const validateConsent = async (patientId: string, facilityId: string) => {
    try {
        let consent = (await FhirApi(`/Consent/${patientId}`)).data;
        let allowedFacilities = consent?.provision?.extension;
        allowedFacilities = allowedFacilities.map((ext: any) => {
            return ext?.valueReference?.reference.split('/')[1];
        });
        return allowedFacilities.indexOf(facilityId) > -1;
    } catch (error) {
        return false;
    }

}

export const issueConsent = async (patientId: string, facilityId: string) => {
    try {



        let patientData = (await FhirApi(`/Patient/${patientId}`)).data;
        if (!patientData || patientData.resourceType !== "Patient") {
            return null;
        }

        let consent = (await FhirApi(`/Consent/${patientData?.id}`)).data;
        console.log(consent);


        if (consent.resourceType != "Consent") {
            consent = (await FhirApi({
                url: `/Consent/${patientData?.id}`,
                method: 'PUT',
                data: {
                    resourceType: "Consent",
                    id: patientData?.id,
                    status: "active",
                    patient: {
                        reference: `Patient/${patientData?.id}`
                    },
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
                    provision: {
                        type: "permit",
                        extension: []
                    }
                }
            })).data;
        }

        // add consent extensions
        let consentedFacilities: Array<any> = consent?.provision?.extension ?? [];

        let consentedFacilityIds = consentedFacilities.map((ext: any) => {
            return ext?.valueReference?.reference.split('/')[1];
        })

        if (consentedFacilityIds.indexOf(facilityId) > -1) {
            let consentResponse = { ...consent, provision: { type: "permit", extension: [allowedFacilityExtension(facilityId, facilityId)] } }
            return consentResponse;
        }


        consentedFacilities.push(allowedFacilityExtension(facilityId, facilityId));
        consent.provision.extension = consentedFacilities;
        const response = (await FhirApi({ url: `/Consent/${patientData?.id}`, method: 'PUT', data: consent }));
        let consentResponse = { ...response.data, provision: { type: "permit", extension: [allowedFacilityExtension(facilityId, facilityId)] } }

        return consentResponse;
    } catch (error) {
        return null;
    }
}