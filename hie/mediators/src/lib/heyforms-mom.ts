import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { FhirIdentifier } from './fhir';

const router = Router();

// Input JSON types
interface JsonRequest {
    id: string;
    user: {
        firstName: string;
        lastName: string;
        phoneNumber: string;
        dateOfBirth: string;
        maritalStatus: string;
        nationality: string;
        nationalId: string;
        passportNo: string;
    };
    medical: {
        lastMenstrualPeriod: string;
        previouslyPregnant: boolean;
        previousPregnancyComplications?: string[];
        hasHealthConditions: boolean;
        currentHealthConditions?: string[];
    };
    organization:{
        facilityId?: string;
        facilityName?: string;
    }
}

// FHIR Response types
interface Bundle {
    resourceType: 'Bundle';
    type: 'transaction';
    entry: BundleEntry[];
}

interface BundleEntry {
    // fullUrl: string;
    resource: FhirResource;
    request: {
        method: string;
        url: string;
    };
}

interface FhirResource {
    resourceType: string;
    id: string;
    meta?: {
        profile?: string[];
    };
    [key: string]: any;
}

export const momFormToFhirBundle = (data: JsonRequest): Bundle => {
    data = processJsonData(data);
    const patientId = `${uuidv4()}`;

    // console.log(data);
    // Create Patient resource
    const patient: FhirResource = {
        resourceType: 'Patient',
        id: patientId,
        meta: {
            profile: ['http://fhir.org/guides/who/anc-cds/StructureDefinition/anc-patient']
        },
        // identifier: [FhirIdentifier("https://terminology.hl7.org/CodeSystem-v2-0203", "NATIONAL_ID", "National ID Number", data?.user?.nationalId ),
        //     FhirIdentifier("https://mamatoto.pharmaccess.io", "HEYFORM_ID", "HeyForm ID", data.id),
        //     FhirIdentifier("https://terminology.hl7.org/CodeSystem-v2-0203", "PASSPORT_NO", "Passport Number", data?.user?.passportNo )
        // ],
        identifier: [
            data?.user?.nationalId
              ? FhirIdentifier("https://terminology.hl7.org/CodeSystem-v2-0203", "NATIONAL_ID", "National ID Number", data.user.nationalId)
              : data?.user?.passportNo
              ? FhirIdentifier("https://terminology.hl7.org/CodeSystem-v2-0203", "PASSPORT", "Passport Number", data.user.passportNo)
              : null,
            FhirIdentifier("https://mamatoto.pharmaccess.io", "HEYFORM_ID", "HeyForm ID", data.id)
          ].filter(Boolean),
        active: true,
        name: [{
            use: 'official',
            family: data.user.lastName,
            given: [data.user.firstName]
        }],
        telecom: [{
            system: 'phone',
            value: data.user.phoneNumber,
            use: 'mobile'
        }],
        gender: 'female',
        // birthDate: data.user.dateOfBirth,
        birthDate: new Date(data.user.dateOfBirth).toISOString().split('T')[0],
        maritalStatus: {
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
                code: getMaritalStatusCode(data.user.maritalStatus)
            }]
        }
    };

    const questionnaireResponse: FhirResource = {
        resourceType: 'QuestionnaireResponse',
        id: `${uuidv4()}`,
        subject: {
            reference: `Patient/${patientId}`
        },

    }

    // Create LMP Observation
    const lmpObservation: FhirResource = {
        resourceType: 'Observation',
        id: `${uuidv4()}`,
        meta: {
            profile: ['http://hl7.org/fhir/StructureDefinition/lastmenstrualperiod']
        },
        status: 'final',
        code: {
            coding: [{
                system: 'http://loinc.org',
                code: '8665-2',
                display: 'Last menstrual period start date'
            }]
        },
        subject: {
            reference: `Patient/${patientId}`
        },
        effectiveDateTime: data.medical.lastMenstrualPeriod,
        valueDateTime: data.medical.lastMenstrualPeriod
    };
    const organization: FhirResource = {
        resourceType: 'Organization',
        id: data.organization.facilityId || '',
        active: true,
        name: data.organization.facilityName,
        type: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/organization-type',
                code: 'clinic',
                display: 'Clinic',
              },
            ],
          },
        ]
    }
    // Create bundle entries
    const entries: BundleEntry[] = [
        {
            // fullUrl: `urn:uuid:${organization.id}`,
            resource: organization,
            request: {
                method: 'PUT',
                url: `Organization/${organization.id}`
            }
        },
        {
            // fullUrl: `urn:uuid:${patient.id}`,
            resource: patient,
            request: {
                method: 'POST',
                url: 'Patient'
            }
        },
        {
            // fullUrl: `urn:uuid:${lmpObservation.id}`,
            resource: lmpObservation,
            request: {
                method: 'POST',
                url: 'Observation'
            }
        },
        {
            // fullUrl: `urn:uuid:${lmpObservation.id}`,
            resource: questionnaireResponse,
            request: {
                method: 'POST',
                url: 'Observation'
            }
        }
    ];

    // Add pregnancy history if applicable
    if (data.medical.previouslyPregnant) {
        const pregnancyHistory: FhirResource = createPregnancyHistory(
            patientId,
            data.medical.previousPregnancyComplications || []
        );
        entries.push({
            // fullUrl: `urn:uuid:${pregnancyHistory.id}`,
            resource: pregnancyHistory,
            request: {
                method: 'POST',
                url: 'Observation'
            }
        });
    }

    // Add current health conditions if any
    if (data.medical.hasHealthConditions && data.medical.currentHealthConditions) {
        data.medical.currentHealthConditions.forEach(condition => {
            const conditionResource = createCondition(patientId, condition);
            entries.push({
                // fullUrl: `urn:uuid:${conditionResource.id}`,
                resource: conditionResource,
                request: {
                    method: 'POST',
                    url: 'Condition'
                }
            });
        });
    }

    return {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: entries
    };
};

