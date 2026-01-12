"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
const UtilsioContext = createContext(null);
function normalizeBaseUrl(url) {
    return url.replace(/\/+$/, "");
}
export function UtilsioProvider({ children, utilsioBaseUrl, appId, getAuthHeadersAction, parentOrigin }) {
    const baseUrl = useMemo(() => normalizeBaseUrl(utilsioBaseUrl), [utilsioBaseUrl]);
    // Fix hydration mismatch: only get window.location.origin on client
    const [targetOrigin, setTargetOrigin] = useState(parentOrigin || "*");
    const iframeRef = useRef(null);
    const [embedReady, setEmbedReady] = useState(false);
    const [user, setUser] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    const [currentSubscription, setCurrentSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Set targetOrigin on client mount
    useEffect(() => {
        if (!parentOrigin && typeof window !== "undefined") {
            setTargetOrigin(window.location.origin);
        }
    }, [parentOrigin]);
    const subscriptionUrl = useMemo(() => `${baseUrl}/api/v1/subscription?appId=${encodeURIComponent(appId)}`, [baseUrl, appId]);
    const embedUrl = useMemo(() => `${baseUrl}/embed?parentOrigin=${encodeURIComponent(targetOrigin)}`, [baseUrl, targetOrigin]);
    useEffect(() => {
        setError(null);
        setLoading(true);
    }, [baseUrl, appId]);
    useEffect(() => {
        const handler = (event) => {
            if (event.origin !== new URL(baseUrl).origin)
                return;
            const data = event.data;
            if (!data || typeof data.type !== "string")
                return;
            if (data.type === "utilsio:embed:ready") {
                setEmbedReady(true);
                setLoading(false);
                return;
            }
            if (data.type === "utilsio:embed:auth") {
                setUser(data.user ?? null);
                setDeviceId(data.deviceId ?? null);
                setLoading(false);
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, [baseUrl]);
    useEffect(() => {
        if (!iframeRef.current)
            return;
        const win = iframeRef.current.contentWindow;
        if (!win)
            return;
        win.postMessage({ type: "utilsio:embed:request" }, new URL(baseUrl).origin);
    }, [embedReady, baseUrl]);
    const getSubscription = useCallback(async () => {
        setError(null);
        if (!deviceId) {
            setCurrentSubscription(null);
            return null;
        }
        const { signature, timestamp } = await getAuthHeadersAction({ deviceId });
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
        const payload = (await res.json());
        if (!payload.success)
            throw new Error(payload.error || "Failed to get subscription");
        setCurrentSubscription(payload.subscription);
        return payload.subscription;
    }, [deviceId, getAuthHeadersAction, subscriptionUrl]);
    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            await getSubscription();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoading(false);
        }
    }, [getSubscription]);
    const cancelSubscription = useCallback(async (subscriptionIds) => {
        setError(null);
        if (!deviceId || !user) {
            throw new Error("User must be authenticated to cancel subscription");
        }
        // Sort subscription IDs for signature consistency (required by backend)
        const additionalData = [...subscriptionIds].sort().join(",");
        const { signature, timestamp } = await getAuthHeadersAction({ deviceId, additionalData });
        const res = await fetch(`${baseUrl}/api/v1/subscription`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "X-utilsio-Signature": signature,
                "X-utilsio-Timestamp": timestamp,
            },
            credentials: "include",
            body: JSON.stringify({
                userId: user.id,
                deviceId,
                appId,
                subscriptionIds,
            }),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `Failed to cancel subscription (${res.status})`);
        }
        const payload = (await res.json());
        if (!payload.success) {
            throw new Error(payload.error || "Failed to cancel subscription");
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
    const redirectToConfirm = useCallback(async (params) => {
        if (!deviceId || !user) {
            throw new Error("User must be authenticated to subscribe");
        }
        // Get signature for the subscription request with amountPerDay as additional data
        const { signature, timestamp } = await getAuthHeadersAction({
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
        if (params.appLogo)
            url.searchParams.set("appLogo", params.appLogo);
        if (params.appUrl)
            url.searchParams.set("appUrl", params.appUrl);
        url.searchParams.set("nextSuccess", params.nextSuccess);
        url.searchParams.set("nextCancelled", params.nextCancelled);
        window.location.href = url.toString();
    }, [baseUrl, deviceId, user, getAuthHeadersAction]);
    const value = useMemo(() => ({
        loading,
        user,
        deviceId,
        currentSubscription,
        error,
        refresh,
        cancelSubscription,
        redirectToConfirm,
    }), [loading, user, deviceId, currentSubscription, error, refresh, cancelSubscription, redirectToConfirm]);
    return (_jsxs(UtilsioContext.Provider, { value: value, children: [_jsx("iframe", { ref: (el) => {
                    iframeRef.current = el;
                }, src: embedUrl, title: "utilsio", style: { position: "absolute", width: 0, height: 0, border: 0, opacity: 0 }, tabIndex: -1, "aria-hidden": "true" }), children] }));
}
export function useUtilsioContext() {
    const ctx = React.useContext(UtilsioContext);
    if (!ctx)
        throw new Error("useUtilsio must be used within a UtilsioProvider");
    return ctx;
}
