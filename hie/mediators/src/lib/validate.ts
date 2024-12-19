// //- profile validation

// import { FhirApi } from "./utils";

// const IG_FHIR_SERVER = process.env.IG_FHIR_SERVER;
// export async function validateResourceProfile(
//   resource: any,
//   profileId: string
// ) {
//   const response = (
//     await FhirApi({
//       url: `${resource.resourceType}/$validate?profile=${IG_FHIR_SERVER}/StructureDefinition/${profileId}`,
//       method: "POST",
//       body: resource,
//     })
//   ).data;
//   // logger.info(response);
//   let issues = response?.issue;
//   let errors: Array<any> = issues.map((issue: any) => {
//     return issue.severity;
//   });
//   if (errors.indexOf("error") > -1) {
//     return { status: "error", response };
//   }
//   return { status: "success", response };
// }

// function extractSubjectIdentifier(fhirResource) {
//   let subjectUpi = "";

//   if (fhirResource && fhirResource.subject && fhirResource.subject.identifier) {
//     subjectUpi =
//       fhirResource.subject.identifier.value || fhirResource.subject.display;
//   }

//   return subjectUpi;
// }
