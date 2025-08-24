import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	Vault,
} from "obsidian";
import git from "isomorphic-git";
import http from "isomorphic-git/http/web";

interface GitHubVaultSettings {
	remoteUrl: string;
	branchName: string;
	personalAccessToken: string;
}

const DEFAULT_SETTINGS: GitHubVaultSettings = {
	remoteUrl: "",
	branchName: "main",
	personalAccessToken: "",
};

export default class GitHubVaultPlugin extends Plugin {
	settings: GitHubVaultSettings;
	fs: any;
	dir: string;

	async onload() {
		await this.loadSettings();

		const adapter = this.app.vault.adapter;
		this.fs = {
			readFile: (filepath: string) => adapter.read(filepath),
			writeFile: (filepath: string, data: any) =>
				adapter.write(filepath, data),
			unlink: (filepath: string) => adapter.remove(filepath),
			readdir: async (filepath: string) => {
				const list = await adapter.list(filepath);
				const pathPrefix = filepath === "." ? "" : `${filepath}/`;
				const files = list.files.map((p) => p.replace(pathPrefix, ""));
				const folders = list.folders.map((p) =>
					p.replace(pathPrefix, "")
				);
				return [...files, ...folders];
			},
			mkdir: (filepath: string) => adapter.mkdir(filepath),
			rmdir: (filepath: string) => adapter.rmdir(filepath, true),
			stat: (filepath: string) => adapter.stat(filepath),
			lstat: (filepath: string) => adapter.stat(filepath), // Adapter doesn't distinguish
			readlink: () => {
				throw new Error("readlink not supported");
			},
			symlink: () => {
				throw new Error("symlink not supported");
			},
		};

		this.dir = ".";

		this.addCommand({
			id: "sync-vault",
			name: "Sync with GitHub",
			callback: () => this.syncVault(),
		});

		this.addSettingTab(new GitHubVaultSettingTab(this.app, this));

		console.log("Git Sync Plugin loaded.");
	}

	onunload() {
		console.log("Git Sync Plugin unloaded.");
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

	async ensureGitignore() {
		const gitignorePath = ".gitignore";
		const ignoreEntry = ".obsidian/";
		let content = "";

		try {
			content = await this.fs.readFile(gitignorePath);
		} catch (error) {
			console.log(".gitignore not found. Creating it.");
		}

		const lines = content.split("\n");
		if (!lines.includes(ignoreEntry)) {
			const newContent = content + `\n${ignoreEntry}\n`;
			await this.fs.writeFile(gitignorePath, newContent.trim());
			console.log(`Updated .gitignore to ignore '${ignoreEntry}'`);
			new Notice(".gitignore configured to protect settings.");
		}
	}

  async ensureGitRepo() {
    try {
      await this.fs.readFile('.git/config');
    } catch (error) {
      console.log("Not a git repository. Initializing...");
      console.log(this.dir);
      console.log(this.settings.branchName);
      await git.init({ fs: this.fs, dir: this.dir, defaultBranch: this.settings.branchName });
      await git.addRemote({
        fs: this.fs,
        dir: this.dir,
        remote: 'origin',
        url: this.settings.remoteUrl,
      });
      console.log("Git repository initialized.");
      new Notice("Initialized new git repository for the vault.");
    }
  }

	async syncVault() {
		const { remoteUrl, branchName, personalAccessToken } = this.settings;
		if (!remoteUrl || !personalAccessToken) {
			new Notice(
				"Please configure repository URL and Personal Access Token in settings."
			);
			return;
		}

		new Notice("Starting GitHub sync...");

		try {
      await this.ensureGitRepo();
      // Ensure .gitignore is set up
      await this.ensureGitignore();
			// 1. Pull changes
			console.log("Pulling changes...");
			await git.pull({
				fs: this.fs,
				http,
				dir: this.dir,
        corsProxy: 'https://cors.isomorphic-git.org',
				ref: branchName,
				author: { name: "Obsidian Sync" },
				onAuth: () => ({ username: personalAccessToken }),
			});
			console.log("Pull successful.");

			// 2. Add all files
			console.log("Adding files...");
			const status = await git.statusMatrix({
				fs: this.fs,
				dir: this.dir,
			});
			await Promise.all(
				status.map(([filepath, ...statuses]) => {
					if (statuses.some((s) => s !== 1)) {
						return git.add({
							fs: this.fs,
							dir: this.dir,
							filepath,
						});
					}
				})
			);
			console.log("Files added.");

			// 3. Commit changes
			console.log("Committing changes...");
			const commitMessage = `Vault sync: ${new Date().toLocaleString()}`;
			await git.commit({
				fs: this.fs,
				dir: this.dir,
				message: commitMessage,
				author: {
					name: "Obsidian Sync Plugin",
				},
			});
			console.log("Changes committed.");

			// 4. Push to remote
			console.log("Pushing changes...");
			await git.push({
				fs: this.fs,
				http,
				dir: this.dir,
        corsProxy: 'https://cors.isomorphic-git.org',
				remote: "origin",
				ref: branchName,
				onAuth: () => ({ username: personalAccessToken }),
			});
			console.log("Push successful.");

			new Notice("Vault synced with GitHub successfully!");
		} catch (error) {
			console.error("Git sync failed:", error);
			new Notice("Git sync failed. Check developer console for details.");
		}
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
			.setName("Personal Access Token")
			.setDesc("A GitHub PAT with repo access. This is stored locally.")
			.addText((text) =>
				text
					.setPlaceholder("Enter your token")
					.setValue(this.plugin.settings.personalAccessToken)
					.onChange(async (value) => {
						this.plugin.settings.personalAccessToken = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
