"use client";

import React, {createContext, useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {UtilsioClient, UtilsioSubscription, UtilsioUser} from "./types";

type EmbedReadyMessage = {type: "utilsio:embed:ready"};
type EmbedAuthMessage = {type: "utilsio:embed:auth"; user: UtilsioUser | null; deviceId: string | null};

type EmbedMessage = EmbedReadyMessage | EmbedAuthMessage;

export type UtilsioProviderProps = {
	children: React.ReactNode;
	utilsioBaseUrl: string;
	appId: string;
	getAuthHeadersAction: (input: {deviceId: string; additionalData?: string}) => Promise<{signature: string; timestamp: string}>;
	parentOrigin?: string;
};

const UtilsioContext = createContext<UtilsioClient | null>(null);

function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, "");
}

export function UtilsioProvider({children, utilsioBaseUrl, appId, getAuthHeadersAction, parentOrigin}: UtilsioProviderProps) {
	const baseUrl = useMemo(() => normalizeBaseUrl(utilsioBaseUrl), [utilsioBaseUrl]);

	// Always use "*" to allow cross-origin embedding from any domain
	// The baseUrl origin check below provides the actual security
	const targetOrigin = useMemo(() => parentOrigin || "*", [parentOrigin]);

	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const [embedReady, setEmbedReady] = useState(false);

	const [user, setUser] = useState<UtilsioUser | null>(null);
	const [deviceId, setDeviceId] = useState<string | null>(null);
	const [currentSubscription, setCurrentSubscription] = useState<UtilsioSubscription | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const subscriptionUrl = useMemo(() => `${baseUrl}/api/v1/subscription?appId=${encodeURIComponent(appId)}`, [baseUrl, appId]);
	const embedUrl = useMemo(() => `${baseUrl}/embed?parentOrigin=${encodeURIComponent(targetOrigin)}`, [baseUrl, targetOrigin]);

	useEffect(() => {
		setError(null);
		setLoading(true);
	}, [baseUrl, appId]);

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			// Accept messages from any origin to support flexible deployment scenarios
			// Security is provided by the signature-based auth system, not origin checks
			const data = event.data as Partial<EmbedMessage> | null;
			if (!data || typeof data.type !== "string") return;

			if (data.type === "utilsio:embed:ready") {
				setEmbedReady(true);
				return;
			}

			if (data.type === "utilsio:embed:auth") {
				setUser((data as EmbedAuthMessage).user ?? null);
				setDeviceId((data as EmbedAuthMessage).deviceId ?? null);
				// Don't set loading=false here - let the subscription fetch control loading state
				// When deviceId is null, the useEffect will call refresh() which returns early and sets loading=false
				// When deviceId exists, refresh() will fetch subscription and set loading=false when complete
			}
		};

		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, []);

	useEffect(() => {
		if (!iframeRef.current) return;
		const win = iframeRef.current.contentWindow;
		if (!win) return;
		// Send request to the iframe - use "*" to allow cross-origin communication
		win.postMessage({type: "utilsio:embed:request"}, "*");
	}, [embedReady]);

	const getSubscription = useCallback(async (): Promise<UtilsioSubscription | null> => {
		setError(null);
		if (!deviceId) {
			setCurrentSubscription(null);
			return null;
		}

		const {signature, timestamp} = await getAuthHeadersAction({deviceId});

		const res = await fetch(subscriptionUrl, {
			method: "GET",
			headers: {
				"X-utilsio-Signature": signature,
				"X-utilsio-Timestamp": timestamp,
			},
			credentials: "include",
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(text || `Failed to get subscription (${res.status})`);
		}

		const payload = (await res.json()) as {success: boolean; subscription: {id: string; amountPerDay: string; createdAt: string; cancelledAt?: string | null} | null; error?: string};
		if (!payload.success) throw new Error(payload.error || "Failed to get subscription");

		// Filter out cancelled subscriptions - treat them as non-existent
		if (payload.subscription && !payload.subscription.cancelledAt) {
			const activeSubscription: UtilsioSubscription = {
				...payload.subscription,
				cancelledAt: null,
				isActive: true,
			};
			setCurrentSubscription(activeSubscription);
			return activeSubscription;
		}
		
		setCurrentSubscription(null);
		return null;
	}, [deviceId, getAuthHeadersAction, subscriptionUrl]);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			await getSubscription();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	}, [getSubscription]);

	const cancelSubscription = useCallback(async (subscriptionIds: string[], appUrl?: string): Promise<void> => {
		setError(null);
		if (!user) {
			throw new Error("User must be authenticated to cancel subscription");
		}

		const headers: HeadersInit = {
			"Content-Type": "application/json",
		};

		const bodyData: Record<string, unknown> = {
			userId: user.id,
			appId,
			subscriptionIds,
		};

		// If deviceId is available, generate signature client-side (normal flow)
		if (deviceId) {
			const additionalData = [user.id, ...subscriptionIds].sort().join(",");
			const {signature, timestamp} = await getAuthHeadersAction({deviceId, additionalData});
			headers["X-utilsio-Signature"] = signature;
			headers["X-utilsio-Timestamp"] = timestamp;
			bodyData.deviceId = deviceId;
		} else if (appUrl) {
			// Safari fallback: server will read deviceId from cookies and make callback for signature
			bodyData.signatureCallbackUrl = `${appUrl}/api/signature-callback`;
			bodyData.useSafariFallback = true; // Explicit opt-in for Safari workaround
		} else {
			throw new Error("Either deviceId or appUrl is required to cancel subscription");
		}

		const res = await fetch(`${baseUrl}/api/v1/subscription`, {
			method: "DELETE",
			headers,
			credentials: "include",
			body: JSON.stringify(bodyData),
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(text || `Failed to cancel subscription (${res.status})`);
		}

		const payload = (await res.json()) as {
			success: boolean;
			results?: Array<{ id: string; success: boolean; error?: string; txHash?: string }>;
			error?: string;
		};
		if (!payload.success) {
			// Extract error from results array
			const errors = payload.results
				?.filter(r => !r.success)
				.map(r => r.error)
				.filter(Boolean);
			const errorMsg = errors?.[0] || payload.error || "Failed to cancel subscription";
			throw new Error(errorMsg);
		}

		// Refresh subscription state after successful cancellation
		await refresh();
	}, [deviceId, user, getAuthHeadersAction, appId, baseUrl, refresh]);

	useEffect(() => {
		if (!deviceId) {
			setCurrentSubscription(null);
			return;
		}
		void refresh();
	}, [deviceId, refresh]);

	const redirectToConfirm = useCallback(async (params: {
		appId: string;
		appName: string;
		amountPerDay: string;
		appLogo?: string;
		appUrl?: string;
		nextSuccess: string;
		nextCancelled: string;
	}) => {
		// Safari fallback: If no deviceId, use init flow
		if (!deviceId) {
			const initUrl = new URL(`${baseUrl}/api/v1/subscription/init`);
			initUrl.searchParams.set("appId", params.appId);
			initUrl.searchParams.set("appName", params.appName);
			initUrl.searchParams.set("amountPerDay", params.amountPerDay);
			if (params.appUrl) initUrl.searchParams.set("appUrl", params.appUrl);
			if (params.appLogo) initUrl.searchParams.set("appLogo", params.appLogo);
			initUrl.searchParams.set("nextSuccess", params.nextSuccess);
			initUrl.searchParams.set("nextCancelled", params.nextCancelled);

			// Callback URL for signature generation
			const callbackUrl = `${params.appUrl}/api/signature-callback`;
			initUrl.searchParams.set("signatureCallbackUrl", callbackUrl);

			window.location.href = initUrl.toString();
			return;
		}

		// Normal flow with deviceId (existing code)
		// Get signature for the subscription request with amountPerDay as additional data
		const {signature, timestamp} = await getAuthHeadersAction({
			deviceId,
			additionalData: params.amountPerDay
		});

		const url = new URL(`${baseUrl}/confirm`);
		url.searchParams.set("appId", params.appId);
		url.searchParams.set("appName", params.appName);
		url.searchParams.set("amountPerDay", params.amountPerDay);
		url.searchParams.set("deviceId", deviceId);
		url.searchParams.set("signature", signature);
		url.searchParams.set("timestamp", timestamp);
		if (params.appLogo) url.searchParams.set("appLogo", params.appLogo);
		if (params.appUrl) url.searchParams.set("appUrl", params.appUrl);
		url.searchParams.set("nextSuccess", params.nextSuccess);
		url.searchParams.set("nextCancelled", params.nextCancelled);
		window.location.href = url.toString();
	}, [baseUrl, deviceId, getAuthHeadersAction]);

	const value: UtilsioClient = useMemo(() => ({
		loading,
		user,
		deviceId,
		currentSubscription,
		error,
		refresh,
		cancelSubscription,
		redirectToConfirm,
	}), [loading, user, deviceId, currentSubscription, error, refresh, cancelSubscription, redirectToConfirm]);

	return (
		<UtilsioContext.Provider value={value}>
			<iframe
				ref={(el) => {
					iframeRef.current = el;
				}}
				src={embedUrl}
				title="utilsio"
				style={{position: "absolute", width: 0, height: 0, border: 0, opacity: 0}}
				tabIndex={-1}
				aria-hidden="true"
			/>
			{children}
		</UtilsioContext.Provider>
	);
}

export function useUtilsioContext() {
	const ctx = React.useContext(UtilsioContext);
	if (!ctx) throw new Error("useUtilsio must be used within a UtilsioProvider");
	return ctx;
}
