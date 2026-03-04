import { formService, type SubmitErrorValidation } from "./form.service";

function addValidationInputErrors(errors: SubmitErrorValidation["errors"], form: HTMLFormElement): void {
	Object.entries(errors).forEach(([key, message]) => {
		const input = form.querySelector<HTMLInputElement>(`[name="${key}"]`);
		const inputWrap = input?.closest<HTMLDivElement>(".field");

		if (inputWrap) {
			inputWrap.classList.add("_error");

			const errorMessage = inputWrap.querySelector<HTMLSpanElement>("span[data-error-message]");
			if (errorMessage) errorMessage.textContent = message[0];
		}
	});
}

export function removeValidationInputErrors(element: HTMLElement) {
	element.querySelectorAll<HTMLInputElement>("[name]").forEach((input) => {
		const inputWrap = input.closest<HTMLDivElement>(".field._error");
		if (inputWrap) inputWrap.classList.remove("_error");
	});
}

export function createFormClassNameMod(element: HTMLElement) {
	return {
		error(force: boolean = true) {
			element.classList.toggle("_error", force);
		},
		success(force: boolean = true) {
			element.classList.toggle("_success", force);
		},
		loading(force: boolean = true) {
			element.classList.toggle("_loading", force);
		},
		removeAll() {
			this.error(false);
			this.success(false);
			this.loading(false);
		},
	};
}

export function createDisableForm(element: HTMLElement) {
	const submitButton = element.querySelector<HTMLButtonElement>('[type="submit"]');

	return {
		disable() {
			submitButton?.setAttribute("disabled", "disabled");
		},
		enable() {
			submitButton?.removeAttribute("disabled");
		},
	};
}

export interface SubmitFormCallback {
	response?: () => void;
	validationErrors?: () => void;
	success?: () => void;
	error?: () => void;
	finally?: () => void;
}

export async function submitForm(event: SubmitEvent, callback: SubmitFormCallback = {}): Promise<void> {
	event.preventDefault();
	const form = event.target as HTMLFormElement;

	try {
		const formData = new FormData(form);
		const data = Object.fromEntries(formData.entries());
		const response = await formService.submit(data);

		callback.response?.();

		if ("errors" in response) {
			callback.validationErrors?.();
			removeValidationInputErrors(form);
			addValidationInputErrors(response.errors, form);
		}

		if ("success" in response) {
			removeValidationInputErrors(form);
			callback.success?.();
		}
	} catch (error) {
		console.error("Error", error);
		callback.error?.();
	} finally {
		callback.finally?.();
	}
}
