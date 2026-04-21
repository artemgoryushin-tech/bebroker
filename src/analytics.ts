/**
 * Analytics helpers that push events into Google Tag Manager's `dataLayer`.
 *
 * GTM container (`GTM-THX5RW6B`) listens for these events and routes them to
 * downstream tags (Meta Pixel "Lead", GA4 `generate_lead`, TikTok, LinkedIn, etc.).
 *
 * Keeping vendor-specific logic inside GTM (instead of this codebase) means:
 *   - New pixels can be added without a code deploy
 *   - Consent Mode can gate every vendor in one place
 *   - Event IDs can be mirrored by Meta Conversions API (server-side) later
 */

declare global {
	interface Window {
		dataLayer?: Record<string, unknown>[];
	}
}

export type LeadLocation = "modal-form" | "conversion-form" | "resell-form" | (string & {});

/**
 * Push a successful lead submission to `dataLayer`.
 * GTM maps this to Meta Pixel `Lead` (and any other pixels you configure).
 *
 * @param formId Identifier of the form that was submitted (used in GTM triggers)
 * @param extra  Optional extra payload (e.g. page_type, plan, utm_source)
 */
export function trackLeadSubmit(formId: LeadLocation, extra: Record<string, unknown> = {}): void {
	window.dataLayer = window.dataLayer ?? [];

	// `event_id` lets Meta deduplicate the browser Pixel event against a
	// future server-side Conversions API event carrying the same id.
	const eventId = `lead_${formId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

	window.dataLayer.push({
		event: "lead_submit",
		event_id: eventId,
		form_id: formId,
		page_location: window.location.href,
		page_path: window.location.pathname,
		page_language: document.documentElement.lang || "en",
		...extra,
	});
}
