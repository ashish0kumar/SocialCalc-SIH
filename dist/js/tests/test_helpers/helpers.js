import { App, Component, xml } from "@odoo/owl";
import format from "xml-formatter";
import { Spreadsheet } from "../../src/components/spreadsheet";
import { functionRegistry } from "../../src/functions/index";
import { toCartesian, toXC, toZone } from "../../src/helpers/index";
import { Model } from "../../src/model";
import { MergePlugin } from "../../src/plugins/core/merge";
import { redo, setCellContent, undo } from "./commands_helpers";
import { getCell, getCellContent } from "./getters_helpers";
const functions = functionRegistry.content;
const functionMap = functionRegistry.mapping;
export function spyDispatch(parent) {
    return jest.spyOn(parent.model, "dispatch");
}
export function getPlugin(model, cls) {
    return model["handlers"].find((handler) => handler instanceof cls);
}
const realTimeSetTimeout = window.setTimeout.bind(window);
class Root extends Component {
}
Root.template = xml `<div/>`;
const Scheduler = new App(Root).scheduler.constructor;
// modifies scheduler to make it faster to test components
Scheduler.requestAnimationFrame = function (callback) {
    realTimeSetTimeout(callback, 1);
    return 1;
};
export async function nextTick() {
    await new Promise((resolve) => realTimeSetTimeout(resolve));
    await new Promise((resolve) => Scheduler.requestAnimationFrame(resolve));
}
/**
 * Get the instance of the given cls, which is a child of the component.
 *
 * new (...args: any) => any is a constructor, which ensure us to have
 * a return value correctly typed.
 */
export function getChildFromComponent(component, cls) {
    var _a;
    return (_a = Object.values(component.__owl__.children).find((child) => child.component instanceof cls)) === null || _a === void 0 ? void 0 : _a.component;
}
export function makeTestFixture() {
    let fixture = document.createElement("div");
    document.body.appendChild(fixture);
    return fixture;
}
export class MockClipboard {
    constructor() {
        this.content = "Some random clipboard content";
    }
    readText() {
        return Promise.resolve(this.content);
    }
    writeText(content) {
        this.content = content;
        return Promise.resolve();
    }
    addEventListener() { }
    removeEventListener() { }
    dispatchEvent() {
        return false;
    }
}
export function testUndoRedo(model, expect, command, args) {
    const before = model.exportData();
    model.dispatch(command, args);
    const after = model.exportData();
    undo(model);
    expect(model).toExport(before);
    redo(model);
    expect(model).toExport(after);
}
// Requires to be called wit jest realTimers
export async function mountSpreadsheet(fixture, props = { model: new Model() }) {
    const app = new App(Spreadsheet, { props, test: true });
    const parent = (await app.mount(fixture));
    return { app, parent };
}
export function getGrid(model) {
    const result = {};
    const sheetId = model.getters.getActiveSheetId();
    for (let cellId in model.getters.getCells(sheetId)) {
        const { col, row } = model.getters.getCellPosition(cellId);
        const cell = model.getters.getCell(sheetId, col, row);
        result[toXC(col, row)] = cell ? cell.evaluated.value : undefined;
    }
    return result;
}
/**
 * Evaluate the final state of a grid according to the different values ​​and
 * different functions submitted in the grid cells
 *
 * Examples:
 *   {A1: "=sum(B2:B3)", B2: "2", B3: "3"} => {A1: 5, B2: 2, B3: 3}
 *   {B5: "5", D8: "2.6", W4: "=round(A2)"} => {B5: 5, D8: 2.6, W4: 3}
 */
export function evaluateGrid(grid) {
    const model = new Model();
    for (let xc in grid) {
        if (grid[xc] !== undefined) {
            setCellContent(model, xc, grid[xc]);
        }
    }
    const result = {};
    for (let xc in grid) {
        const cell = getCell(model, xc);
        result[xc] = cell ? cell.evaluated.value : "";
    }
    return result;
}
export function evaluateGridText(grid) {
    const model = new Model();
    for (let xc in grid) {
        if (grid[xc] !== undefined) {
            setCellContent(model, xc, grid[xc]);
        }
    }
    const result = {};
    for (let xc in grid) {
        result[xc] = getCellContent(model, xc);
    }
    return result;
}
/**
 * Evaluate the final state of a cell according to the different values and
 * different functions submitted in a grid cells
 *
 * Examples:
 *   "A2", {A1: "41", A2: "42", A3: "43"} => 42
 *   "A1", {A1: "=sum(A2:A4)", A2: "2", A3: "3", "A4": "4"} => 9
 */
export function evaluateCell(xc, grid) {
    const gridResult = evaluateGrid(grid);
    return gridResult[xc];
}
export function evaluateCellText(xc, grid) {
    const gridResult = evaluateGridText(grid);
    return gridResult[xc] || "";
}
//------------------------------------------------------------------------------
// DOM/Misc Mocks
//------------------------------------------------------------------------------
/*
 * Remove all functions from the internal function list.
 */
