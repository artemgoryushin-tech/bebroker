import "./style.css";
import "./event.css";
import { formService, type SubmitData } from "./api/form.service";
import { trackLeadSubmit } from "./analytics";
import { getCookieByName } from "./utils/cookie";

const EVENT_BOT_URL =
	(import.meta.env.NEXT_PUBLIC_EVENT_BOT_URL as string | undefined) ||
	(import.meta.env.VITE_EVENT_BOT_URL as string | undefined) ||
	"https://t.me/YOUR_BOT_USERNAME?start=bebroker_event";

const body = document.body;
const header = document.querySelector<HTMLElement>("[data-event-header]");
const hero = document.querySelector<HTMLElement>(".event-hero");
const heroCursorCard = document.querySelector<HTMLElement>("[data-hero-cursor-card]");
const menuDialog = document.getElementById("event-menu") as HTMLElement | null;
const applyPanel = document.getElementById("event-apply") as HTMLElement | null;
const menuOpen = document.querySelector<HTMLButtonElement>("[data-menu-open]");
const menuClose = document.querySelector<HTMLButtonElement>("[data-menu-close]");
const menuLinks = document.querySelectorAll<HTMLAnchorElement>("[data-menu-link]");
const applyOpenButtons = document.querySelectorAll<HTMLButtonElement>("[data-apply-open]");
const applyClose = document.querySelector<HTMLButtonElement>("[data-apply-close]");
const applyForm = document.querySelector<HTMLFormElement>(".event-apply-form");
const applyFormStatus = document.querySelector<HTMLElement>("[data-event-form-status]");
const themeToggle = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
const ctaLinks = document.querySelectorAll<HTMLAnchorElement>("[data-event-cta]");
const revealElements = document.querySelectorAll<HTMLElement>(".reveal");
const parallaxItems = document.querySelectorAll<HTMLElement>("[data-parallax]");
const inlineVideos = document.querySelectorAll<HTMLVideoElement>(".event-moment-media video");
const formatList = document.querySelector<HTMLElement>(".event-format-list");
const formatStage = document.querySelector<HTMLElement>("[data-format-stage]");
const formatItems = document.querySelectorAll<HTMLButtonElement>("[data-format-item]");
const formatPreviews = document.querySelectorAll<HTMLVideoElement>("[data-format-preview]");
const formatPreviewFrame = document.querySelector<HTMLElement>(".event-format-preview");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canUseCursorPreview = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

let lastFocused: HTMLElement | null = null;

body.classList.add("is-enhanced");

ctaLinks.forEach((link) => {
	link.href = EVENT_BOT_URL;
	link.target = "_blank";
	link.rel = "noopener noreferrer";
});

const getStoredAttribution = (): Record<string, string> => {
	const data: Record<string, string> = {};
	const urlParams = new URLSearchParams(window.location.search);
	const keys = ["utm_campaign", "utm_medium", "utm_source", "utm_content", "utm_term"];

	urlParams.forEach((value, key) => {
		localStorage.setItem(`param__${key}`, value);
	});

	keys.forEach((key) => {
		const value = localStorage.getItem(`param__${key}`);
		if (value) data[key] = value;
	});

	const currentUrl = new URL(window.location.href);
	data.lang_by_browser = window.navigator.language || "en";
	data.lang = document.documentElement.lang || window.navigator.language || "en";
	data.landing_url = `${currentUrl.host}${currentUrl.pathname}`;
	data.referrer = document.referrer || data.landing_url;

	const roistatId = getCookieByName("roistat_visit", document.cookie);
	if (roistatId) data.roistat_id = roistatId;

	return data;
};

const getFormValue = (formData: FormData, key: string): string => String(formData.get(key) || "").trim();

const setApplyFormStatus = (message: string, type: "idle" | "success" | "error" = "idle"): void => {
	if (!applyFormStatus) return;
	applyFormStatus.textContent = message;
	applyFormStatus.classList.toggle("is-success", type === "success");
	applyFormStatus.classList.toggle("is-error", type === "error");
};

