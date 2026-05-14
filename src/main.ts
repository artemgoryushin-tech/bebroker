import "./style.css";
import {
	createDisableForm,
	createFormClassNameMod,
	removeValidationInputErrors,
	submitForm,
	type SubmitFormCallback,
} from "./api/submitForm";
import { trackLeadSubmit } from "./analytics";
import {getCookieByName} from "./utils/cookie.ts";

// Типизация DOM-элементов с использованием Generic-типов
const elements = document.querySelectorAll<HTMLElement>(".reveal");
const topbar = document.querySelector<HTMLElement>(".topbar");
const hero = document.querySelector<HTMLElement>(".hero");
const heroTiles = document.querySelectorAll<HTMLElement>(".hero__tile[data-depth]");
const openModalButtons = document.querySelectorAll<HTMLElement>("[data-open-modal]");
const modal = document.getElementById("request-modal") as HTMLElement | null;
const modalCloseButtons = modal ? modal.querySelectorAll<HTMLElement>("[data-close-modal]") : [];
const modalForm = document.querySelector<HTMLFormElement>("[data-form='modal-form']");
const modalFormWrap = modal?.querySelector<HTMLElement>("[data-modal-form-wrap]");
const conversionForm = document.querySelector<HTMLFormElement>("[data-form='conversion-form']");
const heroFloating = document.querySelector<HTMLElement>(".hero__floating");

const reduceMotion: boolean = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let previouslyFocused: HTMLElement | null = null;

type PhoneCountry = {
	iso: string;
	flag: string;
	name: string;
	dial: string;
};

