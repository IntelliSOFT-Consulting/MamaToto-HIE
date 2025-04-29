import { FhirApi } from "./utils";
import path from 'path';
import fs from 'fs';

const CAREPAY_BASE_URL = process.env['CAREPAY_BASE_URL'];
const CAREPAY_CATEGORY_ID = process.env['CAREPAY_CATEGORY_ID'];
const CAREPAY_USERNAME = process.env['CAREPAY_USERNAME'];
const CAREPAY_PASSWORD = process.env['CAREPAY_PASSWORD'];
const CAREPAY_POLICY_ID = process.env['CAREPAY_POLICY_ID'];
const MOMCARE_SOCIAL_POLICY_ID = process.env['MOMCARE_SOCIAL_POLICY_ID'];
const MOMCARE_SOCIAL_CATEGORY_ID = process.env['MOMCARE_SOCIAL_CATEGORY_ID'];



const getCurrentDate = () => new Date().toISOString().slice(0, 10);

export const getCarepayBeneficiaryById = async (idNumber: any) => {
  try {
    let authToken = await getCarepayAuthToken();
    let accessToken = authToken['accessToken'];
    let cpUrl = `${CAREPAY_BASE_URL}/beneficiary/policies/endorsements?identificationNumber=${idNumber}`;
    let beneficiaries = await (await fetch(cpUrl, {
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` }
    })).json();
    return beneficiaries?.[0];
  } catch (error) {
    return null;
  }
}

export const postToBeneficiaryEndorsementMediator = async (beneficiary: any) => {
  try {
    let CAREPAY_MEDIATOR_ENDPOINT = process.env['CAREPAY_MEDIATOR_ENDPOINT'] ?? "";
    let OPENHIM_CLIENT_ID = process.env['OPENHIM_CLIENT_ID'] ?? "";
    let OPENHIM_CLIENT_PASSWORD = process.env['OPENHIM_CLIENT_PASSWORD'] ?? "";
    let response = await (await fetch(CAREPAY_MEDIATOR_ENDPOINT, {
      body: JSON.stringify(beneficiary),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": 'Basic ' + Buffer.from(OPENHIM_CLIENT_ID + ':' + OPENHIM_CLIENT_PASSWORD).toString('base64')
      }
    })).json();
    return response;
  } catch (error) {
    return { error }
  }
}

export enum MomcareSchemes {
  MOMCARE = "momcare",
  MOMCARE_SOCIAL = "momcare-social"
}

export const postBeneficiaryEndorsement = async (data: any, dependent: boolean = false, scheme: MomcareSchemes = MomcareSchemes.MOMCARE) => {
  try {

    /** Authentication */
    let cpLoginUrl = `${CAREPAY_BASE_URL}/usermanagement/login`;
    let authToken = await (await (fetch(cpLoginUrl, {
      method: "POST", body: JSON.stringify({
        "username": CAREPAY_USERNAME,
        "password": CAREPAY_PASSWORD
      }),
      headers: { "Content-Type": "application/json" }
    }))).json();
    // console.log(`authtoken: ${JSON.stringify(authToken)}`)
    let cpEndpointUrl = `${CAREPAY_BASE_URL}/beneficiary/policies/${scheme === "momcare-social" ? MOMCARE_SOCIAL_POLICY_ID : CAREPAY_POLICY_ID}/enrollments/beneficiary`
    // console.log(cpEndpointUrl);
    let accessToken = authToken['accessToken'];
    let carepayBeneficiaryPayload
    if(dependent){
      let primaryIdNumber = data?.identifier?.[0]?.value;
      carepayBeneficiaryPayload = await fhirPatientToCarepayDependent(data, primaryIdNumber);

    }else{
      carepayBeneficiaryPayload = await fhirPatientToCarepayBeneficiary(data, scheme);
    }
    console.log(carepayBeneficiaryPayload);
    let response = await (await (fetch(cpEndpointUrl, { method: "POST",
      body: JSON.stringify(carepayBeneficiaryPayload),
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` }
    }))).json();

    return response;
  } catch (error) {
    return { error }
  }
}

export const processIdentifiers = (identifiers: any) => {
  try {
    let ids: any = {};
    for (let id of identifiers) {
      let idType = id?.type?.coding[0].code;
      let idSystem = id?.type?.coding[0].system;
      ids[idType] = id?.value;
    }
    return ids;
  } catch (error) {
    return {}
  }
}