const buildEventLeadPayload = (form: HTMLFormElement): SubmitData => {
	const formData = new FormData(form);
	const about = getFormValue(formData, "about");
	const whyJoin = getFormValue(formData, "why_join");
	const experience = getFormValue(formData, "experience");
	const role = getFormValue(formData, "role");

	return {
		first_name: getFormValue(formData, "name"),
		phone: getFormValue(formData, "whatsapp"),
		tg: getFormValue(formData, "telegram"),
		company_name: role,
		short_bio: [
			`Tell about yourself:\n${about}`,
			`Why would you like to join:\n${whyJoin}`,
			`Experience in trading / affiliate market:\n${experience}`,
		].join("\n\n"),
		event_role: role,
		event_about: about,
		event_why_join: whyJoin,
		event_experience: experience,
		lead_source: "bebroker_event",
		source: "bebroker_event",
		terms_agree: "1",
		...getStoredAttribution(),
	};
};

applyForm?.addEventListener("submit", async (event) => {
	event.preventDefault();

	if (!applyForm.reportValidity()) return;

	const submitButton = applyForm.querySelector<HTMLButtonElement>('[type="submit"]');
	const payload = buildEventLeadPayload(applyForm);
	const telegramWindow = window.open("about:blank", "_blank");
	if (telegramWindow) telegramWindow.opener = null;

	try {
		applyForm.classList.add("is-loading");
		submitButton?.setAttribute("disabled", "disabled");
		setApplyFormStatus("Sending application...");

		const response = await formService.submit(payload);

		if ("errors" in response) {
			telegramWindow?.close();
			setApplyFormStatus("Please check the form fields and try again.", "error");
			return;
		}

		setApplyFormStatus("Application sent. Opening Telegram...", "success");
		trackLeadSubmit("event-form", {
			utm_source: payload.utm_source,
			utm_campaign: payload.utm_campaign,
			role: payload.event_role,
		});
		applyForm.reset();

		if (telegramWindow) {
			telegramWindow.location.href = EVENT_BOT_URL;
		} else {
			window.location.href = EVENT_BOT_URL;
		}
	} catch (error) {
		telegramWindow?.close();
		console.error("Event form submit error", error);
		setApplyFormStatus("Could not send the application. Please try again.", "error");
	} finally {
		applyForm.classList.remove("is-loading");
		submitButton?.removeAttribute("disabled");
	}
});

const getFocusable = (root: HTMLElement): HTMLElement[] =>
	Array.from(
		root.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => element.getClientRects().length > 0 || element === document.activeElement);

const focusFirst = (root: HTMLElement): void => {
	const first = getFocusable(root)[0];
	first?.focus();
};

const setAriaState = (element: HTMLElement | null, isOpen: boolean): void => {
	element?.setAttribute("aria-hidden", String(!isOpen));
};

const openMenu = (): void => {
	if (!menuDialog) return;
	lastFocused = document.activeElement as HTMLElement | null;
	menuDialog.classList.add("is-open");
	body.classList.add("is-menu-open");
	setAriaState(menuDialog, true);
	menuOpen?.setAttribute("aria-expanded", "true");
	window.setTimeout(() => focusFirst(menuDialog), 80);
};

const closeMenu = (): void => {
	if (!menuDialog) return;
	menuDialog.classList.remove("is-open");
	body.classList.remove("is-menu-open");
	setAriaState(menuDialog, false);
	menuOpen?.setAttribute("aria-expanded", "false");
	lastFocused?.focus();
};

const openApply = (): void => {
	if (!applyPanel) return;
	lastFocused = document.activeElement as HTMLElement | null;
	applyPanel.classList.add("is-open");
	body.classList.add("is-apply-open");
	setAriaState(applyPanel, true);
	window.setTimeout(() => focusFirst(applyPanel), 80);
};

const closeApply = (): void => {
	if (!applyPanel) return;
	applyPanel.classList.remove("is-open");
	body.classList.remove("is-apply-open");
	setAriaState(applyPanel, false);
	lastFocused?.focus();
};

menuOpen?.addEventListener("click", openMenu);
menuClose?.addEventListener("click", closeMenu);

menuLinks.forEach((link) => {
	link.addEventListener("click", () => {
		closeMenu();
	});
});

applyOpenButtons.forEach((button) => {
	button.addEventListener("click", () => {
		closeMenu();
		openApply();
	});
});

applyClose?.addEventListener("click", closeApply);