function setupPhonePickers(): void {
	const pickers = document.querySelectorAll<HTMLElement>("[data-phone-picker]");
	if (!pickers.length) return;

	const countries: PhoneCountry[] = [
		{ iso: "GB", flag: "🇬🇧", name: "United Kingdom", dial: "+44" },
		{ iso: "US", flag: "🇺🇸", name: "United States", dial: "+1" },
		{ iso: "DE", flag: "🇩🇪", name: "Germany", dial: "+49" },
		{ iso: "ES", flag: "🇪🇸", name: "Spain", dial: "+34" },
		{ iso: "FR", flag: "🇫🇷", name: "France", dial: "+33" },
		{ iso: "BR", flag: "🇧🇷", name: "Brazil", dial: "+55" },
		{ iso: "PT", flag: "🇵🇹", name: "Portugal", dial: "+351" },
		{ iso: "TH", flag: "🇹🇭", name: "Thailand", dial: "+66" },
		{ iso: "ID", flag: "🇮🇩", name: "Indonesia", dial: "+62" },
		{ iso: "MY", flag: "🇲🇾", name: "Malaysia", dial: "+60" },
		{ iso: "PH", flag: "🇵🇭", name: "Philippines", dial: "+63" },
		{ iso: "AE", flag: "🇦🇪", name: "United Arab Emirates", dial: "+971" },
		{ iso: "CA", flag: "🇨🇦", name: "Canada", dial: "+1" },
		{ iso: "AU", flag: "🇦🇺", name: "Australia", dial: "+61" },
		{ iso: "MX", flag: "🇲🇽", name: "Mexico", dial: "+52" },
		{ iso: "AR", flag: "🇦🇷", name: "Argentina", dial: "+54" },
		{ iso: "CL", flag: "🇨🇱", name: "Chile", dial: "+56" },
		{ iso: "CO", flag: "🇨🇴", name: "Colombia", dial: "+57" },
		{ iso: "IN", flag: "🇮🇳", name: "India", dial: "+91" },
		{ iso: "NG", flag: "🇳🇬", name: "Nigeria", dial: "+234" },
		{ iso: "ZA", flag: "🇿🇦", name: "South Africa", dial: "+27" },
		{ iso: "TR", flag: "🇹🇷", name: "Turkey", dial: "+90" },
		{ iso: "RU", flag: "🇷🇺", name: "Russia", dial: "+7" },
		{ iso: "KZ", flag: "🇰🇿", name: "Kazakhstan", dial: "+7" },
	];

	const pathLanguageMap: Record<string, string> = {
		br: "BR",
		pt: "BR",
		es: "ES",
		th: "TH",
		id: "ID",
		ms: "MY",
		tl: "PH",
		en: "US",
	};

	const normalizeIso = (value: string | undefined): string => {
		const iso = String(value || "").toUpperCase();
		return iso === "UK" ? "GB" : iso;
	};

	const countryByIso = (iso: string | undefined): PhoneCountry | undefined =>
		countries.find((country) => country.iso === normalizeIso(iso));

	const countryByDial = (dial: string): PhoneCountry | undefined =>
		countries.find((country) => country.dial === dial);

	const getInitialCountry = (): PhoneCountry => {
		const browserLocale = (navigator.languages && navigator.languages[0]) || navigator.language || "";
		const browserRegion = browserLocale.split("-")[1];
		const pathLangMatch = window.location.pathname.match(/^\/([a-z]{2})(\/|$)/i);
		const pathLang = pathLangMatch ? pathLangMatch[1].toLowerCase() : "";

		return (
			countryByIso(browserRegion) ||
			countryByIso(pathLanguageMap[pathLang]) ||
			countryByDial("+1") ||
			countries[0]
		);
	};

	const syncPhoneValue = (picker: HTMLElement): void => {
		const input = picker.querySelector<HTMLInputElement>("[data-phone-input]");
		const fullInput = picker.querySelector<HTMLInputElement>("[data-phone-full]");
		const countryInput = picker.querySelector<HTMLInputElement>("[data-phone-country]");
		const selected = countryByIso(picker.dataset.phoneIso) || getInitialCountry();
		const localValue = input ? input.value.trim() : "";

		if (fullInput) {
			fullInput.value = localValue.startsWith("+") ? localValue : `${selected.dial}${localValue ? ` ${localValue}` : ""}`;
		}

		if (countryInput) {
			countryInput.value = selected.iso;
		}
	};

	const closePicker = (picker: HTMLElement): void => {
		const phoneCode = picker.querySelector<HTMLElement>("[data-phone-code]");
		const toggle = picker.querySelector<HTMLButtonElement>("[data-phone-toggle]");
		phoneCode?.classList.remove("is-open");
		toggle?.setAttribute("aria-expanded", "false");
	};

	const closeOtherPickers = (currentPicker: HTMLElement): void => {
		pickers.forEach((picker) => {
			if (picker !== currentPicker) closePicker(picker);
		});
	};

	const setCountry = (picker: HTMLElement, country: PhoneCountry): void => {
		const flag = picker.querySelector<HTMLElement>("[data-phone-flag]");
		const dial = picker.querySelector<HTMLElement>("[data-phone-dial]");
		const options = picker.querySelectorAll<HTMLElement>("[data-phone-option]");

		picker.dataset.phoneIso = country.iso;
		if (flag) flag.textContent = country.flag;
		if (dial) dial.textContent = country.dial;

		options.forEach((option) => {
			const isSelected = option.dataset.iso === country.iso;
			option.classList.toggle("is-selected", isSelected);
			option.setAttribute("aria-selected", String(isSelected));
		});

		syncPhoneValue(picker);
	};

	pickers.forEach((picker) => {
		const menu = picker.querySelector<HTMLElement>("[data-phone-menu]");
		const toggle = picker.querySelector<HTMLButtonElement>("[data-phone-toggle]");
		const input = picker.querySelector<HTMLInputElement>("[data-phone-input]");
		if (!menu || !toggle || !input) return;

		countries.forEach((country) => {
			const option = document.createElement("button");
			option.type = "button";
			option.className = "phone-code__option";
			option.dataset.phoneOption = "";
			option.dataset.iso = country.iso;
			option.setAttribute("role", "option");
			option.innerHTML = `
				<span class="phone-code__flag" aria-hidden="true">${country.flag}</span>
				<span class="phone-code__option-name">${country.name}</span>
				<span class="phone-code__option-dial">${country.dial}</span>
			`;
			option.addEventListener("click", () => {
				setCountry(picker, country);
				closePicker(picker);
				input.focus();
			});
			menu.appendChild(option);
		});

		setCountry(picker, getInitialCountry());

		toggle.addEventListener("click", () => {
			const phoneCode = picker.querySelector<HTMLElement>("[data-phone-code]");
			const isOpen = Boolean(phoneCode?.classList.contains("is-open"));
			closeOtherPickers(picker);
			phoneCode?.classList.toggle("is-open", !isOpen);
			toggle.setAttribute("aria-expanded", String(!isOpen));
		});

		input.addEventListener("input", () => syncPhoneValue(picker));

		const form = picker.closest("form");
		form?.addEventListener("reset", () => {
			window.setTimeout(() => syncPhoneValue(picker), 0);
		});
	});

	document.addEventListener("click", (event) => {
		pickers.forEach((picker) => {
			if (!picker.contains(event.target as Node)) closePicker(picker);
		});
	});

	document.addEventListener("keydown", (event) => {
		if (event.key !== "Escape") return;
		pickers.forEach(closePicker);
	});
}

