import { api } from "./client";

export interface SubmitSuccess {
	success: true;
}

export interface SubmitErrorValidation {
	message: string;
	errors: Record<string, string[]>;
}

export interface SubmitData {
	[k: string]: FormDataEntryValue;
}

export type SubmitResponse = SubmitSuccess | SubmitErrorValidation;

export const formService = {
	submit: (data: SubmitData, signal?: AbortSignal) => {
		return api.post<SubmitResponse, SubmitData>("/api/notPopup", data, signal);
	},
};
