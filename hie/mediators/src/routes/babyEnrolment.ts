import express from "express";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

router.post("/", (req, res) => {
  try {
    const payload = req.body;

    if (!payload || !payload.answers) {
      return res.status(400).json({ error: "Invalid payload" });
    }

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
      (genderAnswer[0] === "PfiESRthYg2f" ? "male" : "female") : undefined;

    // FHIR Patient Resource for the child
    const patient = {
      resourceType: "Patient",
      id: uuidv4(),
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
        system: "http://example.org/national-id",
        value: answers["NI57snEmn4bR"].toString()
      }],
      relationship: [{
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode", code: "MTH", display: "Mother" }]
      }]
    };

    // FHIR Bundle
    const bundle = {
      resourceType: "Bundle",
      type: "transaction",
      entry: [
        { resource: patient, request: { method: "POST", url: "Patient" } },
        { resource: relatedPerson, request: { method: "POST", url: "RelatedPerson" } }
      ]
    };

    res.json(bundle);
    return;
  } catch (error) {
    res.status(500).json({
      error: 'Error transforming data to FHIR format',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
