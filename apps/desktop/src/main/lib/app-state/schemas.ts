/**
 * UI state schemas (persisted from renderer zustand stores)
 */
import { createDefaultHotkeysState, type HotkeysState } from "shared/hotkeys";
import type { BaseTabsState } from "shared/tabs-types";
import type { Theme } from "shared/themes";

// Re-export for convenience
export type { BaseTabsState as TabsState, Pane } from "shared/tabs-types";

export interface ThemeState {
	activeThemeId: string;
	customThemes: Theme[];
}

export interface OnboardingState {
	providerOnboardingCompleted: boolean;
	selectedProvider: "claude-code" | "codex" | null;
	selectedAuthMethod: "oauth" | "api-key" | null;
}

export interface AppState {
	tabsState: BaseTabsState;
	themeState: ThemeState;
	hotkeysState: HotkeysState;
	onboardingState: OnboardingState;
}

export const defaultAppState: AppState = {
	tabsState: {
		tabs: [],
		panes: {},
		activeTabIds: {},
		focusedPaneIds: {},
		tabHistoryStacks: {},
	},
	themeState: {
		activeThemeId: "dark",
		customThemes: [],
	},
	hotkeysState: createDefaultHotkeysState(),
	onboardingState: {
		providerOnboardingCompleted: false,
		selectedProvider: null,
		selectedAuthMethod: null,
	},
};
