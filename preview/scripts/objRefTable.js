const C3 = self.C3;
self.C3_GetObjectRefTable = function () {
	return [
		C3.Plugins.Sprite,
		C3.Plugins.TiledBg,
		C3.Plugins.Shape3D,
		C3.Plugins.Camera3D,
		C3.Plugins.Mouse,
		C3.Plugins.FileSystem,
		C3.Plugins.Arr,
		C3.Plugins.BinaryData,
		C3.Plugins.Browser,
		C3.Plugins.FileSystem.Cnds.OnDroppedFiles,
		C3.Plugins.Arr.Acts.SplitString,
		C3.Plugins.Browser.Acts.ConsoleLog,
		C3.Plugins.FileSystem.Exps.FileNameAt,
		C3.Plugins.System.Exps.tokenat,
		C3.Plugins.System.Exps.tokencount,
		C3.Plugins.Arr.Cnds.Contains,
		C3.Plugins.FileSystem.Acts.ReadBinaryFile,
		C3.Plugins.FileSystem.Cnds.OnFileOperationComplete,
		C3.Plugins.Sprite.Cnds.IsVisible,
		C3.Plugins.BinaryData.Exps.GetURL,
		C3.Plugins.Shape3D.Cnds.IsVisible,
		C3.Plugins.Sprite.Acts.LoadURL,
		C3.Plugins.System.Cnds.CompareBoolVar,
		C3.JavaScriptInEvents.EventSheet1_Event7_Act1,
		C3.Plugins.System.Acts.WaitForPreviousActions,
		C3.JavaScriptInEvents.EventSheet1_Event10_Act1,
		C3.Plugins.TiledBg.Acts.LoadURL,
		C3.JavaScriptInEvents.EventSheet1_Event13_Act1
	];
};
self.C3_JsPropNameTable = [
	{Piggy: 0},
	{background: 0},
	{shape3d: 0},
	{camera: 0},
	{background3d: 0},
	{Mouse: 0},
	{FileSystem: 0},
	{ValidImageFileFormats: 0},
	{BinaryData: 0},
	{shape3dTexture: 0},
	{Browser: 0},
	{url: 0},
	{fromDrop: 0}
];

self.InstanceType = {
	Piggy: class extends self.ISpriteInstance {},
	background: class extends self.ITiledBackgroundInstance {},
	shape3d: class extends self.I3DShapeInstance {},
	camera: class extends self.IInstance {},
	background3d: class extends self.I3DShapeInstance {},
	Mouse: class extends self.IInstance {},
	FileSystem: class extends self.IInstance {},
	ValidImageFileFormats: class extends self.IArrayInstance {},
	BinaryData: class extends self.IBinaryDataInstance {},
	shape3dTexture: class extends self.ISpriteInstance {},
	Browser: class extends self.IInstance {}
}