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
		await this.loadSettings();

		const basePath = (this.app.vault.adapter as any).getBasePath();

		this.addSettingTab(new GitHubVaultSettingTab(this.app, this));
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

class GitHubVaultSettingTab extends PluginSettingTab {
	plugin: GitHubVaultPlugin;

	constructor(app: App, plugin: GitHubVaultPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Remote Name")
			.setDesc("The name of your remote repository.")
			.addText((text) =>
				text
					.setPlaceholder("origin")
					.setValue(this.plugin.settings.remoteName)
					.onChange(async (value) => {
						this.plugin.settings.remoteName = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Branch Name")
			.setDesc("The name of the branch to sync with.")
			.addText((text) =>
				text
					.setPlaceholder("main")
					.setValue(this.plugin.settings.branchName)
					.onChange(async (value) => {
						this.plugin.settings.branchName = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
