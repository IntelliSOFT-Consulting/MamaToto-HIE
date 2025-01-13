import express from 'express';
import { Router, Request, Response } from 'express';
import { FhirApi } from '../lib/utils';

// Interfaces for the form data
interface FormAnswer {
  id: string;
  title: string;
  kind: string;
  value: any;
  properties?: {
    format?: string;
    allowTime?: boolean;
    choices?: Array<{
      id: string;
      label: string;
    }>;
  };
}

interface FormData {
  id: string;
  formId: string;
  formName: string;
  answers: FormAnswer[];
  hiddenFields: Array<{
    id: string;
    name: string;
    value: string;
  }>;
}

// FHIR interfaces
interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'transaction';
  entry: Array<{
    fullUrl: string;
    resource: any;
    request: {
      method: string;
      url: string;
    };
  }>;
}

interface FHIRPatient {
  resourceType: 'Patient';
  id?: string;
  name: Array<{
    use: string;
    family: string;
    given: string[];
  }>;
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string;
  link?: Array<{
    other: {
      reference: string;
    };
    // type: 'seealso' | 'replaced-by' | 'replaces' | 'refer' | 'mother';
  }>;
}

const router: Router = express.Router();

// Helper function to transform date format from DD/MM/YYYY to YYYY-MM-DD
const transformDate = (date: string): string => {
  const [day, month, year] = date.split('/');
  return `${year}-${month}-${day}`;
};

// Helper function to get gender value
const getGender = (formAnswer: FormAnswer): 'male' | 'female' => {
  const genderChoice = formAnswer.properties?.choices?.find(
    choice => choice.id === formAnswer.value.value[0]
  );
  return genderChoice?.label.toLowerCase() as 'male' | 'female';
};

router.post('/', async (req: Request, res: Response) => {
  try {
    const formData: FormData = req.body;

    // Find relevant answers
    const nameAnswer = formData.answers.find(a => a.kind === 'full_name');
    const dateAnswer = formData.answers.find(a => a.kind === 'date');
    const genderAnswer = formData.answers.find(a => a.kind === 'multiple_choice');
    const motherIdAnswer = formData.answers.find(a => a.kind === 'number');

    if (!nameAnswer || !dateAnswer || !genderAnswer || !motherIdAnswer) {
      throw new Error('Missing required form fields');
    }

    // Create Patient resource for the child
    const patientResource: FHIRPatient = {
      resourceType: 'Patient',
      id: formData.id,
      name: [
        {
          use: 'official',
          family: nameAnswer.value.lastName,
          given: [nameAnswer.value.firstName]
        }
      ],
      gender: getGender(genderAnswer),
      birthDate: transformDate(dateAnswer.value),
      link: [
        {
          other: {
            reference: `Patient/${motherIdAnswer.value}`
          }
        }
      ]
    };

    // Create the FHIR Bundle
    const bundle: FHIRBundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        {
          fullUrl: `urn:uuid:${formData.id}`,
          resource: patientResource,
          request: {
            method: 'POST',
            url: 'Patient'
          }
        }
      ]
    };
    let shrResponse = await (
          await FhirApi({
            url: "/",
            method: "POST",
            data: JSON.stringify(bundle),
          })
        ).data;
        // console.log(bundle);
    res.json(shrResponse);
    return;
  } catch (error) {
    res.status(400).json({
      error: 'Failed to transform form data to FHIR Bundle',
      details: (error as Error).message
    });
    return;
  }
});

export default router;