const getMaritalStatusCode = (status: string): string => {
    const codes: { [key: string]: string } = {
        'single': 'S',
        'married': 'M',
        'divorced': 'D',
        'widowed': 'W'
    };
    return codes[status.toLowerCase()] || 'UNK';
};



const createPregnancyHistory = (patientId: string, complications: string[]): FhirResource => {
    const resource: FhirResource = {
        resourceType: 'Observation',
        id: `pregnancy-history-${uuidv4()}`,
        meta: {
            profile: ['http://hl7.org/fhir/StructureDefinition/pregnancy-history']
        },
        status: 'final',
        code: {
            coding: [{
                system: 'http://loinc.org',
                code: '11449-6',
                display: 'Pregnancy history'
            }]
        },
        subject: {
            reference: `Patient/${patientId}`
        },
        valueCodeableConcept: {
            coding: [{
                system: 'http://snomed.info/sct',
                code: '102874004',
                display: 'Previous pregnancies'
            }]
        }
    };

    if (complications.length > 0) {
        resource.component = complications.map(complication => ({
            code: {
                coding: [{
                    system: 'http://snomed.info/sct',
                    code: getComplicationCode(complication),
                    display: complication
                }]
            },
            valueBoolean: true
        }));
    }

    return resource;
};

const createCondition = (patientId: string, condition: string): FhirResource => {
    return {
        resourceType: 'Condition',
        id: `condition-${uuidv4()}`,
        clinicalStatus: {
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                code: 'active',
                display: 'Active'
            }]
        },
        verificationStatus: {
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                code: 'confirmed',
                display: 'Confirmed'
            }]
        },
        category: [{
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/condition-category',
                code: 'problem-list-item',
                display: 'Problem List Item'
            }]
        }],
        code: {
            coding: [{
                system: 'http://snomed.info/sct',
                code: getConditionCode(condition),
                display: condition
            }]
        },
        subject: {
            reference: `Patient/${patientId}`
        }
    };
};

const getComplicationCode = (complication: string): string => {
    const codes: { [key: string]: string } = {
        'Diabetes': '73211009',
        'Hypertension': '38341003',
        'Preterm Birth': '367498001',
        'Antepartum Hemorrhage': '270486005',
        'Postpartum Hemorrhage': '289530006',
        'C-section': '11466000',
        'Fetal Loss': '35714002'
    };
    return codes[complication] || 'unknown';
};

const getConditionCode = (condition: string): string => {
    const codes: { [key: string]: string } = {
        'Diabetes': '73211009',
        'Hypertension': '38341003',
        'Anemia': '271737000'
    };
    return codes[condition] || 'unknown';
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original string if invalid date
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
};



export const processJsonData = (jsonData: any) => {
    // Helper function to find answer by field ID
    const findAnswer = (fieldId: string) => {
        return jsonData.answers.find((answer: any) => answer.id === fieldId);
    };

    // Helper function to get multiple choice value
    const getMultiChoiceValue = (answer: any) => {
        if (!answer?.value?.value?.[0]) return '';
        return answer.properties.choices.find(
            (choice: any) => choice.id === answer.value.value[0]
        )?.label || '';
    };

    // Process JSON data into expected format
    const processedData = {
        id: jsonData.id,
        user: {
            firstName: findAnswer('5WZjaP6dL65q')?.value?.firstName || '',
            lastName: findAnswer('5WZjaP6dL65q')?.value?.lastName || '',
            phoneNumber: findAnswer('BdwJijjrb8TR')?.value || '',
            dateOfBirth: formatDate(findAnswer('IdSaw1CLBrNx')?.value) || '',
            maritalStatus: getMultiChoiceValue(findAnswer('d4rox3pBjUkJ')),
            nationality: getMultiChoiceValue(findAnswer('5V4y2SHD5Ajq')),
            nationalId: findAnswer('t0BJ95juc6zT')?.value?.toString() || '',
            passportNo: findAnswer('60z5FQAhOoy7')?.value?.toString() || ''
        },
        medical: {
            lastMenstrualPeriod: formatDate(findAnswer('Z57KvxvsYjEy')?.value) || '',
            previouslyPregnant: getMultiChoiceValue(findAnswer('9NZvbl8vJpDN')) === 'Yes',
            previousPregnancyComplications: [], // Only relevant if previously pregnant
            hasHealthConditions: getMultiChoiceValue(findAnswer('ADdot9NuxOL6')) === 'Yes',
            currentHealthConditions: [] // Only populated if hasHealthConditions is true
        },
        organization:{
            facilityId: (jsonData?.hiddenFields?.[0]?.value).split(':')[1] || '',
            facilityName: (jsonData?.hiddenFields?.[0]?.value).split(':')[0] || '',
        }
    };

    // If previously pregnant, get complications
    if (processedData.medical.previouslyPregnant) {
        const complications = findAnswer('FqMsYCBqgfTr');
        if (complications?.value?.value) {
            processedData.medical.previousPregnancyComplications = complications.properties.choices
                .filter((choice: any) => complications.value.value.includes(choice.id))
                .map((choice: any) => choice.label);
        }
    }

    // If has health conditions, get current conditions
    if (processedData.medical.hasHealthConditions) {
        const conditions = findAnswer('xtbPgjY6jVD7');
        if (conditions?.value?.value) {
            processedData.medical.currentHealthConditions = conditions.properties.choices
                .filter((choice: any) => conditions.value.value.includes(choice.id))
                .map((choice: any) => choice.label);
        }
    }

    return processedData;
};
