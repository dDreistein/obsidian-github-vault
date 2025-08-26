import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	Vault,
} from "obsidian";

import { promises as fs } from "fs";
import * as path from "path";

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
	gitHubVaultStatus: HTMLElement;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new GitHubVaultSettingTab(this.app, this));
		this.gitHubVaultStatus = this.addStatusBarItem();
		this.gitHubVaultStatus.createEl("span", {
			text: "Loading GitHub Vault...",
			cls: "github-vault-status-red",
		});

		if (this.settings.remoteUrl && this.settings.branchName) {
			if (await this.checkGitAvailable()) {
				simpleGitOptions.baseDir = (
					this.app.vault.adapter as any
				).getBasePath();
				this.git = simpleGit(simpleGitOptions);

				if (!(await this.isGitInit())) {
					await this.initGit();
				}

				await this.ensureGitignore();
        await this.updateRemote();

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

				this.registerEvent(
					this.app.vault.on("modify", () => this.gitStatus())
				);

				this.registerEvent(
					this.app.vault.on("delete", () => this.gitStatus())
				);

				this.registerEvent(
					this.app.vault.on("create", () => this.gitStatus())
				);

				await this.gitStatus();
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

	async checkGitAvailable(): Promise<boolean> {
		return new Promise((resolve) => {
			exec("git --version", (error) => {
				if (error) {
					new Notice(
						"Git is not installed or not available in PATH. GitHub Vault plugin will not work."
					);
					resolve(false);
				} else {
					resolve(true);
				}
			});
		});
	}

	async isGitInit(): Promise<boolean> {
		const isRepo = await this.git.checkIsRepo();
		return isRepo;
	}

	async initGit() {
		await this.git.init();
		await this.git.remote(["add", "origin", this.settings.remoteUrl]);
	}

  async updateRemote() {
    await this.git.remote(["set-url", "origin", this.settings.remoteUrl]);
  }

	async githubVaultPush() {
    await this.setStatus("Pushing changes...", "yellow");
		await this.git.add("./*");
		const now = new Date().toLocaleString();
		await this.git.commit(`GitHub Vault - ${now}`);
    try {
      await this.git.push("origin", this.settings.branchName);
    } catch (error) {
      new Notice(`GitHub Vault Push Error: ${(error as Error).message}`, 5000);
    }
    await this.gitStatus();
	}

	async githubVaultPull() {
    await this.setStatus("Pulling changes...", "yellow");
    try {
      await this.git.pull("origin", this.settings.branchName);
    } catch (error) {
      new Notice(`GitHub Vault Pull Error: ${(error as Error).message}`, 5000);
    }
    await this.gitStatus();
	}

	async gitStatus() {
		const status = await this.git.status();
		if (status.files.length > 0) {
			this.setStatus(
				`${status.files.length} Uncommitted Change${
					status.files.length === 1 ? "" : "s"
				}`,
				"red"
			);
		} else {
			this.setStatus("No Uncommitted Changes", "green");
		}
	}

	async setStatus(status: string, color: "green" | "yellow" | "red") {
		this.gitHubVaultStatus.setText(status);
		this.gitHubVaultStatus.removeClass("github-vault-status-green");
		this.gitHubVaultStatus.removeClass("github-vault-status-yellow");
		this.gitHubVaultStatus.removeClass("github-vault-status-red");
		this.gitHubVaultStatus.addClass(`github-vault-status-${color}`);
	}

	async ensureGitignore() {
		const vaultPath = (this.app.vault.adapter as any).getBasePath();
		const gitignorePath = path.join(vaultPath, ".gitignore");
		let content = "";

		try {
			content = await fs.readFile(gitignorePath, "utf8");
			if (!content.includes(".obsidian/")) {
				content +=
					(content.endsWith("\n") ? "" : "\n") + ".obsidian/\n";
				await fs.writeFile(gitignorePath, content, "utf8");
			}
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				await fs.writeFile(gitignorePath, ".obsidian/\n", "utf8");
			} else {
				throw err;
			}
		}
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
