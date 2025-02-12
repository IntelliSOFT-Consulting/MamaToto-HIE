
import { v4 as uuidv4 } from "uuid";
import { FhirIdentifier } from "./fhir";


export const childFormToFhirBundle = (payload: any) => {
    try {
        // Extract answers
        const answers = payload.answers.reduce((acc: any, field: any) => {
            acc[field.id] = field.value;
            return acc;
        }, {});

        // Convert date format (DD/MM/YYYY -> YYYY-MM-DD)
        const formatDate = (dateStr: string) => {
            const [day, month, year] = dateStr.split("/");
            return `${year}-${month}-${day}`;
        };

        // Extract gender safely
        const genderAnswer = answers["ZRNqwtLAyAlr"]?.value?.value;
        const gender = genderAnswer && genderAnswer.length > 0 ?
            (genderAnswer[0] === "PfiESRthYg2f" ? "male" : "female") : "female";

        // FHIR Patient Resource for the child
        const patient = {
            resourceType: "Patient",
            id: uuidv4(),
            identifier: [
                FhirIdentifier("https://terminology.hl7.org/CodeSystem-v2-0203", "NATIONAL_ID", "Mother's ID Number", answers["NI57snEmn4bR"].toString()),
                // FhirIdentifier("https://mamatoto.pharmaccess.io", "HEYFORM_ID", "HeyForm ID", payload.id),
            ],
            name: [{
                given: [answers["1WLpdlhdUoOi"]?.firstName || "Unknown"],
                family: answers["1WLpdlhdUoOi"]?.lastName || "Unknown"
            }],
            gender: gender || "unknown", // Default to "unknown" if gender is not provided
            birthDate: answers["wfD0VClrONfM"] ? formatDate(answers["wfD0VClrONfM"]) : undefined
        };


        // FHIR RelatedPerson Resource for the mother
        const relatedPerson = {
            resourceType: "RelatedPerson",
            id: uuidv4(),
            patient: { reference: `Patient/${patient.id}` },
            identifier: [{
                system: "https://terminology.hl7.org/CodeSystem-v2-0203",
                code: "NATIONAL_ID",
                value: answers["NI57snEmn4bR"].toString()
            }],
            relationship: [{
                coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode", code: "MTH", display: "Mother" }]
            }]
        };

        // Create FHIR Bundle
        const bundle = {
            resourceType: "Bundle",
            type: "transaction",
            entry: [
                { resource: patient, request: { method: "POST", url: "Patient" } },
                { resource: relatedPerson, request: { method: "POST", url: "RelatedPerson" } }
            ]
        };
        return bundle;

    } catch (error) {
        return null;
    }
}