export const fhirPatientToCarepayBeneficiary = async (patient: any, scheme: MomcareSchemes = MomcareSchemes.MOMCARE) => {
  try {
    let gender = String(patient.gender).toUpperCase();
    let _date = String(patient.birthDate).split("-");
    let n: any = {};

    let phoneNumbers = patient.telecom ?? [];
    phoneNumbers?.map((numb: any) => {
      if (Object.keys(numb).indexOf('value') > -1) {
        n[numb.system] = numb.value;
      }
    })

    let maritalStatus = patient?.maritalStatus?.coding?.[0]?.code;

    return {
      "title": gender == "MALE" ? "MR" : "MRS",
      "firstName": patient.name[0].given[0] ?? "",
      ...(patient.name[0].given[1] ? true : false) && { "middleName": patient.name[0].given[1] },
      ...(patient.name[0].family ? true : false) && { "lastName": patient.name[0].family },
      "gender": gender,
      "dateOfBirth": patient?.birthDate,
      // "dateOfBirth":  `${_date[0]}-${_date[2].padStart(2, '0')}-${_date[1].padStart(2, '0')}`,
      "maritalStatus": maritalStatus === "M" ? "MARRIED" : "SINGLE",
      // "nationality": "KE",
      "identification": [
        {
          "type": `${patient?.identifier?.[0]?.type?.coding?.[0]?.code}` === "PASSPORT" ? "PASSPORT" : "NATIONAL_ID",
          "number": `${patient?.identifier?.[0]?.value}`
        }
      ],
      // "acceptTermsAndCondition": true,
      // "occupation": "EMPLOYED",
      // "email": `${(patient.name[0].given[0]).replace(" ", "-") ?? ""}@gmail.com`,
      "residentialCountryCode": "string",
      // "height": 140,
      // "weight": -1.7976931348623157e+308,
      // "bmi": -1.7976931348623157e+308,
      "categoryId": `${scheme === MomcareSchemes.MOMCARE_SOCIAL.valueOf() ? MOMCARE_SOCIAL_CATEGORY_ID : CAREPAY_CATEGORY_ID}`,
      "policyId": `${scheme === MomcareSchemes.MOMCARE_SOCIAL.valueOf() ? MOMCARE_SOCIAL_POLICY_ID : CAREPAY_POLICY_ID }`,
      "relationship": "PRIMARY",
      "phoneNumber": n?.phone ?? n?.mobile,
      // "dateOfEnrollment": "2014-02-07",
      "startDate": new Date().toISOString(),
      // "endDate": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
      // "medicalApplicationForm": {
      //   "mafConditions": [
      //     {
      //       "question": "Diabetes, gout, or any disorder of thyroid, or other glands.",
      //       "answer": true,
      //       "answerDetails": "My diabetes was diagnosed 2 years ago, and I have been under controlled treatment ever since.",
      //       "premiumImpact": 0.1,
      //       "medicalCodes": [
      //         {
      //           "codingStandard": "ICD-10-CM",
      //           "code": "A15-A19"
      //         }
      //       ]
      //     }
      //   ],
      //   "signatureDate": getCurrentDate()
      // }
    }
  }
  catch (error) {
    console.log(error);
    return null;
  }
}

export const fhirPatientToCarepayDependent = async (patient: any, primaryIdNumber: string, scheme: string = "momcare") => {
  try {
 
    let gender = String(patient.gender).toUpperCase();
    let _date = String(patient.birthDate).split("-");
    let n: any = {};
    return {
      // "title": gender == "MALE" ? "MR" : "MRS",
      "firstName": patient.name[0].given[0] ?? "",
      ...(patient.name[0].given[1] ? true : false) && { "middleName": patient.name[0].given[1] },
      ...(patient.name[0].family ? true : false) && { "lastName": patient.name[0].family },
      "gender": gender,
      "dateOfBirth": patient?.birthDate,
      "residentialCountryCode": "string",
      "categoryId": `${scheme === "momcare-social" ? MOMCARE_SOCIAL_CATEGORY_ID : CAREPAY_CATEGORY_ID}`,
      "policyId": `${scheme === "momcare-social" ? MOMCARE_SOCIAL_POLICY_ID : CAREPAY_POLICY_ID }`,
      "relationship": "CHILD",
      "familyIdentifier":primaryIdNumber,
      maritalStatus:"SINGLE",
      // "dateOfEnrollment": "2014-02-07",
      "startDate": new Date().toISOString(),
      policyholderId: primaryIdNumber
    }
  }
  catch (error) {
    console.log(error);
    return null;
  }
}

