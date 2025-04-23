import utils from 'openhim-mediator-utils';
import shrMediatorConfig from '../config/shrMediatorConfig.json';
import carepayBeneficiary from '../config/beneficiaryMediator.json'
import turnioMediatorConfig from '../config/turnioNotificationsMediator.json';
import customRegistrationConfig from '../config/customRegistrationMediators.json'
import clientRegistryConfig from '../config/clientRegistryMediator.json'
import heyformsConfig from '../config/heyformsMediator.json'
import babyEnrollmentConfig from '../config/babyEnrolment.json'
import fhirBaseConfig from '../config/fhirBaseMediator.json'
import momCareSocialConfig from '../config/momcareSocialMediator.json'



import { Agent } from 'https';
import * as crypto from 'crypto';

// ✅ Do this if using TYPESCRIPT
import { RequestInfo, RequestInit } from 'node-fetch';

// mediators to be registered
const mediators = [
    shrMediatorConfig,
    carepayBeneficiary,
    turnioMediatorConfig,
    customRegistrationConfig,
    // utilsConfig,
    clientRegistryConfig,
    heyformsConfig,
    babyEnrollmentConfig,
    fhirBaseConfig,
    momCareSocialConfig
];

const fetch = (url: RequestInfo, init?: RequestInit) =>
    import('node-fetch').then(({ default: fetch }) => fetch(url, init));

const openhimApiUrl = process.env.OPENHIM_API_URL;
const openhimUsername = process.env.OPENHIM_USERNAME;
const openhimPassword = process.env.OPENHIM_PASSWORD;

const openhimConfig = {
    username: openhimUsername,
    password: openhimPassword,
    apiURL: openhimApiUrl,
    trustSelfSigned: true
}

utils.authenticate(openhimConfig, (e: any) => {
    console.log(e ? e : "✅ OpenHIM authenticated successfully");
    importMediators();
    installChannels();
})

export const importMediators = () => {
    try {
        mediators.map((mediator: any) => {
            utils.registerMediator(openhimConfig, mediator, (e: any) => {
                console.log(e ? e : "");
            });
        })
    } catch (error) {
        console.log(error);
    }
    return;
}

export const getOpenHIMToken = async () => {
    try {
        let token = await utils.genAuthHeaders(openhimConfig);
        return token
    } catch (error) {
        console.log(error);
        return { error, status: "error" }
    }
}

export const installChannels = async () => {
    let headers = await getOpenHIMToken();
    mediators.map(async (mediator: any) => {
        let response = await (await fetch(`${openhimApiUrl}/channels`, {
            headers: { ...headers, "Content-Type": "application/json" }, method: 'POST', body: JSON.stringify(mediator.defaultChannelConfig[0]), agent: new Agent({
                rejectUnauthorized: false
            })
        })).text();
        console.log(response);
    })
}

export const shrApiHost = process.env.SHR_BASE_URL;
export const crApiHost = process.env.CLIENT_REGISTRY_BASE_URL;

// a fetch wrapper for HAPI FHIR server.
export const FhirApi = async (params: any) => {
    let _defaultHeaders = { "Content-Type": 'application/json' }
    if (!params.method) {
        params.method = 'GET';
    }
    try {
        let response = await fetch(String(`${shrApiHost}${params.url}`), {
            headers: _defaultHeaders,
            method: params.method ? String(params.method) : 'GET',
            ...(params.method !== 'GET' && params.method !== 'DELETE') && { body: String(params.data) }
        });
        let responseJSON = await response.json();
        let res = {
            status: "success",
            statusText: response.statusText,
            data: responseJSON
        };
        return res;
    } catch (error) {
        console.error(error);
        let res = {
            statusText: "FHIRFetch: server error",
            status: "error",
            data: error
        };
        console.error(error);
        return res;
    }
}


export const OperationOutcome = (text: string) => {
    return {
        "resourceType": "OperationOutcome",
        "id": "exception",
        "issue": [{
            "severity": "error",
            "code": "exception",
            "details": { text }
        }]
    }
}

// a fetch wrapper for HAPI FHIR server.
export const ClientRegistryApi = async (params: any) => {
    let _defaultHeaders = { "Content-Type": 'application/json' }
    if (!params.method) {
        params.method = 'GET';
    }
    try {
        let response = await fetch(String(`${crApiHost}${params.url}`), {
            headers: _defaultHeaders,
            method: params.method ? String(params.method) : 'GET',
            ...(params.method !== 'GET' && params.method !== 'DELETE') && { body: String(params.data) }
        });
        let responseJSON = await response.json();
        let res = {
            status: "success",
            statusText: response.statusText,
            data: responseJSON
        };
        return res;
    } catch (error) {
        console.error(error);
        let res = {
            statusText: "FHIRFetch: server error",
            status: "error",
            data: error
        };
        console.error(error);
        return res;
    }
}

