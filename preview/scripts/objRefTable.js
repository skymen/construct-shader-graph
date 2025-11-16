const C3 = self.C3;
self.C3_GetObjectRefTable = function () {
	return [
		C3.Plugins.Sprite,
		C3.Plugins.TiledBg,
		C3.Plugins.Shape3D,
		C3.Plugins.Camera3D
	];
};
self.C3_JsPropNameTable = [
	{Piggy: 0},
	{background: 0},
	{shape3d: 0},
	{camera: 0},
	{background3d: 0}
];

self.InstanceType = {
	Piggy: class extends self.ISpriteInstance {},
	background: class extends self.ITiledBackgroundInstance {},
	shape3d: class extends self.I3DShapeInstance {},
	camera: class extends self.IInstance {},
	background3d: class extends self.I3DShapeInstance {}
}