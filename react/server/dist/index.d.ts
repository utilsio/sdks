export type UtilsioScryptParams = {
    N: number;
    r: number;
    p: number;
    keyLen: number;
};
export type DeriveKeyInput = {
    appSecret: string;
    salt: string;
};
export type SignRequestInput = {
    deviceId: string;
    appId: string;
    timestamp: number | string;
    additionalData?: string;
};
export declare const DEFAULT_SCRYPT_PARAMS: UtilsioScryptParams;
/**
 * Derives an app hash using scrypt key derivation
 * Exported for use in server-side authentication workflows
 * Used to create deterministic hashes from app secrets for secure verification
 */
export declare function deriveAppHashHex({ appSecret, salt }: DeriveKeyInput): string;
export declare function buildSignatureMessage({ deviceId, appId, timestamp, additionalData }: SignRequestInput): string;
/**
 * Signs a request with HMAC-SHA256
 * Exported for use in client-server authentication workflows
 * Creates cryptographic signatures for request verification
 */
export declare function signRequest({ appHashHex, deviceId, appId, timestamp, additionalData }: {
    appHashHex: string;
} & SignRequestInput): string;
/**
 * Gets current time as Unix timestamp in seconds
 * Exported for use in request signing and timestamp validation
 * Provides consistent time reference across requests
 */
export declare function nowUnixSeconds(): number;
