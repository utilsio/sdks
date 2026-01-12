import React from "react";
import type { UtilsioClient } from "./types";
export type UtilsioProviderProps = {
    children: React.ReactNode;
    utilsioBaseUrl: string;
    appId: string;
    getAuthHeadersAction: (input: {
        deviceId: string;
        additionalData?: string;
    }) => Promise<{
        signature: string;
        timestamp: string;
    }>;
    parentOrigin?: string;
};
export declare function UtilsioProvider({ children, utilsioBaseUrl, appId, getAuthHeadersAction, parentOrigin }: UtilsioProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function useUtilsioContext(): UtilsioClient;