setupPhonePickers();

// Intersection Observer
const observer = new IntersectionObserver(
	(entries: IntersectionObserverEntry[]) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				entry.target.classList.add("visible");
				observer.unobserve(entry.target);
			}
		});
	},
	{ threshold: 0.12 },
);

elements.forEach((element) => observer.observe(element));

const currentLang = document.documentElement.lang;
const isFirstLoad = localStorage.getItem('isLoaded') === null;
if (window.navigator.language && isFirstLoad) {
    const fullLanguageCode = navigator.language; // e.g., "en-US", "fr-FR", "es"
    const iso2Code = fullLanguageCode.slice(0, 2);

    const langRedirects: Record<string, string> = {
        en: 'en',
        es: 'es',
        id: 'id',
        ms: 'ms',
        pt: 'br',
        th: 'th',
        tl: 'tl',
    };
    const targetLang = langRedirects[iso2Code];

    if (targetLang && currentLang === 'en') {
        window.location.href = `/${targetLang}`;
    }
    localStorage.setItem('isLoaded', 'true');
}

const updateTopbar = (): void => {
	if (topbar) {
		topbar.classList.toggle("is-scrolled", window.scrollY > 16);
	}
};

/* Scroll-based fall & fade */
const updateTileScatter = (): void => {
	if (!hero || !heroFloating) return;

	const heroH: number = hero.offsetHeight;
	const scrollY: number = window.scrollY;
	const progress: number = Math.min(1, Math.max(0, scrollY / (heroH * 0.55)));
	const ease: number = 1 - Math.pow(1 - progress, 3);

	heroFloating.style.opacity = (1 - ease).toString();

	heroTiles.forEach((tile) => {
		const fallSpeed: number = Number(tile.dataset.fall || 1);
		const depth: number = Number(tile.dataset.depth || 10);
		const fallY: number = ease * 120 * fallSpeed;
		const driftX: number = ease * (depth - 11) * 8;

		tile.style.translate = `${driftX}px ${fallY}px`;
		tile.style.scale = `${1 - ease * 0.15}`;
		tile.style.opacity = `${1 - ease * 0.6}`;
	});
};

window.addEventListener(
	"scroll",
	() => {
		updateTopbar();
		if (!reduceMotion) updateTileScatter();
	},
	{ passive: true },
);

updateTopbar();
if (!reduceMotion) updateTileScatter();

// Mouse Parallax Logic
if (!reduceMotion && hero && heroTiles.length) {
	let targetX: number = 0;
	let targetY: number = 0;
	let currentX: number = 0;
	let currentY: number = 0;
	let rafId: number = 0;

	const renderTiles = (): void => {
		currentX += (targetX - currentX) * 0.12;
		currentY += (targetY - currentY) * 0.12;

		heroTiles.forEach((tile) => {
			const depth: number = Number(tile.dataset.depth || 10);
			tile.style.setProperty("--tx", `${currentX * depth}px`);
			tile.style.setProperty("--ty", `${currentY * depth}px`);
		});

		const isSettled: boolean = Math.abs(targetX - currentX) < 0.002 && Math.abs(targetY - currentY) < 0.002;

		if (isSettled) {
			rafId = 0;
			return;
		}

		rafId = window.requestAnimationFrame(renderTiles);
	};

	const requestRender = (): void => {
		if (!rafId) {
			rafId = window.requestAnimationFrame(renderTiles);
		}
	};

	hero.addEventListener("pointermove", (event: PointerEvent) => {
		const rect: DOMRect = hero.getBoundingClientRect();
		targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
		targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
		requestRender();
	});

	hero.addEventListener("pointerleave", () => {
		targetX = 0;
		targetY = 0;
		requestRender();
	});
}

// Modal Logic
const getFocusableElements = (): HTMLElement[] => {
	if (!modal) return [];
	const selector =
		'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
	return Array.from(modal.querySelectorAll<HTMLElement>(selector)).filter((el) => !el.hasAttribute("hidden"));
};

const openModal = (): void => {
	if (!modal) return;
	previouslyFocused = document.activeElement as HTMLElement | null;
	modal.classList.add("is-open");
	modal.setAttribute("aria-hidden", "false");
	document.body.classList.add("modal-open");
	const focusables = getFocusableElements();
	if (focusables.length) focusables[0].focus();
};

const closeModal = (): void => {
	if (!modal) return;
	modal.classList.remove("is-open");
	modal.setAttribute("aria-hidden", "true");
	document.body.classList.remove("modal-open");
	if (previouslyFocused) previouslyFocused.focus();
};