applyPanel?.addEventListener("click", (event) => {
	if (event.target === applyPanel) closeApply();
});

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape") {
		closeMenu();
		closeApply();
		return;
	}

	if (event.key !== "Tab") return;

	const activeDialog = menuDialog?.classList.contains("is-open")
		? menuDialog
		: applyPanel?.classList.contains("is-open")
			? applyPanel
			: null;

	if (!activeDialog) return;

	const focusable = getFocusable(activeDialog);
	if (!focusable.length) return;

	const first = focusable[0];
	const last = focusable[focusable.length - 1];

	if (event.shiftKey && document.activeElement === first) {
		event.preventDefault();
		last.focus();
	}

	if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first.focus();
	}
});

const setTheme = (theme: "dark" | "light"): void => {
	body.dataset.theme = theme;
	const label = themeToggle?.querySelector("span");
	if (label) label.textContent = `${theme === "dark" ? "Dark" : "Light"} mode`;
};

setTheme("light");

themeToggle?.addEventListener("click", () => {
	setTheme(body.dataset.theme === "light" ? "dark" : "light");
});

const setActiveFormat = (target: string): void => {
	const previousActive = document.querySelector<HTMLVideoElement>(".event-format-preview video.is-active");
	const activeIndex = Array.from(formatItems).findIndex((item) => item.dataset.formatTarget === target);

	formatStage?.classList.add("is-preview-active");

	formatItems.forEach((item) => {
		item.classList.toggle("is-active", item.dataset.formatTarget === target);
	});

	if (formatPreviewFrame) {
		const rotate = [-1.2, 0.8, -0.6, 1.1, -0.9][Math.max(0, activeIndex)] ?? -1.2;
		const activeItem = Array.from(formatItems).find((item) => item.dataset.formatTarget === target);
		if (formatStage && activeItem && window.matchMedia("(min-width: 1121px)").matches) {
			const stageRect = formatStage.getBoundingClientRect();
			const itemRect = activeItem.getBoundingClientRect();
			const itemCenter = itemRect.top + itemRect.height * 0.5 - stageRect.top;
			const boundedCenter = Math.min(Math.max(itemCenter, 150), stageRect.height - 150);
			formatPreviewFrame.style.setProperty("--format-preview-y", `${boundedCenter.toFixed(1)}px`);
		}
		formatPreviewFrame.style.setProperty("--format-preview-rotate", `${rotate}deg`);
		formatPreviewFrame.style.setProperty("--format-preview-scale", "1.025");
		window.setTimeout(() => {
			formatPreviewFrame.style.setProperty("--format-preview-scale", "1");
		}, 180);
	}

	formatPreviews.forEach((video) => {
		const isActive = video.dataset.formatPreview === target;
		video.classList.toggle("is-active", isActive);
		video.classList.remove("is-revealing");

		if (!isActive) {
			video.pause();
			video.currentTime = 0;
			return;
		}

		if (previousActive !== video) {
			window.requestAnimationFrame(() => {
				video.classList.add("is-revealing");
				window.setTimeout(() => video.classList.remove("is-revealing"), 380);
			});
		}

		video.play().catch(() => {
			// Muted previews can retry on the next user interaction if autoplay is blocked.
		});
	});
};

formatItems.forEach((item) => {
	const activateItem = (): void => {
		const target = item.dataset.formatTarget;
		if (!target) return;
		formatList?.classList.add("is-interacting");
		setActiveFormat(target);
	};

	item.addEventListener("pointerenter", activateItem);
	item.addEventListener("focus", activateItem);
	item.addEventListener("click", activateItem);
});

formatList?.addEventListener("pointerleave", () => {
	formatList.classList.remove("is-interacting");
	formatStage?.classList.remove("is-preview-active");
	formatItems.forEach((item) => item.classList.remove("is-active"));
});

formatList?.addEventListener("focusout", () => {
	window.setTimeout(() => {
		if (formatList.contains(document.activeElement)) return;
		formatList.classList.remove("is-interacting");
		formatStage?.classList.remove("is-preview-active");
		formatItems.forEach((item) => item.classList.remove("is-active"));
	}, 0);
});

const updateHeader = (): void => {
	header?.classList.toggle("is-scrolled", window.scrollY > 18);
};