export function resetFunctions() {
    Object.keys(functionMap).forEach((k) => {
        delete functionMap[k];
    });
    Object.keys(functions).forEach((k) => {
        delete functions[k];
    });
}
export function getMergeCellMap(model) {
    const mergePlugin = getPlugin(model, MergePlugin);
    const sheetCellMap = mergePlugin["mergeCellMap"][model.getters.getActiveSheetId()];
    return sheetCellMap
        ? Object.fromEntries(Object.entries(sheetCellMap).filter(([col, row]) => row !== undefined && Array.isArray(row) && row.some((x) => x)))
        : {};
}
export function XCToMergeCellMap(model, mergeXCList) {
    const mergeCellMap = {};
    const sheetId = model.getters.getActiveSheetId();
    for (const mergeXC of mergeXCList) {
        const [col, row] = toCartesian(mergeXC);
        const merge = model.getters.getMerge(sheetId, col, row);
        if (!mergeCellMap[col])
            mergeCellMap[col] = [];
        mergeCellMap[col][row] = merge ? merge.id : undefined;
    }
    return mergeCellMap;
}
export function toPosition(xc) {
    const [col, row] = toCartesian(xc);
    return { col: col, row: row };
}
export function zone(str) {
    return toZone(str);
}
export function target(str) {
    return str.split(",").map(zone);
}
export function createEqualCF(value, style, id) {
    return {
        id,
        rule: { values: [value], operator: "Equal", type: "CellIsRule", style },
    };
}
export function createColorScale(id, min, max, mid) {
    return {
        id,
        rule: { type: "ColorScaleRule", minimum: min, maximum: max, midpoint: mid },
    };
}
async function typeInComposerHelper(selector, text, fromScratch) {
    let composerEl = document.querySelector(selector);
    if (fromScratch) {
        composerEl = await startGridComposition();
    }
    // @ts-ignore
    const cehMock = window.mockContentHelper;
    cehMock.insertText(text);
    composerEl.dispatchEvent(new Event("keydown", { bubbles: true }));
    await nextTick();
    composerEl.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    composerEl.dispatchEvent(new Event("keyup", { bubbles: true }));
    await nextTick();
    return composerEl;
}
export async function typeInComposerGrid(text, fromScratch = true) {
    return await typeInComposerHelper(".o-grid .o-composer", text, fromScratch);
}
export async function typeInComposerTopBar(text, fromScratch = true) {
    return await typeInComposerHelper(".o-spreadsheet-topbar .o-composer", text, fromScratch);
}
export async function startGridComposition(key = "Enter") {
    const gridEl = document.querySelector(".o-grid");
    gridEl.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    await nextTick();
    return document.querySelector(".o-grid .o-composer");
}
/**
 * Return the text of every node matching the selector
 */
export function textContentAll(cssSelector) {
    const nodes = document.querySelectorAll(cssSelector);
    if (!nodes)
        return [];
    return [...nodes].map((node) => node.textContent).filter((text) => text !== null);
}
/**
 * The Touch API is currently experimental (mid 2020).
 * This implementation is used in test to easily trigger TouchEvents.
 * (TouchEvent is not experimental and supported by all major browsers.)
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Touch
 */
export class Touch {
    constructor(touchInitDict) {
        this.identifier = touchInitDict.identifier;
        this.target = touchInitDict.target;
        this.altitudeAngle = touchInitDict.altitudeAngle || 0;
        this.azimuthAngle = touchInitDict.azimuthAngle || 0;
        this.clientX = touchInitDict.clientX || 0;
        this.clientY = touchInitDict.clientY || 0;
        this.force = touchInitDict.force || 0;
        this.pageX = touchInitDict.pageX || 0;
        this.pageY = touchInitDict.pageY || 0;
        this.radiusX = touchInitDict.radiusX || 0;
        this.radiusY = touchInitDict.radiusY || 0;
        this.rotationAngle = touchInitDict.rotationAngle || 0;
        this.screenX = touchInitDict.screenX || 0;
        this.screenY = touchInitDict.screenY || 0;
        this.touchType = touchInitDict.touchType || "direct";
    }
}
/**
 * Return XLSX export with prettified XML files.
 */
export async function exportPrettifiedXlsx(model) {
    const xlsxExport = await model.exportXLSX();
    return {
        ...xlsxExport,
        files: xlsxExport.files.map((file) => ({ ...file, content: format(file.content) })),
    };
}
export function mockUuidV4To(model, value) {
    //@ts-ignore
    return model.uuidGenerator.setNextId(value);
}
/**
 * Make a test environment for testing interactive actions
 */
export function makeInteractiveTestEnv(model, env) {
    return {
        model,
        ...env,
    };
}
//# sourceMappingURL=helpers.js.map