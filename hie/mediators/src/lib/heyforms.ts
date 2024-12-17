import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Interfaces to represent our input and FHIR resources
export interface MamaTotoFormData {
    fields: any[];
    answers: any[];
}

export interface FHIRPatient {
    resourceType: 'Patient';
    id: string;
    meta: {
        profile: string[];
    };
    name: Array<{
        use: 'official';
        family: string;
        given: string[];
    }>;
    telecom?: Array<{
        system: 'phone' | 'email';
        value: string;
        use?: 'home' | 'work';
    }>;
    gender?: 'male' | 'female' | 'other' | 'unknown';
    birthDate?: string;
    identifier?: Array<{
        type?: {
            coding: Array<{
                system: string;
                code: string;
                display: string;
            }>;
        };
        value: string;
    }>;
    maritalStatus?: {
        coding: Array<{
            system: string;
            code: string;
            display: string;
        }>;
    };
}

interface FHIRCondition {
    resourceType: 'Condition';
    subject: {
        reference: string;
    };
    code: {
        coding: Array<{
            system: string;
            code: string;
            display: string;
        }>;
    };
}

interface FHIRPregnancyObservation {
    resourceType: 'Observation';
    status: 'final';
    code: {
        coding: Array<{
            system: string;
            code: string;
            display: string;
        }>;
    };
    subject: {
        reference: string;
    };
    effectiveDateTime?: string;
    valueDateTime?: string;
}

export class MamaTotoFHIRTransformer {
    private formData: MamaTotoFormData;

    constructor(formData: MamaTotoFormData) {
        this.formData = formData;
    }

    // Helper method to find an answer by field ID
    private findAnswer(fieldId: string) {
        return this.formData.answers.find(ans => ans.id === fieldId);
    }

    // Transform form data to FHIR Patient
    transformToFHIRPatient(): FHIRPatient {
        const nameAnswer = this.findAnswer('bJKyl3XCKNt3');
        const dobAnswer = this.findAnswer('YdbVvCqZxBoL');
        const phoneAnswer = this.findAnswer('jO6hTFjPQb3y');
        const nationalIdAnswer = this.findAnswer('z8gtNHjxPzcC');
        const maritalStatusAnswer = this.findAnswer('hj3BjAaEoC9j');
        const nationalityAnswer = this.findAnswer('BxnimRyOaiRR');

        const patient: FHIRPatient = {
            resourceType: 'Patient',
            id: uuidv4(),
            meta: {
                profile: ['http://hl7.org/fhir/StructureDefinition/Patient']
            },
            name: [{
                use: 'official',
                family: nameAnswer?.value?.lastName || '',
                given: [nameAnswer?.value?.firstName || '']
            }],
            telecom: phoneAnswer ? [{
                system: 'phone',
                value: phoneAnswer.value,
                use: 'home'
            }] : undefined,
            birthDate: this.convertToISODate(dobAnswer?.value),
            identifier: nationalIdAnswer ? [{
                type: {
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                        code: 'NI',
                        display: 'National ID'
                    }]
                },
                value: nationalIdAnswer.value.toString()
            }] : undefined,
            maritalStatus: this.mapMaritalStatus(maritalStatusAnswer?.value?.value[0]),
            gender: this.mapGender(nationalityAnswer?.value?.value[0])
        };

        return patient;
    }

    // Transform form data to Pregnancy Observations
    transformToPregnancyObservations(patientReference: string): FHIRPregnancyObservation[] {
        const observations: FHIRPregnancyObservation[] = [];

        // Expected Delivery Date
        const eddAnswer = this.findAnswer('MPgyLg43uCqX');
        if (eddAnswer) {
            observations.push({
                resourceType: 'Observation',
                status: 'final',
                code: {
                    coding: [{
                        system: 'http://snomed.info/sct',
                        code: '288495006',
                        display: 'Estimated date of delivery'
                    }]
                },
                subject: { reference: patientReference },
                effectiveDateTime: new Date().toISOString(),
                valueDateTime: this.convertToISODate(eddAnswer.value)
            });
        }

        // Last Menstrual Period
        const lmpAnswer = this.findAnswer('0PpJy8m34vII');
        if (lmpAnswer) {
            observations.push({
                resourceType: 'Observation',
                status: 'final',
                code: {
                    coding: [{
                        system: 'http://snomed.info/sct',
                        code: '248957007',
                        display: 'Last menstrual period'
                    }]
                },
                subject: { reference: patientReference },
                effectiveDateTime: new Date().toISOString(),
                valueDateTime: this.convertToISODate(lmpAnswer.value)
            });
        }

        return observations;
    }

    // Transform form data to Conditions
    transformToConditions(patientReference: string): FHIRCondition[] {
        const conditions: FHIRCondition[] = [];
        const previousConditionsAnswer = this.findAnswer('URvb7tvt5DiE');
        
        if (previousConditionsAnswer && Array.isArray(previousConditionsAnswer.value)) {
            const conditionMap: {[key: string]: {system: string, code: string, display: string}} = {
                'Diabetes': {
                    system: 'http://snomed.info/sct', 
                    code: '73211009', 
                    display: 'Diabetes mellitus'
                },
                'Hypertension': {
                    system: 'http://snomed.info/sct', 
                    code: '38341003', 
                    display: 'Hypertensive disorder'
                },
                'C-section': {
                    system: 'http://snomed.info/sct', 
                    code: '265425004', 
                    display: 'Previous cesarean section'
                }
            };

            previousConditionsAnswer.value.forEach((conditionId: string) => {
                const choice = previousConditionsAnswer.properties.choices.find((c: any) => c.id === conditionId);
                if (choice && conditionMap[choice.label]) {
                    conditions.push({
                        resourceType: 'Condition',
                        subject: { reference: patientReference },
                        code: {
                            coding: [conditionMap[choice.label]]
                        }
                    });
                }
            });
        }

        return conditions;
    }

    // Utility method to convert DD/MM/YYYY to YYYY-MM-DD
    private convertToISODate(dateString?: string): string | undefined {
        if (!dateString) return undefined;
        const [day, month, year] = dateString.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Map marital status to FHIR coding
    private mapMaritalStatus(statusId?: string) {
        const statusMap: {[key: string]: string} = {
            'Ks6ScmF0MM7B': 'S', // Single
            'PSZW0omZQ4ik': 'M', // Married
            '9AZBrDrLoqC3': 'D', // Divorced
            'IJWrg2pvWOUy': 'W'  // Widowed
        };

        if (!statusId) return undefined;

        return {
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
                code: statusMap[statusId],
                display: statusId
            }]
        };
    }

    // Map nationality to gender (approximation)
    private mapGender(nationalityId?: string): 'male' | 'female' | 'other' | 'unknown' {
        return 'female'; // This is a pregnancy form, so defaulting to female
    }
}