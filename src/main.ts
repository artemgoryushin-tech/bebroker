import "./style.css";

// Типизация DOM-элементов с использованием Generic-типов
const elements = document.querySelectorAll<HTMLElement>(".reveal");
const topbar = document.querySelector<HTMLElement>(".topbar");
const hero = document.querySelector<HTMLElement>(".hero");
const heroTiles = document.querySelectorAll<HTMLElement>(".hero__tile[data-depth]");
const openModalButtons = document.querySelectorAll<HTMLElement>("[data-open-modal]");
const modal = document.getElementById("request-modal") as HTMLElement | null;
const modalCloseButtons = modal ? modal.querySelectorAll<HTMLElement>("[data-close-modal]") : [];
const modalForm = document.getElementById("request-modal-form") as HTMLFormElement | null;
const modalFormWrap = modal ? modal.querySelector<HTMLElement>("[data-modal-form-wrap]") : null;
const modalSuccess = modal ? modal.querySelector<HTMLElement>("[data-modal-success]") : null;
const modalResetButton = modal ? modal.querySelector<HTMLElement>("[data-modal-reset]") : null;
const conversionForm = document.getElementById("conversion-form") as HTMLFormElement | null;
const heroFloating = document.querySelector<HTMLElement>(".hero__floating");

const reduceMotion: boolean = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let previouslyFocused: HTMLElement | null = null;

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

const resetModalState = (): void => {
	if (!modalForm || !modalFormWrap || !modalSuccess) return;
	modalForm.reset();
	modalFormWrap.style.display = "block";
	modalSuccess.classList.remove("is-visible");
};

const openModal = (): void => {
	if (!modal) return;
	previouslyFocused = document.activeElement as HTMLElement | null;
	resetModalState();
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

// Form Submissions
if (modalForm && modalFormWrap && modalSuccess) {
	modalForm.addEventListener("submit", (event: SubmitEvent) => {
		event.preventDefault();
		if (!modalForm.reportValidity()) return;
		modalFormWrap.style.display = "none";
		modalSuccess.classList.add("is-visible");
	});
}

const submitForm = async (event: SubmitEvent): Promise<void> => {
	const form = event.target as HTMLFormElement;
	try {
		const formData = new FormData(form);
		const data = Object.fromEntries(formData.entries());

		const response = await fetch("https://quadcode.foach.site/api/notPopup/", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json", // Критически важно для многих бэкендов
				"X-Requested-With": "XMLHttpRequest",
			},
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			throw new Error(`Ошибка: ${response.status}`);
		}

		const result = await response.json();
		console.log("Успех:", result);
		form.reset();
	} catch (error) {
		console.error("Ошибка при отправке:", error);
	}
};

if (conversionForm) {
	conversionForm.addEventListener("submit", async (event: SubmitEvent) => {
		event.preventDefault();
		await submitForm(event);
	});
}

if (modalResetButton) {
	modalResetButton.addEventListener("click", resetModalState);
}
