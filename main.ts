import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

interface GitHubVaultPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: GitHubVaultPluginSettings = {
	mySetting: "default",
};

export default class GitHubVaultPlugin extends Plugin {
	settings: GitHubVaultPluginSettings;

	async onload() {
		this.addRibbonIcon("dice", "Greet", () => {
			new Notice("Hello, world!");
		});
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}