openModalButtons.forEach((button) => {
	button.addEventListener("click", (event: MouseEvent) => {
		event.preventDefault();
		openModal();
	});
});

modalCloseButtons.forEach((button) => {
	button.addEventListener("click", closeModal);
});

document.addEventListener("keydown", (event: KeyboardEvent) => {
	if (!modal || !modal.classList.contains("is-open")) return;

	if (event.key === "Escape") {
		event.preventDefault();
		closeModal();
		return;
	}

	if (event.key !== "Tab") return;

	const focusables = getFocusableElements();
	if (!focusables.length) return;

	const first = focusables[0];
	const last = focusables[focusables.length - 1];

	if (event.shiftKey && document.activeElement === first) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first.focus();
	}
});

const collectUtm = (): Record<string, string> => {
	const utm: Record<string, string> = {};

	// Collect&Store Marketing attribution
	const list = ['utm_campaign', 'utm_medium', 'utm_source', 'utm_content', 'utm_term'];
	const urlParams = new URLSearchParams(window.location.search);
	const entries = urlParams.entries();
	for (const entry of entries) {
		localStorage.setItem('param__' + entry[0], entry[1]);
	}
	for (const key of list) {
		const value = localStorage.getItem('param__' + key);
		if (value !== null) {
			utm[key] = value;
		}
	}

	utm.lang_by_browser = window.navigator.language || "en";
	utm.lang = currentLang || window.navigator.language;

	const url = new URL(window.location.href);
	utm.landing_url = utm.referrer = url.host + url.pathname;

	const roistatId = getCookieByName('roistat_visit', document.cookie);
	if (roistatId) utm.roistat_id = roistatId;

	return utm;
}


// Form Submissions
if (modalForm && modalFormWrap) {
	const messageBtns = modalFormWrap.querySelectorAll<HTMLButtonElement>("[data-message-btn]");
	const closeBtn = [
		modalFormWrap.parentNode?.querySelector<HTMLButtonElement>("[data-close-modal]"),
		modalFormWrap
			.closest<HTMLButtonElement>("#request-modal")
			?.querySelector<HTMLButtonElement>("[data-close-modal]"),
	];
	const wrapClassNameMod = createFormClassNameMod(modalFormWrap);
	const disableManager = createDisableForm(modalForm);

	const formCallback: SubmitFormCallback = {
		response() {
			wrapClassNameMod.loading(false);
		},
		validationErrors() {
			wrapClassNameMod.removeAll();
			disableManager.enable();
		},
		success() {
			wrapClassNameMod.success(true);
			modalForm.reset();
			disableManager.enable();
			const utm = collectUtm();
			trackLeadSubmit("modal-form", { utm_source: utm.utm_source, utm_campaign: utm.utm_campaign });
		},
		error() {
			wrapClassNameMod.error(true);
		},
	};

	modalForm.addEventListener("submit", async (event: SubmitEvent) => {
		wrapClassNameMod.loading(true);
		disableManager.disable();
		const utm = collectUtm();
		await submitForm(event, formCallback, utm);
	});

	closeBtn.forEach((btn) => {
		btn?.addEventListener("click", () => {
			wrapClassNameMod.removeAll();
		});
	});

	messageBtns.forEach((btn) => {
		btn.addEventListener("click", () => {
			wrapClassNameMod.removeAll();
			disableManager.enable();
			removeValidationInputErrors(modalForm);
		});
	});
}

if (conversionForm) {
	const messageBtn = conversionForm.querySelectorAll<HTMLButtonElement>("[data-message-btn]");
	const formClassNameMod = createFormClassNameMod(conversionForm);
	const disableManager = createDisableForm(conversionForm);

	const formCallback: SubmitFormCallback = {
		response() {
			formClassNameMod.loading(false);
		},
		validationErrors() {
			formClassNameMod.removeAll();
			disableManager.enable();
		},
		success() {
			formClassNameMod.success(true);
			conversionForm.reset();
			const utm = collectUtm();
			trackLeadSubmit("conversion-form", { utm_source: utm.utm_source, utm_campaign: utm.utm_campaign });
		},
		error() {
			formClassNameMod.error(true);
		},
	};

	conversionForm.addEventListener("submit", async (event: SubmitEvent) => {
		formClassNameMod.loading(true);
		disableManager.disable();
		const utm = collectUtm();
		await submitForm(event, formCallback, utm);
	});

	messageBtn.forEach((btn) => {
		btn.addEventListener("click", () => {
			formClassNameMod.removeAll();
			disableManager.enable();
			removeValidationInputErrors(conversionForm);
		});
	});
}
