import simpleGit, { SimpleGit, SimpleGitOptions } from "simple-git";
import { exec } from "child_process";

import { promises as fs } from "fs";
import * as path from "path";
import { App, Notice } from "obsidian";

export type { SimpleGitOptions };

type StatusColor = "green" | "yellow" | "red";
type StatusCallback = (status: string, color: StatusColor) => void;

interface GitHubVaultSettings {
	remoteUrl: string;
	branchName: string;
}

export default class gitManager {
	git: SimpleGit;
	settings: GitHubVaultSettings;
	app: App;
	private statusCallback?: StatusCallback;

	setStatusCallback(cb: StatusCallback) {
		this.statusCallback = cb;
	}

	private setStatus(status: string, color: StatusColor) {
		if (this.statusCallback) {
			this.statusCallback(status, color);
		}
	}

	public async initGitManager(
		simpleGitOptions: Partial<SimpleGitOptions>,
		settings: GitHubVaultSettings,
		app: App
	) {
		console.log("Initializing SimpleGit with options:", simpleGitOptions);

    this.settings = settings;
    this.app = app;
		this.git = await simpleGit(simpleGitOptions);

		if (!(await this.isGitInit())) {
			await this.initGit();
		}

		await this.ensureGitignore();
		await this.updateRemote();

    await this.gitStatus();
	}

	public async checkGitAvailable(): Promise<boolean> {
		return new Promise((resolve) => {
			exec("git --version", (error) => {
				if (error) {
					resolve(false);
				} else {
					resolve(true);
				}
			});
		});
	}

	public async isGitInit(): Promise<boolean> {
		const isRepo = await this.git.checkIsRepo();
		return isRepo;
	}

	public async initGit() {
		await this.git.init();
		await this.git.remote(["add", "origin", this.settings.remoteUrl]);
	}

	public async updateRemote() {
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
			new Notice(
				`GitHub Vault Push Error: ${(error as Error).message}`,
				5000
			);
		}
		await this.gitStatus();
	}

	async githubVaultPull() {
		await this.setStatus("Pulling changes...", "yellow");
		try {
			await this.git.pull("origin", this.settings.branchName);
		} catch (error) {
			new Notice(
				`GitHub Vault Pull Error: ${(error as Error).message}`,
				5000
			);
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
