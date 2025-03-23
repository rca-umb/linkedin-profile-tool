import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import testProfile from './test_format.json';
import testSearch from './test_search.json';

interface LinkedInAPI {
	name: string;
	searchEndpoint: string;
	profileEndpoint: string;
	baseURL: string;
}

interface LinkedInProfileToolSettings {
	apiKey: string;
	apiHost: string;
	apiHostDetails: Record<string, LinkedInAPI>;
}

const DEFAULT_SETTINGS: LinkedInProfileToolSettings = {
	apiKey: '',
	apiHost: 'rockapi',
	apiHostDetails: {
		'rockapi': {
			name: 'RockAPIs Real-Time LinkedIn Scraper (high-limit)',
			searchEndpoint: 'https://linkedin-data-api.p.rapidapi.com/search-people?',
			profileEndpoint: 'https://linkedin-data-api.p.rapidapi.com/?username=',
			baseURL: 'linkedin-data-api.p.rapidapi.com'
		},
		'rockapi-cheap': {
			name: 'RockAPIs Real-Time LinkedIn Scraper (cheap)',
			searchEndpoint: 'https://linkedin-api8.p.rapidapi.com/search-people?',
			profileEndpoint: 'https://linkedin-api8.p.rapidapi.com/?username=',
			baseURL: 'linkedin-api8.p.rapidapi.com'
		},
		'none': {
			name: 'Development Testing (doesn\'t use API credits)',
			searchEndpoint: '',
			profileEndpoint: '',
			baseURL: ''
		}
	}
}

