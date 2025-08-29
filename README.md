# Obsidian GitHub Vault 🪨🟪

A plugin for [Obsidian](https://obsidian.md) that allows you to seamlessly sync your vault with a GitHub repository using Git.  
Keep your notes versioned, backed up, and accessible from anywhere.

## Features

- Push and pull your entire vault to/from a GitHub repository with a single click.
- Automatically detects changes and updates status in the status bar.
- Customizable remote repository URL and branch.
- Automatically manages `.gitignore` to exclude Obsidian config files.

## Installation

1. Download the latest release from the [GitHub Releases](https://github.com/dDreistein/obsidian-github-vault/releases) page (`main.js`, `manifest.json`, `styles.css`).
2. Move these three files into your vault's `.obsidian/plugins/github-vault` directory.
3. Restart Obsidian.
4. Enable **GitHub Vault** in the Obsidian community plugins settings.

## Usage

1. Open the plugin settings in Obsidian.
2. Enter your GitHub repository HTTPS URL (e.g., `https://github.com/yourname/yourrepo.git`).
3. Set the branch name you want to sync with (default: `main`).
4. Click **Reload Plugin** to apply changes.
5. Use the status bar buttons or commands to **Push** or **Pull** changes between your vault and GitHub.

> **Note:**  
> - Requires [Git](https://git-scm.com/) to be installed and available in your system's PATH.
> - The plugin will automatically initialize a Git repository if one does not exist.

## Troubleshooting

- If you see a message that Git is not installed, ensure Git is available in your system's PATH.
- Check the status bar for sync status and error messages.
- For more help, visit the [GitHub repository](https://github.com/dDreistein/obsidian-github-vault).

## License

MIT ©
