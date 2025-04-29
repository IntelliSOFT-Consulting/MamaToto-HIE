import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { FhirIdentifier } from './fhir';

const router = Router();

// Input JSON types for MomCare Social form
interface MomCareSocialForm {
    id: string;
    formId: string;
    formName: string;
    fields: Field[];
    answers: Answer[];
    hiddenFields: HiddenField[];
}

interface Field {
    title: string[];
    description: string[];
    kind: string;
    validations: {
        required?: boolean;
    } | null;
    properties: {
        allowMultiple?: boolean;
        choices?: Choice[];
        allowOther?: boolean;
        format?: string;
        allowTime?: boolean;
        defaultCountryCode?: string;
    } | null;
    id: string;
    layout: any;
}

interface Choice {
    id: string;
    label: string;
}

interface Answer {
    id: string;
    title: string;
    kind: string;
    properties?: {
        allowMultiple?: boolean;
        choices?: Choice[];
        allowOther?: boolean;
        format?: string;
        allowTime?: boolean;
        defaultCountryCode?: string;
    };
    value: any;
}

interface HiddenField {
    id: string;
    name: string;
    value: string;
}

// FHIR Response types
interface Bundle {
    resourceType: 'Bundle';
    type: 'transaction';
    entry: BundleEntry[];
}

interface BundleEntry {
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

// Main conversion function
export const momCareSocialToFhirBundle = (data: MomCareSocialForm): Bundle => {
    const processedData = processJsonData(data);
    const patientId = `${uuidv4()}`;
    
    // Create Patient resource
    const patient: FhirResource = {
        resourceType: 'Patient',
        id: patientId,
        meta: {
            profile: ['http://fhir.org/guides/who/anc-cds/StructureDefinition/anc-patient']
        },
        identifier: [
            FhirIdentifier("https://terminology.hl7.org/CodeSystem-v2-0203", "NATIONAL_ID", "National ID Number", processedData.user.nationalId),
            FhirIdentifier("https://mamatoto.pharmaccess.io", "HEYFORM_ID", "HeyForm ID", processedData.id),
            FhirIdentifier("https://mamatoto.pharmaccess.io", "MOMCARE_SOCIAL_FORM_ID", "HeyForm ID", processedData.id),
        ],
        active: true,
        name: [{
            use: 'official',
            family: processedData.user.lastName,
            given: [processedData.user.firstName]
        }],
        telecom: [{
            system: 'phone',
            value: processedData.user.phoneNumber,
            use: 'mobile'
        }],
        gender: 'female',
        birthDate: processedData.user.dateOfBirth,
        maritalStatus: {
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
                code: getMaritalStatusCode(processedData.user.maritalStatus)
            }]
        },
        address: [{
            use: 'home',
            text: processedData.user.residenceCounty
        }]
    };

    // Create Questionnaire Response for social determinants 
    const questionnaireResponse: FhirResource = {
        resourceType: 'QuestionnaireResponse',
        id: `${uuidv4()}`,
        status: 'completed',
        subject: {
            reference: `Patient/${patientId}`
        },
        authored: new Date().toISOString(),
        item: [
            {
                linkId: 'education',
                text: 'Education level of household head',
                answer: [{
                    valueString: processedData.social.educationLevel
                }]
            },
            {
                linkId: 'employment',
                text: 'Current working status',
                answer: [{
                    valueString: processedData.social.workingStatus
                }]
            },
            {
                linkId: 'income-sufficient',
                text: 'Is household income sufficient for basic needs',
                answer: [{
                    valueBoolean: processedData.social.incomeCoversBasics
                }]
            },
            {
                linkId: 'food-security',
                text: 'Skipped meal in past two weeks',
                answer: [{
                    valueBoolean: processedData.social.skippedMeals
                }]
            },
            {
                linkId: 'financial-preparation',
                text: 'Has financial preparation for pregnancy',
                answer: [{
                    valueBoolean: processedData.social.financialPreparation
                }]
            },
            {
                linkId: 'anc-visits',
                text: 'Previous clinic visits this pregnancy',
                answer: [{
                    valueString: processedData.medical.previousClinicVisits
                }]
            },
            {
                linkId: 'clinic-reference',
                text: 'Clinic Reference',
                answer: [{
                    valueString: processedData.organization.facilityName
                }]
            },
            {
                linkId: 'previous-pregnancies-count', 
                text: 'Number of previous pregnancies',
                answer: [{
                    valueInteger: processedData.medical.pregnancyCount
                }]
            },
            {
                linkId: 'previous-births-count',
                text: 'Number of previous births',
                answer: [{
                    valueInteger: processedData.medical.birthCount
                }]
            }
        ]
    };

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
        effectiveDateTime: new Date().toISOString(),
        valueDateTime: processedData.medical.lastMenstrualPeriod
    };

    const organization: FhirResource = {
        resourceType: 'Organization',
        id: processedData.organization.facilityId,
        active: true,
        name: processedData.organization.facilityName,
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
            resource: organization,
            request: {
                method: 'PUT',
                url: `Organization/${processedData.organization.facilityId}`
            }
        },
        {
            resource: patient,
            request: {
                method: 'POST',
                url: 'Patient'
            }
        },
        {
            resource: lmpObservation,
            request: {
                method: 'POST',
                url: 'Observation'
            }
        },
        {
            resource: questionnaireResponse,
            request: {
                method: 'POST',
                url: 'QuestionnaireResponse'
            }
        }
    ];

    // Add health conditions
    if (processedData.medical.healthConditions.length > 0) {
        processedData.medical.healthConditions.forEach(condition => {
            if (condition !== 'None') {
                const conditionResource = createCondition(patientId, condition);
                entries.push({
                    resource: conditionResource,
                    request: {
                        method: 'POST',
                        url: 'Condition'
                    }
                });
            }
        });
    }

    // Add pregnancy history if applicable
    if (processedData.medical.previouslyPregnant) {
        const pregnancyHistory: FhirResource = createPregnancyHistory(
            patientId,
            processedData.medical.previousPregnancyComplications || []
        );
        entries.push({
            resource: pregnancyHistory,
            request: {
                method: 'POST',
                url: 'Observation'
            }
        });
    }

    return {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: entries
    };
};

