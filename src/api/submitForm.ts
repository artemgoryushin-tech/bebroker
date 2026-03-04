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

export function removeValidationInputErrors(form: HTMLFormElement) {
	form.querySelectorAll<HTMLInputElement>("[name]").forEach((input) => {
		const inputWrap = input.closest<HTMLDivElement>(".field._error");
		if (inputWrap) inputWrap.classList.remove("_error");
	});
}

export function createFormClassNameMod(form: HTMLFormElement) {
	return {
		error(force: boolean = true) {
			form.classList.toggle("_error", force);
		},
		success(force: boolean = true) {
			form.classList.toggle("_success", force);
		},
		loading(force: boolean = true) {
			form.classList.toggle("_loading", force);
		},
		removeAll() {
			this.error(false);
			this.success(false);
			this.loading(false);
		},
	};
}

export function createDisableForm(form: HTMLFormElement) {
	const submitButton = form.querySelector<HTMLButtonElement>('[type="submit"]');

	return {
		disable() {
			submitButton?.setAttribute("disabled", "disabled");
		},
		enable() {
			submitButton?.removeAttribute("disabled");
		},
	};
}

export async function submitForm(event: SubmitEvent): Promise<void> {
	const form = event.target as HTMLFormElement;
	const formClassNameMod = createFormClassNameMod(form);
	const disableManager = createDisableForm(form);

	try {
		formClassNameMod.loading(true);
		disableManager.disable();

		const formData = new FormData(form);
		const data = Object.fromEntries(formData.entries());
		const response = await formService.submit(data);

		formClassNameMod.loading(false);

		console.log(response);

		if ("errors" in response) {
			removeValidationInputErrors(form);
			addValidationInputErrors(response.errors, form);
			formClassNameMod.removeAll();
			disableManager.enable();
		}

		if ("success" in response) {
			formClassNameMod.success(true);
			removeValidationInputErrors(form);
			form.reset();
		}
	} catch (error) {
		formClassNameMod.error(true);
		console.error("Error", error);
	}
}
