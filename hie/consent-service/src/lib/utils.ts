
// ✅ Do this if using TYPESCRIPT
import { STATUS_CODES } from 'http';
import { RequestInfo, RequestInit } from 'node-fetch';

const fetch = (url: RequestInfo, init?: RequestInit) =>
    import('node-fetch').then(({ default: fetch }) => fetch(url, init));


export let apiHost = process.env.FHIR_BASE_URL;
console.log("HAPI FHIR: ", apiHost);


// a fetch wrapper for HAPI FHIR server.
export const FhirApi = async (url: string, params: any | null = {}) => {
    let _defaultHeaders = { "Content-Type": 'application/json', Cache: 'no-cache' };
    if (!params.method) {
        params.method = 'GET';
    }
    try {
        let response = await fetch(String(`${apiHost}${url}`), {
            headers: _defaultHeaders,
            method: params.method ? String(params.method) : 'GET',
            ...(params.method !== 'GET' && params.method !== 'DELETE') && { body: JSON.stringify(params.data) }
        });
        let responseJSON = await response.json();
        let res = {
            status: "success",
            statusText: response.statusText,
            data: responseJSON,
            statusCode: response.status
        };
        return res;
    } catch (error) {
        console.error(error);
        let res = {
            statusText: "FHIR Server fetch: server error",
            status: "error",
            data: error,
            statusCode: 500,
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