// Helper function to convert marital status to FHIR code
const getMaritalStatusCode = (status: string): string => {
    const codes: { [key: string]: string } = {
        'single': 'S',
        'married': 'M',
        'divorced': 'D',
        'widowed': 'W'
    };
    return codes[status.toLowerCase()] || 'UNK';
};

// Helper function to create pregnancy history resource
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

// Helper function to create condition resource
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

// Helper function to get complication code
const getComplicationCode = (complication: string): string => {
    const codes: { [key: string]: string } = {
        'Hypertension': '38341003',
        'Diabetes': '73211009',
        'A baby born more than three weeks early': '367498001',
        'Heavy bleeding before, during or after giving birth': '289530006', 
        'A caesarean section': '11466000'
    };
    return codes[complication] || 'unknown';
};

// Helper function to get condition code
const getConditionCode = (condition: string): string => {
    const codes: { [key: string]: string } = {
        'Diabetes': '73211009',
        'High blood pressure': '38341003', 
        'Hypertension': '38341003',
        'Mental health disorder (e.g. depression, anxiety, bipolar)': '74732009',
        'HIV': '86406008',
        'Tuberculosis': '56717001',
        'Anemia': '271737000'
    };
    return codes[condition] || 'unknown';
};

// Helper function to format date
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original string if invalid date
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
};

// Process MomCare Social JSON data into standard format
export const processJsonData = (jsonData: MomCareSocialForm) => {
    // Helper function to find answer by field ID
    const findAnswer = (fieldId: string) => {
        return jsonData.answers.find((answer: any) => answer.id === fieldId);
    };

    // Helper function to get multiple choice value
    const getMultiChoiceValue = (answer: any): string => {
        if (!answer?.value?.value?.[0]) return '';
        const choiceId = answer.value.value[0];
        return answer.properties?.choices?.find(
            (choice: Choice) => choice.id === choiceId
        )?.label || '';
    };

    // Helper function to get multiple values for multiple-choice questions
    const getMultipleChoiceValues = (answer: any): string[] => {
        if (!answer?.value?.value || !Array.isArray(answer.value.value)) return [];
        return answer.value.value.map((choiceId: any) => 
            answer.properties?.choices?.find(
                (choice: Choice) => choice.id === choiceId
            )?.label || ''
        );
    };

    // Helper function to get yes/no value as boolean
    const getYesNoAsBoolean = (answer: any): boolean => {
        if (!answer?.value) return false;
        const yesChoiceId = answer.properties?.choices?.find(
            (choice: Choice) => choice.label.toLowerCase() === 'yes'
        )?.id;
        return answer.value === yesChoiceId;
    };

    // Find clinic reference from hidden fields
    const clinicRef = jsonData.hiddenFields.find(field => field.name === 'clinicref')?.value || '';

    // Process JSON data into expected format
    const processedData = {
        id: jsonData.id,
        user: {
            firstName: findAnswer('z9PBiR9sdLgq')?.value?.firstName || '',
            lastName: findAnswer('z9PBiR9sdLgq')?.value?.lastName || '',
            phoneNumber: findAnswer('zRcbDbZ3sFqT')?.value || '',
            dateOfBirth: formatDate(findAnswer('5urij9Ikc9g7')?.value) || '',
            maritalStatus: getMultiChoiceValue(findAnswer('OGfeTBl7HuCJ') || {}),
            nationalId: findAnswer('7Df4BFiaK2Li')?.value?.toString() || '',
            residenceCounty: findAnswer('nO3AJwI58xAJ')?.value || ''
        },
        medical: {
            lastMenstrualPeriod: formatDate(findAnswer('AzRjtsYWVTUv')?.value) || '',
            previouslyPregnant: findAnswer('YRWWsEDDiCG3')?.value === 'rJ8yLCpUUrax', // Yes value
            pregnancyCount: findAnswer('twRtBapwcOJM')?.value || 0,
            birthCount: findAnswer('Oeecuk3lfNws')?.value || 0,
            previousPregnancyComplications: getMultipleChoiceValues(findAnswer('Fk1WzbaoNML8') || {})
                .filter(complication => complication !== 'None'),
            healthConditions: getMultipleChoiceValues(findAnswer('SmiFHwbkDkEK') || {}),
            previousClinicVisits: getMultiChoiceValue(findAnswer('VxY85DzhVQRN') || {})
        },
        social: {
            educationLevel: getMultiChoiceValue(findAnswer('SaL80EVFl522') || {}),
            workingStatus: getMultiChoiceValue(findAnswer('H2c9yMm1SpPc') || {}),
            incomeCoversBasics: findAnswer('Z4WcTtz1fulU')?.value === 'IR94UxITCvBf', // Yes value
            skippedMeals: findAnswer('0sgFOukUAJWC')?.value === 'aZQPgORSRVrv', // Yes value
            financialPreparation: findAnswer('ZzmoVIuW2R3C')?.value === 'gLXHICJexQW9' // Yes value
        },
        organization:{
            facilityId: jsonData?.hiddenFields?.[0]?.id || '',
            facilityName: jsonData?.hiddenFields?.[1]?.name || '',
        }
    };

    return processedData;
};

export default router;