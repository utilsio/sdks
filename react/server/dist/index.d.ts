export type UtilsioScryptParams = {
    N: number;
    r: number;
    p: number;
    keyLen: number;
};
export type DeriveKeyInput = {
    appSecret: string;
    salt: string;
    params?: Partial<UtilsioScryptParams>;
};
export type SignRequestInput = {
    deviceId: string;
    appId: string;
    timestamp: number | string;
    additionalData?: string;
};
export declare const DEFAULT_SCRYPT_PARAMS: UtilsioScryptParams;
export declare function deriveAppHashHex({ appSecret, salt, params }: DeriveKeyInput): string;
export declare function buildSignatureMessage({ deviceId, appId, timestamp, additionalData }: SignRequestInput): string;
export declare function signRequest({ appHashHex, deviceId, appId, timestamp, additionalData }: {
    appHashHex: string;
} & SignRequestInput): string;
export declare function nowUnixSeconds(): number;
