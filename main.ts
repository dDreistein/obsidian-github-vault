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

import simpleGit, { SimpleGit } from "simple-git";

interface GitHubVaultPluginSettings {
	repoPath: string;
	remoteName: string;
	branchName: string;
}

const DEFAULT_SETTINGS: GitHubVaultPluginSettings = {
	repoPath: "",
	remoteName: "origin",
	branchName: "main",
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
