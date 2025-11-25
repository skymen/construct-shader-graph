

const scriptsInEvents = {

	async EventSheet1_Event7_Act1(runtime, localVars)
	{
		globalThis.updatePreviewSpriteUrl(localVars.url)
	},

	async EventSheet1_Event10_Act1(runtime, localVars)
	{
		globalThis.updatePreviewShapeUrl(localVars.url)
	},

	async EventSheet1_Event13_Act1(runtime, localVars)
	{
		globalThis.updatePreviewBgUrl(localVars.url)
	}
};

globalThis.C3.JavaScriptInEvents = scriptsInEvents;