export const createClient = async (name: string, password: string) => {
    let headers = await getOpenHIMToken();
    const clientPassword = password
    const clientPasswordDetails: any = await genClientPassword(clientPassword)
    let response = await (await fetch(`${openhimApiUrl}/clients`, {
        headers: { ...headers, "Content-Type": "application/json" }, method: 'POST',
        body: JSON.stringify({
            passwordAlgorithm: "sha512",
            passwordHash: clientPasswordDetails.passwordHash,
            passwordSalt: clientPasswordDetails.passwordSalt,
            clientID: name, name: name, "roles": [
                "*"
            ],
        }), agent: new Agent({
            rejectUnauthorized: false
        })
    })).text();
    console.log("create client: ", response)
    return response
}



const genClientPassword = async (password: string) => {
    return new Promise((resolve) => {
        const passwordSalt = crypto.randomBytes(16);
        // create passhash
        let shasum = crypto.createHash('sha512');
        shasum.update(password);
        shasum.update(passwordSalt.toString('hex'));
        const passwordHash = shasum.digest('hex');
        resolve({
            "passwordSalt": passwordSalt.toString('hex'),
            "passwordHash": passwordHash
        })
    })
}


export let createFHIRPatientSubscription = async () => {
    try {
        let FHIR_SUBSCRIPTION_ID = process.env['FHIR_PATIENT_SUBSCRIPTION_ID'];
        let FHIR_SUBSCRIPTION_CALLBACK_URL = process.env['FHIR_SUBSCRIPTION_CALLBACK_URL'];
        let response = await (await FhirApi({
            url: `/Subscription/${FHIR_SUBSCRIPTION_ID}`,
            method: "PUT", data: JSON.stringify({
                resourceType: 'Subscription',
                id: FHIR_SUBSCRIPTION_ID,
                status: "active",
                criteria: 'Patient?',
                channel: {
                    type: 'rest-hook',
                    endpoint: FHIR_SUBSCRIPTION_CALLBACK_URL,
                    payload: 'application/json'
                },
                extension: [
                    {
                        url: "http://hapifhir.io/fhir/StructureDefinition/subscription-delivery-retry-count",
                        valueInteger: 1
                    },
                    {
                        url: "http://hapifhir.io/fhir/StructureDefinition/subscription-retry",
                        valueBoolean: false
                    }
                ]
            })
        })).data
        if (response.resourceType != "OperationOutcome") {
            console.log(`FHIR Patient Subscription ID: ${FHIR_SUBSCRIPTION_ID}`);
            return;
        }
        console.log(`Failed to create FHIR Subscription: \n${response}`);
    } catch (error) {
        console.log(error);
    }
}

export let createEncounterSubscription = async () => {
    try {
        let FHIR_SUBSCRIPTION_ID = process.env['FHIR_ENCOUNTER_SUBSCRIPTION_ID'];
        let FHIR_SUBSCRIPTION_CALLBACK_URL = process.env['FHIR_ENCOUNTER_CALLBACK_URL'];
        let response = await (await FhirApi({
            url: `/Subscription/${FHIR_SUBSCRIPTION_ID}`,
            method: "PUT", data: JSON.stringify({
                resourceType: 'Subscription',
                id: FHIR_SUBSCRIPTION_ID,
                status: "active",
                criteria: 'Encounter?status=finished',
                channel: {
                    type: 'rest-hook',
                    endpoint: FHIR_SUBSCRIPTION_CALLBACK_URL,
                    payload: 'application/json'
                },
                extension: [
                    {
                        url: "http://hapifhir.io/fhir/StructureDefinition/subscription-delivery-retry-count",
                        valueInteger: 1
                    }, {
                        url: "http://hapifhir.io/fhir/StructureDefinition/subscription-retry",
                        valueBoolean: false
                    }
                ]
            })
        })).data
        if (response.resourceType != "OperationOutcome") {
            console.log(`FHIR Encounter Subscription ID: ${FHIR_SUBSCRIPTION_ID}`);
            return;
        }
        console.log(`Failed to create FHIR Subscription: \n${response}`);
    } catch (error) {
        console.log(error);
    }
}


