import crypto from "crypto";

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

export const DEFAULT_SCRYPT_PARAMS: UtilsioScryptParams = {
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
export function deriveAppHashHex({appSecret, salt, params}: DeriveKeyInput): string {
	if (!appSecret) throw new Error("appSecret is required");
	if (!salt) throw new Error("salt is required");

	const merged = {...DEFAULT_SCRYPT_PARAMS, ...(params || {})};

	// Convert hex salt string to Buffer (salt is stored as hex in database)
	const saltBuffer = Buffer.from(salt, "hex");

	const derived = crypto.scryptSync(appSecret, saltBuffer, merged.keyLen, {
		N: merged.N,
		r: merged.r,
		p: merged.p,
	});

	return derived.toString("hex");
}

export function buildSignatureMessage({deviceId, appId, timestamp, additionalData}: SignRequestInput): string {
	if (!deviceId) throw new Error("deviceId is required");
	if (!appId) throw new Error("appId is required");
	if (timestamp === undefined || timestamp === null || timestamp === "") throw new Error("timestamp is required");

	const ts = String(timestamp);
	return `${deviceId}-${appId}-${ts}${additionalData ? `-${additionalData}` : ""}`;
}

/**
 * Signs a request with HMAC-SHA256
 * Exported for use in client-server authentication workflows
 * Creates cryptographic signatures for request verification
 */
export function signRequest({appHashHex, deviceId, appId, timestamp, additionalData}: {appHashHex: string} & SignRequestInput): string {
	if (!appHashHex) throw new Error("appHashHex is required");
	const message = buildSignatureMessage({deviceId, appId, timestamp, additionalData});
	const hmac = crypto.createHmac("sha256", appHashHex);
	hmac.update(message);
	return hmac.digest("hex");
}

/**
 * Gets current time as Unix timestamp in seconds
 * Exported for use in request signing and timestamp validation
 * Provides consistent time reference across requests
 */
export function nowUnixSeconds(): number {
	return Math.floor(Date.now() / 1000);
}