async function fetchLinkedInProfile(username: string, key: string, endpoint: string, baseURL: string) {
	const url = `${endpoint}${username}`;
	const options = {
		method: 'GET',
		headers: {
			'x-rapidapi-key': key,
			'x-rapidapi-host': baseURL
		}
	};

	try {
		let result;
		if (endpoint === '') {
			result = testProfile;
		} else {
			const response = await fetch(url, options);
			result = await response.json();
		}
		// response structure
		let noteContent = {
			title: `${result.firstName} ${result.lastName}`,
			body: ''
		};
		// work experience
		noteContent.body = (
			`## Background\n` +
			`### Work\n`
		);
		let linkedOrgs: string[] = [];
		for (const job of result.position) {
			let jobTitle = job.multiLocaleTitle.en_US;
			if (job.employmentType == 'Internship') {
				jobTitle.contains('Intern') ? jobTitle = jobTitle : jobTitle += ' Intern';
			}
			let jobNotes = ((job.location != '') ? `\n- ${job.location}` : '');
			if (job.description != '') {
				const jobDesc = job.description.split('\n');
				jobNotes += '- ' + jobDesc.join('\n- ') + '\n';
			}
			noteContent.body = (job.end.year == 0) ? ( // curently working at this position
				`**${jobTitle}** at ` + (
					(linkedOrgs.contains(job.multiLocaleCompanyName.en_US)) // only link company name on first occurance
					? `${job.multiLocaleCompanyName.en_US}` : `[[${job.multiLocaleCompanyName.en_US}]]`
				) + ' since ' + (
					(job.start.month != 0) ? `${job.start.month}/` : '' // only include month if it is present
				) + `${job.start.year}.` + jobNotes + '\n' +
				noteContent.body
			) : ( // past position
				noteContent.body +
				`**${jobTitle}** at ` + (
					(linkedOrgs.contains(job.multiLocaleCompanyName.en_US)) 
					? `${job.multiLocaleCompanyName.en_US}` : `[[${job.multiLocaleCompanyName.en_US}]]` 
				) + ' from ' + (
					(job.start.month != 0) ? `${job.start.month}/` : '' 
				) + `${job.start.year} to ` + (
					(job.end.month != 0) ? `${job.end.month}/` : '' 
				) + `${job.end.year}.` + jobNotes + '\n'
			);
			linkedOrgs.push(job.multiLocaleCompanyName.en_US);
		}
		// educational experience
		noteContent.body += '### Education\n';
		for (const school of result.educations) {
			noteContent.body += (
				`**${school.fieldOfStudy}** `+ (
					school.degree.contains('-')
					? `${school.degree.split('-')[1].trim()}` : `${school.degree}` 
				) + ' from ' + (
					linkedOrgs.contains(school.schoolName) // only link school name on first occurance
					? `${school.schoolName}` : `[[${school.schoolName}]]`
				) + ( // only include grad year if it is present
					(school.end.year != 0) ? `, ${school.end.year}.` : '.' 
				) + '\n'
			);
			if (school.description != '') {
				const schoolNotes = school.description.split('\n');
				noteContent.body += '- ' + schoolNotes.join('\n- ') + '\n';
			}
			if (school.activities != '') {
				const schoolActivities = school.activities.split('\n');
				noteContent.body += '- ' + schoolActivities.join('\n- ') + '\n';
			}
			linkedOrgs.push(school.schoolName);
		}
		// bottom of note
		noteContent.body += '\n---\n#people';
		// top of note
		noteContent.body = (
			(('headline' in result) ? `*${result.headline}.*\n` : '') +
			(('summary' in result) ? `${result.summary}\n` : '\n') +
			noteContent.body
		);

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

async function searchLinkedInProfiles(firstName: string, lastName: string, keywords: string, key: string, endpoint: string, baseURL: string) {
	let params = '';
	if (keywords) {params += `keywords=${keywords}&`;}
	if (firstName) {params += `firstName=${firstName}&`;}
	if (lastName) {params += `lastName=${lastName}`;}

	// this function shouldn't be called with no parameters, but just in case lets not waste an api call
	if (params === '') {
		return {
			code: 1,
			details: 'No search parameters provided.'
		}
	}

	const url = `${endpoint}${params}`;
	const options = {
		method: 'GET',
		headers: {
			'x-rapidapi-key': key,
			'x-rapidapi-host': baseURL
		}
	};

	try {
		let result;
		if (endpoint === '') {
			result = testSearch;
		} else {
			const response = await fetch(url, options);
			result = await response.json();
		}
		console.log(result);
		if (result.success) {
			return {
				code: 0,
				details: result.data.items
			};
		}
		return {
			code: 1,
			details: result.message
		};
	} catch (error) {
		console.error(error);
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
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'linkedin-profile-tool-from-url',
			name: 'Get a LinkedIn profile by username',
			callback: () => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				new FromURLModal(
					this.app, this.settings.apiKey, 
					this.settings.apiHostDetails[this.settings.apiHost].profileEndpoint,
					this.settings.apiHostDetails[this.settings.apiHost].baseURL,
					activeView?.editor
				).open();
			}
		});

		// Open a modal to search for a profile to pull data from
		this.addCommand({
			id: 'linkedin-profile-tool-search',
			name: 'Search for a LinkedIn profile',
			callback: () => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				new SearchProfilesModal(
					this.app, this.settings.apiKey, 
					this.settings.apiHostDetails[this.settings.apiHost].profileEndpoint, 
					this.settings.apiHostDetails[this.settings.apiHost].searchEndpoint,
					this.settings.apiHostDetails[this.settings.apiHost].baseURL,
					activeView?.editor
				).open();
			}
		});

		// Tests the format by pulling from a test file
		//this.addCommand({
		//	id: 'linkedin-profile-tool-create-from-test',
		//	name: 'Create a new note from test profile (doesn\'t use API credits)',
		//	callback: async () => {
		//		const profile = await fetchLinkedInProfile('', '', '','');
		//		const saveFolder = this.app.vault.getRoot();
		//		try {
		//			this.app.vault.create(`${saveFolder.path}/${profile.details.title}.md`, profile.details.body);
		//		}
		//		catch (error) {
		//			console.log(error);
		//		}
		//		new Notice(`Note successfully created for ${profile.details.title}`);
		//	},
		//})

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
	profileEndpoint: string;
	baseURL: string;
	editor?: Editor;

	constructor(app: App, apiKey: string, profileEndpoint: string, baseURL: string, editor?: Editor) {
		super(app);
		this.app = app;
		this.apiKey = apiKey;
		this.profileEndpoint = profileEndpoint;
		this.baseURL = baseURL;
		this.editor = editor;
	}

	onOpen() {
		this.setTitle('Get LinkedIn profile data by username');
		let profileURL = '';
		new Setting(this.contentEl)
			.setName('Profile Username')
			.setDesc('This can be found in the URL of the profile.')
			.addText(text =>
				text.onChange(value => {
					profileURL = value;
				})
			);
		let buttons = new Setting(this.contentEl)
			.addButton(btn => btn
				.setButtonText('Create new note')
				.setCta()
				.onClick(async () => {
					const profile = await fetchLinkedInProfile(profileURL, this.apiKey, this.profileEndpoint, this.baseURL);
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
		if (this.editor) {
			buttons.addButton(btn => btn
				.setButtonText('Insert at cursor')
				.setCta()
				.onClick(async () => {
					const profile = await fetchLinkedInProfile(profileURL, this.apiKey, this.profileEndpoint, this.baseURL);
					if (profile.code == 0) {
						this.editor!.replaceSelection(profile.details.body);
					} else {
						new Notice(`Error fetching profile data: ${profile.details}`, 0);
					}
					this.close();
				})
			);
		}
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SearchProfilesModal extends Modal {
	apiKey: string;
	profileEndpoint: string;
	searchEndpoint: string;
	baseURL: string;
	editor?: Editor;

	constructor(app: App, apiKey: string, profileEndpoint: string, searchEndpoint: string, baseURL: string, editor?: Editor) {
		super(app);
		this.app = app;
		this.apiKey = apiKey;
		this.profileEndpoint = profileEndpoint;
		this.searchEndpoint = searchEndpoint;
		this.baseURL = baseURL;
		this.editor = editor;
	}

	onOpen() {
		this.setTitle('Search for a LinkedIn profile');
		let personFirstName = '';
		let personLastName = '';
		let personDetails = '';
		new Setting(this.contentEl)
			.setName('First name of user')
			.addText(text => 
				text.onChange(value => {
					personFirstName = value;
				})
			);
		new Setting(this.contentEl)
			.setName('Last name of user')
			.addText(text => 
				text.onChange(value => {
					personLastName = value;
				})
			);
		new Setting(this.contentEl)
			.setName('Details of user')
			.addTextArea(text =>
				text.onChange(value => {
					personDetails = value;
				})
			);
		new Setting(this.contentEl)
			.addButton(btn => btn
				.setButtonText('Search')
				.setCta()
				.onClick(async () => {
					if (personFirstName === '' && personLastName === '' && personDetails === '') {
						new Notice('Please provide at least one search parameter.');
						return;
					}
					const results = await searchLinkedInProfiles(
						personFirstName, personLastName, personDetails, this.apiKey, this.searchEndpoint, this.baseURL
					);
					if (results.code == 0) {
						new PickProfileModal(this.app, this.apiKey, results.details, this.profileEndpoint, this.baseURL, this.editor).open();
					}
					this.close();
				})
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}

class PickProfileModal extends Modal {
	apiKey: string;
	searchResults: any;
	profileEndpoint: string;
	baseURL: string;
	editor?: Editor;

	constructor(app: App, apiKey: string, searchResults: Array<any>, profileEndpoint: string, baseURL: string, editor?: Editor) {
		super(app);
		this.app = app;
		this.apiKey = apiKey;
		this.searchResults = searchResults;
		this.profileEndpoint = profileEndpoint;
		this.baseURL = baseURL;
		this.editor = editor;
	}

	onOpen(){
		this.setTitle('Select which profile to use');
		console.log(this.searchResults);
		let chosenProfile: any;
		for (const result of this.searchResults) {
			new Setting(this.contentEl)
				.setName(`${result.fullName}`)
				.setDesc(`${result.location}\n${result.headline}\n${result.summary}`)
				.addButton(btn => btn
					.setButtonText('Chose Profile')
					.setCta()
					.onClick(() => {
						chosenProfile = result;
					})
				);
		}
		let buttons = new Setting(this.contentEl)
			.addButton(btn => btn
				.setButtonText('Create new note')
				.setCta()
				.onClick(async () => {
					const profile = await fetchLinkedInProfile(chosenProfile.username, this.apiKey, this.profileEndpoint, this.baseURL);
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
				}),
			);
		if (this.editor) {
			buttons.addButton(btn => btn
				.setButtonText('Insert at cursor')
				.setCta()
				.onClick(async () => {
					const profile = await fetchLinkedInProfile(chosenProfile.username, this.apiKey, this.profileEndpoint, this.baseURL);
					if (profile.code == 0) {
						this.editor!.replaceSelection(profile.details.body);
					} else {
						new Notice(`Error fetching profile data: ${profile.details}`, 0);
					}
					this.close();
				})
			);
		}
	}

	onClose() {
		this.contentEl.empty();
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
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API Provider')
			.setDesc('Select the API host you are using from RapidAPI.')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'rockapi': this.plugin.settings.apiHostDetails['rockapi'].name,
					'rockapi-cheap': this.plugin.settings.apiHostDetails['rockapi-cheap'].name,
					'none': this.plugin.settings.apiHostDetails['none'].name
				})
				.setValue(this.plugin.settings.apiHost)
				.onChange(async (value) => {
					this.plugin.settings.apiHost = value;
					await this.plugin.saveSettings();
				}));
	}
}
