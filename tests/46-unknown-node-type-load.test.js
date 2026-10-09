// A .c3sg referencing a node type that no longer resolves used to load
// "successfully" with a hole in it: the node was dropped, every wire touching
// it was dropped, and the only trace was a console.warn. Saving afterwards made
// the loss permanent. The loader now reports what it threw away so the user
// finds out before overwriting the file.
//
// This matters most around node-type renames. A renamed built-in key is
// indistinguishable from a deleted one to the loader, and there is no alias or
// migration table to soften it.

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { bootstrap } from "./helpers/bootstrap.js";

let blueprint;

beforeAll(async () => {
  ({ blueprint } = await bootstrap());
});

beforeEach(() => {
  blueprint.createNewFile();
});

function fakeFile(json) {
  return { name: "test.c3sg", text: async () => JSON.stringify(json) };
}

// Serialize the live default graph through the real save path, so the payload
// has every field the loader expects, then break exactly one thing.
function saveDataWithBrokenNode(typeKey) {
  const data = blueprint._buildSaveData();
  // Front UV feeds other nodes, so breaking it also costs wires.
  const target = data.nodes.find((n) => n.nodeTypeKey === "frontUV");
  expect(target, "default graph should contain a frontUV node").toBeDefined();
  target.nodeTypeKey = typeKey;
  return data;
}

function captureNotifications(fn) {
  const seen = [];
  const spy = vi
    .spyOn(blueprint, "showNotification")
    .mockImplementation((args) => seen.push(args));
  return Promise.resolve(fn())
    .then(() => seen)
    .finally(() => spy.mockRestore());
}

describe("unknown node types on load", () => {
  it("names the unknown type in a user-visible notification", async () => {
    const data = saveDataWithBrokenNode("noSuchNode");
    const seen = await captureNotifications(() =>
      blueprint.loadFromJSON(fakeFile(data)),
    );

    const warning = seen.find((n) => n.type === "error");
    expect(warning, JSON.stringify(seen)).toBeDefined();
    expect(warning.message).toContain("noSuchNode");
    // The user has to understand that saving is destructive here.
    expect(warning.message).toContain("discard");
  });

  it("reports the wires that went down with the dropped node", async () => {
    const data = saveDataWithBrokenNode("noSuchNode");
    const droppedWires = data.wires.filter(
      (w) => w.startNodeId === data.nodes.find((n) => n.nodeTypeKey === "noSuchNode").id,
    ).length;
    expect(droppedWires).toBeGreaterThan(0);

    const seen = await captureNotifications(() =>
      blueprint.loadFromJSON(fakeFile(data)),
    );

    const warning = seen.find((n) => n.type === "error");
    expect(warning.message).toContain(`${droppedWires} connection`);
  });

  it("actually drops the node rather than substituting a placeholder", async () => {
    const data = saveDataWithBrokenNode("noSuchNode");
    const before = data.nodes.length;

    await captureNotifications(() => blueprint.loadFromJSON(fakeFile(data)));

    expect(blueprint.nodes.length).toBe(before - 1);
  });

  it("stays silent when every node type resolves", async () => {
    const data = blueprint._buildSaveData();
    const seen = await captureNotifications(() =>
      blueprint.loadFromJSON(fakeFile(data)),
    );

    expect(seen.some((n) => n.type === "error"), JSON.stringify(seen)).toBe(
      false,
    );
  });

  it("loads every bundled example without dropping anything", async () => {
    // Guards renames: if a node key used by an example stops resolving, this
    // fails instead of the example silently shrinking.
    const examples = import.meta.glob("../examples/*.c3sg", {
      query: "?raw",
      import: "default",
      eager: true,
    });
    expect(Object.keys(examples).length).toBeGreaterThan(0);

    for (const [path, raw] of Object.entries(examples)) {
      blueprint.createNewFile();
      const seen = await captureNotifications(() =>
        blueprint.loadFromJSON({ name: path, text: async () => raw }),
      );
      const warning = seen.find((n) => n.type === "error");
      expect(
        warning?.message,
        `${path}: ${warning?.message ?? ""}`,
      ).toBeUndefined();
    }
  });
});

// The same loss from the other direction: the node type resolves, but the file
// was saved by a build where it had gained a port. Ports load by index, so a
// wire into that port has nowhere to land. This is how the CRT example lost its
// Flatness wire: opened and saved in a build whose Barrel Distort predates the
// port, with nothing on screen to say so.
function saveDataWithFuturePort() {
  const data = blueprint._buildSaveData();
  const wire = data.wires[0];
  const end = data.nodes.find((n) => n.id === wire.endNodeId);
  end.inputPorts.push({ name: "Future Port", portType: "float", value: 0 });
  wire.endPortIndex = end.inputPorts.length - 1;
  return { data, end };
}

describe("wires into ports this build does not have", () => {
  it("names the node and port in a user-visible notification", async () => {
    const { data, end } = saveDataWithFuturePort();
    const seen = await captureNotifications(() =>
      blueprint.loadFromJSON(fakeFile(data)),
    );

    const warning = seen.find((n) => n.type === "error");
    expect(warning, JSON.stringify(seen)).toBeDefined();
    expect(warning.message).toContain("Future Port");
    expect(warning.message).toContain(end.title);
    expect(warning.message).toContain("discard");
  });

  it("counts the wire and records the port in the load report", async () => {
    const { data, end } = saveDataWithFuturePort();
    await captureNotifications(() => blueprint.loadFromJSON(fakeFile(data)));

    expect(blueprint.lastLoadReport.droppedWires).toBe(1);
    expect(blueprint.lastLoadReport.missingPorts).toEqual([
      `${end.title}: Future Port`,
    ]);
    expect(blueprint.wires.length).toBe(data.wires.length - 1);
  });

  it("is cleared by the next clean load", async () => {
    const { data } = saveDataWithFuturePort();
    await captureNotifications(() => blueprint.loadFromJSON(fakeFile(data)));
    blueprint.createNewFile();
    await captureNotifications(() =>
      blueprint.loadFromJSON(fakeFile(blueprint._buildSaveData())),
    );

    expect(blueprint.lastLoadReport.missingPorts).toEqual([]);
    expect(blueprint.lastLoadReport.droppedWires).toBe(0);
  });
});
