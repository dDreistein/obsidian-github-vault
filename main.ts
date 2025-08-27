import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	Vault,
} from "obsidian";

import gitManager, { SimpleGitOptions } from "./src/gitManager";

interface GitHubVaultSettings {
	remoteUrl: string;
	branchName: string;
}

const DEFAULT_SETTINGS: GitHubVaultSettings = {
	remoteUrl: "",
	branchName: "main",
};

const simpleGitOptions: Partial<SimpleGitOptions> = {
	baseDir: "",
	binary: "git",
	maxConcurrentProcesses: 6,
	trimmed: false,
};

export default class GitHubVaultPlugin extends Plugin {
	settings: GitHubVaultSettings;
	gitHubVaultStatus: HTMLElement;
	gitManager: gitManager;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new GitHubVaultSettingTab(this.app, this));
		this.gitHubVaultStatus = this.addStatusBarItem();
		this.gitHubVaultStatus.createEl("span", {
			text: "Loading GitHub Vault...",
			cls: "github-vault-status-red",
		});

		this.gitManager = new gitManager();
		this.gitManager.setStatusCallback(this.setStatus.bind(this));

		if (this.settings.remoteUrl && this.settings.branchName) {
			if (await this.gitManager.checkGitAvailable()) {
				simpleGitOptions.baseDir = (
					this.app.vault.adapter as any
				).getBasePath();
				await this.gitManager.initGitManager(
					simpleGitOptions,
					this.settings,
					this.app
				);

				this.addCommand({
					id: "github-vault-push",
					name: "Push",
					callback: async () => {
						await this.gitManager.githubVaultPush();
					},
				});
				this.addCommand({
					id: "github-vault-pull",
					name: "Pull",
					callback: async () => {
						await this.gitManager.githubVaultPull();
					},
				});

				this.registerEvent(
					this.app.vault.on("modify", () =>
						this.gitManager.gitStatus()
					)
				);
				this.registerEvent(
					this.app.vault.on("delete", () =>
						this.gitManager.gitStatus()
					)
				);
				this.registerEvent(
					this.app.vault.on("create", () =>
						this.gitManager.gitStatus()
					)
				);
			} else {
				new Notice(
					"Git is not installed or not available in PATH. GitHub Vault plugin will not work."
				);
			}
		} else {
			this.setStatus("Configure Plugin Settings", "red");
			new Notice("Please configure the GitHub Vault plugin settings.");
		}
	}

	onunload() {
		this.gitHubVaultStatus.remove();
	}

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

	async setStatus(status: string, color: "green" | "yellow" | "red") {
		this.gitHubVaultStatus.setText(status);
		this.gitHubVaultStatus.removeClass("github-vault-status-green");
		this.gitHubVaultStatus.removeClass("github-vault-status-yellow");
		this.gitHubVaultStatus.removeClass("github-vault-status-red");
		this.gitHubVaultStatus.addClass(`github-vault-status-${color}`);
	}
}

class GitHubVaultSettingTab extends PluginSettingTab {
	plugin: GitHubVaultPlugin;

	constructor(app: App, plugin: GitHubVaultPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async reloadPlugin() {
		const pluginId = this.plugin.manifest.id;
		await (this.app as any).plugins.disablePlugin(pluginId);
		await (this.app as any).plugins.enablePlugin(pluginId);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("GitHub Repo URL")
			.setDesc("The HTTPS URL of your remote repository.")
			.addText((text) =>
				text
					.setPlaceholder("https://github.com/user/repo.git")
					.setValue(this.plugin.settings.remoteUrl)
					.onChange(async (value) => {
						this.plugin.settings.remoteUrl = value;
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
		new Setting(containerEl)
			.setName("Reload")
			.setDesc(
				"Reload the plugin to apply changes to the repository URL or branch."
			)
			.addButton((btn) =>
				btn
					.setButtonText("Reload Plugin")
					.setCta()
					.onClick(async () => {
						await this.reloadPlugin();
					})
			);
	}
}
