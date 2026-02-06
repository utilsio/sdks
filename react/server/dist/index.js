import crypto from "crypto";
export const DEFAULT_SCRYPT_PARAMS = {
    N: 1 << 14,
    r: 8,
    p: 1,
    keyLen: 32,
};
/**
 * Derives an app hash using scrypt key derivation
 * Exported for use in server-side authentication workflows
 * Used to create deterministic hashes from app secrets for secure verification
 */
export function deriveAppHashHex({ appSecret, salt }) {
    if (!appSecret)
        throw new Error("appSecret is required");
    if (!salt)
        throw new Error("salt is required");
    // Convert hex salt string to Buffer (salt is stored as hex in database)
    const saltBuffer = Buffer.from(salt, "hex");
    const derived = crypto.scryptSync(appSecret, saltBuffer, DEFAULT_SCRYPT_PARAMS.keyLen, {
        N: DEFAULT_SCRYPT_PARAMS.N,
        r: DEFAULT_SCRYPT_PARAMS.r,
        p: DEFAULT_SCRYPT_PARAMS.p,
    });
    return derived.toString("hex");
}
export function buildSignatureMessage({ deviceId, appId, timestamp, additionalData }) {
    if (!deviceId)
        throw new Error("deviceId is required");
    if (!appId)
        throw new Error("appId is required");
    if (timestamp === undefined || timestamp === null || timestamp === "")
        throw new Error("timestamp is required");
    const ts = String(timestamp);
    return `${deviceId}-${appId}-${ts}${additionalData ? `-${additionalData}` : ""}`;
}
/**
 * Signs a request with HMAC-SHA256
 * Exported for use in client-server authentication workflows
 * Creates cryptographic signatures for request verification
 */
export function signRequest({ appHashHex, deviceId, appId, timestamp, additionalData }) {
    if (!appHashHex)
        throw new Error("appHashHex is required");
    const message = buildSignatureMessage({ deviceId, appId, timestamp, additionalData });
    const hmac = crypto.createHmac("sha256", appHashHex);
    hmac.update(message);
    return hmac.digest("hex");
}
/**
 * Gets current time as Unix timestamp in seconds
 * Exported for use in request signing and timestamp validation
 * Provides consistent time reference across requests
 */
export function nowUnixSeconds() {
    return Math.floor(Date.now() / 1000);
}
