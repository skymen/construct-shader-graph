const C3 = self.C3;
self.C3_GetObjectRefTable = function () {
	return [
		C3.Plugins.Sprite
	];
};
self.C3_JsPropNameTable = [
	{Piggy: 0}
];

self.InstanceType = {
	Piggy: class extends self.ISpriteInstance {}
}