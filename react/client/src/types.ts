export type UtilsioUser = {
	id: string;
	email?: string;
	phone?: string;
	user_metadata: Record<string, unknown>;
	created_at: string;
};

export type UtilsioSubscription = {
	id: string;
	amountPerDay: string;
	createdAt: string;
	cancelledAt: string | null;
	isActive: boolean;
};

export type UtilsioState = {
	loading: boolean;
	user: UtilsioUser | null;
	deviceId: string | null;
	currentSubscription: UtilsioSubscription | null;
	error: string | null;
};

export type UtilsioClient = UtilsioState & {
	refresh: () => Promise<void>;
	cancelSubscription: (subscriptionIds: string[], appUrl?: string) => Promise<void>;
	redirectToConfirm: (params: {
		appId: string;
		appName: string;
		amountPerDay: string;
		appLogo?: string;
		appUrl?: string;
		nextSuccess: string;
		nextCancelled: string;
	}) => void;
};