const hideHeroCursorCard = (): void => {
	hero?.classList.remove("is-cursor-active");
};

if (hero && heroCursorCard && canUseCursorPreview && !reduceMotion) {
	let animationFrame = 0;
	let currentX = 0;
	let currentY = 0;
	let targetX = 0;
	let targetY = 0;
	let isReady = false;

	const clamp = (value: number, min: number, max: number): number =>
		Math.min(Math.max(value, min), max);

	const setCardPosition = (): void => {
		currentX += (targetX - currentX) * 0.085;
		currentY += (targetY - currentY) * 0.085;
		hero.style.setProperty("--cursor-card-x", `${currentX.toFixed(2)}px`);
		hero.style.setProperty("--cursor-card-y", `${currentY.toFixed(2)}px`);

		if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
			animationFrame = window.requestAnimationFrame(setCardPosition);
		} else {
			animationFrame = 0;
		}
	};

	const requestCardAnimation = (): void => {
		if (!animationFrame) {
			animationFrame = window.requestAnimationFrame(setCardPosition);
		}
	};

	const updateHeroCursorCard = (event: PointerEvent): void => {
		const rect = hero.getBoundingClientRect();
		const cardRect = heroCursorCard.getBoundingClientRect();
		const cardHalfWidth = cardRect.width * 0.5;
		const cardHalfHeight = cardRect.height * 0.5;
		const isInside =
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom;

		if (!isInside) {
			hideHeroCursorCard();
			return;
		}

		const pointerX = event.clientX - rect.left;
		const pointerY = event.clientY - rect.top;
		const lazyOffsetX = Math.min(190, window.innerWidth * 0.14);
		const lazyOffsetY = Math.max(34, window.innerHeight * 0.045);

		targetX = clamp(pointerX + lazyOffsetX, cardHalfWidth + 16, rect.width - cardHalfWidth - 16);
		targetY = clamp(pointerY + lazyOffsetY, cardHalfHeight + 16, rect.height - cardHalfHeight - 16);

		if (!isReady) {
			currentX = targetX - 42;
			currentY = targetY - 26;
			hero.style.setProperty("--cursor-card-x", `${currentX.toFixed(2)}px`);
			hero.style.setProperty("--cursor-card-y", `${currentY.toFixed(2)}px`);
			isReady = true;
		}

		hero.classList.add("is-cursor-active");
		requestCardAnimation();
	};

	hero.addEventListener("pointermove", updateHeroCursorCard, { passive: true });
	hero.addEventListener("pointerenter", updateHeroCursorCard, { passive: true });
	hero.addEventListener("pointerleave", () => {
		hideHeroCursorCard();
		isReady = false;
	});
}

const updateParallax = (): void => {
	if (reduceMotion) return;

	const viewportHeight = window.innerHeight || 1;

	parallaxItems.forEach((item) => {
		const rect = item.getBoundingClientRect();
		const centerProgress = (rect.top + rect.height * 0.5 - viewportHeight * 0.5) / viewportHeight;
		const clamped = Math.max(-1, Math.min(1, centerProgress));
		item.style.setProperty("--parallax-y", `${Math.round(clamped * -22)}px`);
	});
};

const onScroll = (): void => {
	updateHeader();
	updateParallax();
	if (hero) {
		const rect = hero.getBoundingClientRect();
		if (rect.bottom < 0 || rect.top > window.innerHeight) hideHeroCursorCard();
	}
};

updateHeader();
updateParallax();
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", updateParallax);

if ("IntersectionObserver" in window) {
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				entry.target.classList.add("visible");
				observer.unobserve(entry.target);
			});
		},
		{ rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
	);

	revealElements.forEach((element) => observer.observe(element));

	const videoObserver = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				const video = entry.target as HTMLVideoElement;
				if (entry.isIntersecting) {
					video.play().catch(() => {
						// Autoplay can be blocked by the browser; muted inline videos will retry on the next intersection.
					});
				} else {
					video.pause();
				}
			});
		},
		{ threshold: 0.2 },
	);

	inlineVideos.forEach((video) => videoObserver.observe(video));
} else {
	revealElements.forEach((element) => element.classList.add("visible"));
}
