// //- profile validation

import { FhirApi } from "./utils";

const IG_FHIR_SERVER = process.env.IG_FHIR_SERVER;

export async function validateResourceProfile(
  resource: any,
  profileId: string
) {
  const response = (
    await FhirApi({
      url: `${resource.resourceType}/$validate?profile=${IG_FHIR_SERVER}/StructureDefinition/${profileId}`,
      method: "POST",
      body: resource,
    })
  ).data;
  // logger.info(response);
  let issues = response?.issue;
  let errors: Array<any> = issues.map((issue: any) => {
    return issue.severity;
  });
  if (errors.indexOf("error") > -1) {
    return { status: "error", response };
  }
  return { status: "success", response };
}

function extractSubjectIdentifier(data: any) {
  try {
    let subjectUpi = "";
    let fhirResource = data;
    if (
      fhirResource &&
      fhirResource.subject &&
      fhirResource.subject.identifier
    ) {
      subjectUpi =
        fhirResource.subject.identifier.value || fhirResource.subject.display;
    }
    return subjectUpi;
  } catch (error) { }
}

const _asyncValidator = async (resources: Array<any>) => {
  try {
    let results: any = [];
    let failedValidation: any = [];

    for (let resource in resources) {
      let identifier = extractSubjectIdentifier(resource);
      if (identifier) {
        results.push(`${resource}/`);
      } else {
        failedValidation.push(
          `${resource} failed resource validation: invalid entity`
        );
      }
      // results[`${resource.id}`]
    }
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const findPatientByIdentifier = async (id: string, identifierType: string | null = null) => {
  try {
    const patient = (await FhirApi({ url: `/Patient?identifier=${id}` })).data;
    if (patient?.entry?.total && patient?.entry?.total > 0) {
      return patient?.entry?.[0]?.resource?.id;
    }
    return patient.id;
  } catch (error) { 
    return null;
  }
};



interface EntityReference {
  resourceType: string;
  reference?: string;
  identifier?: {
    value: string;
    system?: string;
  };
  display?: string;
}

function extractEntities(data: any): EntityReference[] {
  const entities: EntityReference[] = [];
  
  function isEntityReference(obj: any): boolean {
    return obj && 
           (obj.reference || obj.identifier || obj.display) &&
           typeof obj === 'object' &&
           !Array.isArray(obj);
  }
  
  function extractFromObject(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    
    // Handle arrays
    if (Array.isArray(obj)) {
      obj.forEach(item => extractFromObject(item));
      return;
    }
    
    // Check common FHIR reference fields
    const referenceFields = [
      'subject', 'patient', 'practitioner', 'organization',
      'requester', 'performer', 'author', 'asserter',
      'recorder', 'participant', 'encounter', 'location'
    ];
    
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      
      // If it's a reference field and contains reference data
      if (referenceFields.includes(key) && isEntityReference(value)) {
        const entityRef: EntityReference = {
          resourceType: key.charAt(0).toUpperCase() + key.slice(1),
          reference: value.reference,
          display: value.display
        };
        
        if (value.identifier) {
          entityRef.identifier = {
            value: value.identifier.value,
            system: value.identifier.system
          };
        }
        
        entities.push(entityRef);
      }
      
      // Recursively search nested objects
      if (typeof value === 'object') {
        extractFromObject(value);
      }
    }
  }
  
  try {
    extractFromObject(data);
    return entities;
  } catch (error) {
    console.error('Error extracting entities:', error);
    return [];
  }
}