export const buildEncounter = async (visit: any) => {
  try {
    let patient = await (await FhirApi({ url: `/Patient?identifier=${visit.patientRef}` })).data;
    // console.log(patient);
    if (!(patient?.total) || !(patient?.entry)) {
      console.log(`Patient ${visit.patientRef} not found`)
      return { "error": "Patient not found" }
    }
    let status = String(visit.status).toLowerCase();
    let encounterPayload = {
      resourceType: "Encounter",
      id: visit.code,
      status: (status === "closed") ? "finished" : status,
      subject: {
        reference: `Patient/${patient?.entry[0].resource?.id}`
      },
      period: {
        start: visit.date,
        end: visit.endDate
      },
      extension: [
        {
          url: "https://mamatoto.dev/StructureDefinition/patient-benefit",
          valueReference: {
            reference: `Coverage/${visit.benefitRef}`
          }
        },
        {
          url: "https://mamatoto.dev/StructureDefinition/patient-plan",
          valueReference: {
            reference: `Coverage/${visit.planRef}`
          }
        },
      ],
      serviceProvider: {
        reference: `Organization/${visit.providerRef}`
      }
    }
    let encounter = await FhirApi({ url: `/Encounter/${encounterPayload.id}`, method: "PUT", data: JSON.stringify(encounterPayload) });
    // console.log(encounter);
    return encounter;
  } catch (error) {
    return { error };
  }
}
const getLastYearISOString = () => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setFullYear(now.getFullYear() - 2);
  return yesterday.toISOString();
};

export const fetchVisits = async (status: string | null = null) => {
  try {

    let cpUrl = `${CAREPAY_BASE_URL}/visit/visits?since=${getLastYearISOString()}`;
    let authToken = await getCarepayAuthToken();
    let accessToken = authToken['accessToken'];
    let visits = await (await fetch(cpUrl, {
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` }
    })).json();
    console.log(`Fetched ${visits.length} visits`);
    for (let visit of visits) {
      let encounter = await buildEncounter(visit);
      // console.log(encounter);
      // return encounter
    }
    // Save the current timestamp to the file
    // fs.writeFileSync(LAST_RUN_FILE, new Date().toISOString());
  } catch (error) {
    return { error }
  }
}


export const fetchApprovedEndorsements = async () => {
  try {
    let authToken = await getCarepayAuthToken();
    let accessToken = authToken['accessToken'];
    let cpUrl = `${CAREPAY_BASE_URL}/beneficiary/beneficiaries?policyIds=${CAREPAY_POLICY_ID}`;
    let beneficiaries = await (await fetch(cpUrl, {
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` }
    })).json();
    console.log(`found ${beneficiaries.length} approved beneficiaries`);
    for (let i of beneficiaries) {
      let patient = await (await FhirApi({ url: `/Patient?identifier=${i.membershipNumber}` })).data;
      if (patient?.entry) {
        console.log(`found ${i.membershipNumber} in the SHR`);
        let patientResource = patient?.entry[0]?.resource;
        if (!JSON.stringify(patientResource.identifier).includes("CAREPAY-PATIENT-REF")) {
          let carepayPatientRef = { type: { coding: [{ system: "http://carepay.com", code: "CAREPAY-PATIENT-REF", display: "Carepay Patient Ref" }] }, value: i.id }
          patientResource.identifier.push(carepayPatientRef);
          // update patient;
          // console.log(patientResource);
          let updated = await (await FhirApi({
            url: `/Patient/${patient?.entry[0]?.resource?.id}`, method: "PUT",
            data: JSON.stringify({ ...patientResource })
          })).data;
          console.log(`...updated Patient/${updated.id} with ${i.membershipNumber} -> ${i.id}`);
        } else {
          console.log(`...skipping ${i.membershipNumber} with ref already`);
        }
      }
    }
    return beneficiaries;

  } catch (error) {
    return false;
  }
}


export const getCarepayAuthToken = async () => {
  try {
    let cpLoginUrl = `${CAREPAY_BASE_URL}/usermanagement/login`;
    let accessToken = await (await (fetch(cpLoginUrl, {
      method: "POST", body: JSON.stringify({
        "username": CAREPAY_USERNAME,
        "password": CAREPAY_PASSWORD
      }),
      headers: { "Content-Type": "application/json" }
    }))).json();
    return accessToken;
  } catch (error) {
    return null;
  }
}
