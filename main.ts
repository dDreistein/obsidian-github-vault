import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	Vault,
} from "obsidian";

import simpleGit, { SimpleGit, SimpleGitOptions } from "simple-git";
import { exec } from "child_process";

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
	git: SimpleGit;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new GitHubVaultSettingTab(this.app, this));

		if (this.settings.remoteUrl && this.settings.branchName) {
			await this.checkGitAvailable();

			simpleGitOptions.baseDir = (
				this.app.vault.adapter as any
			).getBasePath();
			console.log("Git Options:", simpleGitOptions);
			this.git = simpleGit(simpleGitOptions);

			if (!(await this.isGitInit())) {
				this.initGit();
			}

			this.addCommand({
				id: "github-vault-push",
				name: "GitHub Vault Push",
				callback: async () => {
					await this.githubVaultPush();
				},
			});

			this.addCommand({
				id: "github-vault-pull",
				name: "GitHub Vault Pull",
				callback: async () => {
					await this.githubVaultPull();
				},
			});
		} else {
			new Notice("Please configure the GitHub Vault plugin settings.");
		}
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

	async checkGitAvailable(): Promise<void> {
		return new Promise((resolve) => {
			exec("git --version", (error) => {
				if (error) {
					new Notice(
						"Git is not installed or not available in PATH. GitHub Vault plugin will not work."
					);
				}
				resolve();
			});
		});
	}

	async isGitInit(): Promise<boolean> {
		const isRepo = await this.git.checkIsRepo();
		console.log("isGitInit", isRepo);
		return isRepo;
	}

	async initGit() {
		console.log("Initializing git repository");
		await this.git.init();
		await this.git.remote(["add", "origin", this.settings.remoteUrl]);
	}

	async githubVaultPush() {
		console.log("Pushing changes to GitHub");
		await this.git.add("./*");
    const now = new Date().toLocaleString();
    await this.git.commit(`GitHub Vault - ${now}`);
		await this.git.push("origin", this.settings.branchName);
	}

	async githubVaultPull() {
		console.log("Pulling changes from GitHub");
		await this.git.pull("origin", this.settings.branchName);
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
		await this.app.plugins.disablePlugin(pluginId);
		await this.app.plugins.enablePlugin(pluginId);
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
