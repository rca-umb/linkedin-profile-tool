import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { title } from 'process';

interface LinkedInProfileToolSettings {
	apiKey: string;
}

const DEFAULT_SETTINGS: LinkedInProfileToolSettings = {
	apiKey: ''
}

async function fetchLinkedInProfile(username: string, key: string) {
	const url = `https://linkedin-data-api.p.rapidapi.com/?username=${username}`;
	const options = {
		method: 'GET',
		headers: {
			'x-rapidapi-key': `${key}`,
			'x-rapidapi-host': 'linkedin-data-api.p.rapidapi.com'
		}
	};

	try {
		const response = await fetch(url, options);
		const result = await response.json();
		let noteContent = {
			title: `${result.firstName} ${result.lastName}`,
			body: ''
		};
		noteContent.body = (
			`## Background\n` +
			`### Work`
		);
		for (const job of result.position) {
			noteContent.body += (
				`\n**${job.multiLocaleTitle.en_US}** at [[${job.multiLocaleCompanyName.en_US}]] from ${job.start.month}/${job.start.year}`
			);
			if (job.end.year == 0) { // currently working at this position
				noteContent.body += '.'
			} else {
				noteContent.body += ` to ${job.end.month}/${job.end.year}.`
			}

		}
		noteContent.body += '\n### Education';
		for (const school of result.educations) {
			noteContent.body += (
				`\n${school.fieldOfStudy} ${school.degree} from [[${school.schoolName}]], ${school.end.year}.`
			);
		}
		return {
			code: 0,
			details: noteContent
		};
	
	} catch (error) {
		console.log(error);
		return {
			code: 1,
			details: error
		};
	}
}

export default class LinkedInProfileTool extends Plugin {
	settings: LinkedInProfileToolSettings;

	async onload() {
		await this.loadSettings();

		/* might want to use this later
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');
		*/
		/* might need this later
		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		*/
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'linkedin-profile-tool-create-from-url',
			name: 'Create a new note from LinkedIn profile URL',
			/* will use this later
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const selection = editor.getSelection();
				// name of active file is returned with .md extension
				const fileName = this.app.workspace.getActiveFile()?.name.slice(0, -3);

			}
			*/
			callback: () => {
				new FromURLModal(this.app, this.settings.apiKey).open();
			}

		});

		/* might need this added checking later
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});
		*/

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new LinkedInProfileToolSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class FromURLModal extends Modal {
	apiKey: string;

	constructor(app: App, apiKey: string) {
		super(app);
		this.app = app;
		this.apiKey = apiKey;
	}

	onOpen() {
		const contentEl = this;
		this.setTitle('Create a new note from a LinkedIn profile URL');
		let profileURL = '';
		new Setting(this.contentEl)
			.setName('Profile URL')
			.addText(text =>
				text.onChange(value => {
					profileURL = value;
				})
			);
		new Setting(this.contentEl)
			.addButton(btn => btn
				.setButtonText('Create')
				.setCta()
				.onClick(async () => {
					const profile = await fetchLinkedInProfile(profileURL, this.apiKey);
					if (profile.code == 0) {
						const saveFolder = this.app.vault.getRoot()
						try {
							this.app.vault.create(`${saveFolder.path}/${profile.details.title}.md`, profile.details.body);
							new Notice(`Note successfully created for ${profile.details.title}`);
						}
						catch (error) {
							console.log(error);
						}
					} else {
						new Notice(`Error fetching profile data: ${profile.details}`, 0);
					}
					this.close();
				})
			);
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class LinkedInProfileToolSettingTab extends PluginSettingTab {
	plugin: LinkedInProfileTool;

	constructor(app: App, plugin: LinkedInProfileTool) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('RapidAPI API key. Must have a valid subscription to LinkedIn Data API.')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));
	}
}
