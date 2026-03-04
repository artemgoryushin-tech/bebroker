async function handleResponse<T>(response: Response): Promise<T> {
	if (response.ok) return response.json();
	if (response.status === 422) return response.json();

	const message = await response.text();
	throw new Error(message);
}

export const api = {
	post: <T, B>(endpoint: string, body: B, signal?: AbortSignal): Promise<T> =>
		fetch(`${import.meta.env.VITE_FORMS_API_URL}${endpoint}`, {
			signal,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				"X-Requested-With": "XMLHttpRequest",
			},
			body: JSON.stringify(body),
		}).then(handleResponse<T>),
};
