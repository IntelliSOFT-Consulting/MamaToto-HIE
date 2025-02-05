

export const FhirIdentifier = (system: string, code: string, display: string, value: string) => {
    return { type: { coding: [{ system, code, display }] }, value }
}