export let createQuestionnaireResponseSubscription = async () => {
    try {
        let FHIR_SUBSCRIPTION_ID = process.env['FHIR_QRESPONSE_SUBSCRIPTION_ID'];
        let FHIR_SUBSCRIPTION_CALLBACK_URL = process.env['FHIR_QRESPONSE_CALLBACK_URL'];
        let response = await (await FhirApi({
            url: `/Subscription/${FHIR_SUBSCRIPTION_ID}`,
            method: "PUT", data: JSON.stringify({
                resourceType: 'Subscription',
                id: FHIR_SUBSCRIPTION_ID,
                status: "active",
                criteria: 'QuestionnaireResponse?',
                channel: {
                    type: 'rest-hook',
                    endpoint: FHIR_SUBSCRIPTION_CALLBACK_URL,
                    payload: 'application/json'
                },
                extension: [
                    {
                        url: "http://hapifhir.io/fhir/StructureDefinition/subscription-delivery-retry-count",
                        valueInteger: 1
                    },
                    {
                        url: "http://hapifhir.io/fhir/StructureDefinition/subscription-retry",
                        valueBoolean: false
                    }
                ]
            })
        })).data
        if (response.resourceType != "OperationOutcome") {
            console.log(`FHIR QR Subscription ID: ${FHIR_SUBSCRIPTION_ID}`);
            return;
        }
        console.log(`Failed to create FHIR Subscription: \n${response}`);
    } catch (error) {
        console.log(error);
    }
}


// these functions will be run anytime during runtime


// createFHIRPatientSubscription();
createEncounterSubscription();
createQuestionnaireResponseSubscription();
createFHIRPatientSubscription();
createClient(process.env['OPENHIM_CLIENT_ID'] || '', process.env['OPENHIM_CLIENT_PASSWORD'] || '');


type MessageTypes = "ENROLMENT_CONFIRMATION" | "ENROLMENT_REJECTION" | "SURVEY_FOLLOW_UP"

export const sendTurnNotification = async (data: any, type: MessageTypes) => {
    try {
        let patient = await (await ClientRegistryApi({ url: `/${data?.subject?.reference}` })).data;

        let phoneNumber = patient?.telecom?.[0]?.value ?? data?.telecom?.[1]?.value;

        // call mediator
        let TURN_MEDIATOR_ENDPOINT = process.env['TURN_MEDIATOR_ENDPOINT'] ?? "";
        let OPENHIM_CLIENT_ID = process.env['OPENHIM_CLIENT_ID'] ?? "";
        let OPENHIM_CLIENT_PASSWORD = process.env['OPENHIM_CLIENT_PASSWORD'] ?? "";
        let response = await (await fetch(TURN_MEDIATOR_ENDPOINT, {
            body: JSON.stringify({ phone: phoneNumber, type }),
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

const OPENHIM_DEV_URL = process.env.OPENHIM_DEV_URL ?? '';
const OPENHIM_DEV_CLIENT = process.env.OPENHIM_DEV_CLIENT ?? '';
const OPENHIM_DEV_CLIENT_PASSWORD = process.env.OPENHIM_DEV_CLIENT_PASSWORD ?? '';

export const redirectToDev = async (path: string, data: any, method: string = "POST") => {
    try {
        console.log(data);
        console.log(OPENHIM_DEV_URL + path);
        let response = await fetch(OPENHIM_DEV_URL + path, {
            method: method, ...(method !== "GET") && { body: JSON.stringify(data) },
            headers: {
                "Authorization": 'Basic ' + Buffer.from(OPENHIM_DEV_CLIENT + ':' + OPENHIM_DEV_CLIENT_PASSWORD).toString('base64'),
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        })
        let statusCode = response.status;
        let responseData = await response.json();
        // if (statusCode > 201 && statusCode !== 404){
        //     return responseData;
        // }
        return responseData;
    } catch (error) {
        return {
            resourceType: "OperationOutcome",
            id: "exception",
            issue: [{
                severity: "error",
                code: "exception",
                details: {
                    text: `${JSON.stringify(error)}`
                }
            }]
        }
    }

}


export let sendSlackAlert = async (message: any) => {
    try {
        const SLACK_CHANNEL_URL = process.env.SLACK_CHANNEL_URL ?? '';
        let response = await (await fetch(SLACK_CHANNEL_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(
                { text: `⚠️🚨 IOL mediator error: ${message}` }
            )
        })).json();
        return response;
    } catch (error) {
        return { error }
    }
}