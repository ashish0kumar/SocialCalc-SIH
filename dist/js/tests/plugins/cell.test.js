import { Model } from "../../src";
import { buildSheetLink, toZone } from "../../src/helpers";
import { CellValueType } from "../../src/types";
import { createSheet, deleteSheet, renameSheet, setCellContent, undo, } from "../test_helpers/commands_helpers";
import { getCell, getCellText } from "../test_helpers/getters_helpers";
describe("getCellText", () => {
    test("Update cell with a format is correctly set", () => {
        var _a, _b, _c;
        const model = new Model();
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("UPDATE_CELL", {
            sheetId,
            col: 0,
            row: 0,
            content: "5%",
            format: "bla",
        });
        model.dispatch("UPDATE_CELL", {
            sheetId,
            col: 1,
            row: 1,
            content: "12/30/1899",
            format: "bla",
        });
        model.dispatch("UPDATE_CELL", {
            sheetId,
            col: 2,
            row: 2,
            content: "=DATE(2021,1,1)",
            format: "bla",
        });
        expect((_a = getCell(model, "A1")) === null || _a === void 0 ? void 0 : _a.format).toBe("bla");
        expect((_b = getCell(model, "B2")) === null || _b === void 0 ? void 0 : _b.format).toBe("bla");
        expect((_c = getCell(model, "C3")) === null || _c === void 0 ? void 0 : _c.format).toBe("bla");
    });
    test("update cell outside of sheet", () => {
        const model = new Model();
        const sheetId = model.getters.getActiveSheetId();
        const result = model.dispatch("UPDATE_CELL", {
            sheetId,
            col: 9999,
            row: 9999,
            content: "hello",
        });
        expect(result).toBeCancelledBecause(16 /* TargetOutOfSheet */);
    });
});
describe("link cell", () => {
    test.each(["http://odoo.com", "https://odoo.com"])("can create a markdown link cell: %s", (url) => {
        const model = new Model();
        setCellContent(model, "A1", `[my label](${url})`);
        const cell = getCell(model, "A1");
        expect(cell.content).toBe(`[my label](${url})`);
        expect(cell.link.label).toBe("my label");
        expect(cell.link.url).toBe(url);
        expect(cell.urlRepresentation).toBe(url);
        expect(cell.style).toEqual({ textColor: "#00f", underline: true });
        expect(getCellText(model, "A1")).toBe("my label");
    });
    test("https prefix is added if it's missing", () => {
        const model = new Model();
        setCellContent(model, "A1", `[my label](odoo.com)`);
        const cell = getCell(model, "A1");
        expect(cell.content).toBe(`[my label](https://odoo.com)`);
        expect(cell.link.url).toBe("https://odoo.com");
        expect(cell.urlRepresentation).toBe("https://odoo.com");
    });
    test("simple url becomes a link cell", () => {
        const model = new Model();
        setCellContent(model, "A1", "http://odoo.com");
        const cell = getCell(model, "A1");
        expect(cell.content).toBe("[http://odoo.com](http://odoo.com)");
        expect(cell.link.label).toBe("http://odoo.com");
        expect(cell.link.url).toBe("http://odoo.com");
    });
    test.each([
        "prefixhttp://odoo.com",
        "https://url",
        "https://url with spaces.com",
        "http://odoo.com postfix",
    ])("invalid url %s are not recognized as web links", (url) => {
        const model = new Model();
        setCellContent(model, "A1", url);
        const cell = getCell(model, "A1");
        expect(cell === null || cell === void 0 ? void 0 : cell.content).toBe(url);
        expect(cell === null || cell === void 0 ? void 0 : cell.evaluated.type).toBe(CellValueType.text);
    });
    test.each(["[]()", "[ ]()", "[]( )", " [label](url) "])("invalid markdown %s is not recognized as link", (markdown) => {
        const model = new Model();
        setCellContent(model, "A1", markdown);
        const cell = getCell(model, "A1");
        expect(cell === null || cell === void 0 ? void 0 : cell.evaluated.value).toBe(markdown);
        expect(cell === null || cell === void 0 ? void 0 : cell.evaluated.type).toBe(CellValueType.text);
    });
    test("a markdown link in a markdown link", () => {
        const model = new Model();
        setCellContent(model, "A1", `[[label](link)](http://odoo.com)`);
        const cell = getCell(model, "A1");
        expect(cell === null || cell === void 0 ? void 0 : cell.evaluated.type).toBe(CellValueType.text);
        expect(cell === null || cell === void 0 ? void 0 : cell.content).toBe("[[label](link)](http://odoo.com)");
    });
    test("can create a sheet link", () => {
        const model = new Model();
        const sheetId = model.getters.getActiveSheetId();
        const sheetLink = buildSheetLink(sheetId);
        setCellContent(model, "A1", `[my label](${sheetLink})`);
        const cell = getCell(model, "A1");
        expect(cell.link.label).toBe("my label");
        expect(cell.link.url).toBe(sheetLink);
        expect(cell.urlRepresentation).toBe("Sheet1");
        expect(getCellText(model, "A1")).toBe("my label");
    });
    test("sheet url representation is updated when sheet is renamed", () => {
        const model = new Model();
        const sheetId = model.getters.getActiveSheetId();
        const sheetLink = buildSheetLink(sheetId);
        setCellContent(model, "A1", `[my label](${sheetLink})`);
        const cell = getCell(model, "A1");
        renameSheet(model, sheetId, "new name");
        expect(cell.link.label).toBe("my label");
        expect(cell.link.url).toBe(sheetLink);
        expect(cell.urlRepresentation).toBe("new name");
        expect(getCellText(model, "A1")).toBe("my label");
        undo(model);
        expect(cell.urlRepresentation).toBe("Sheet1");
    });
    test("can create an invalid sheet link", () => {
        const model = new Model();
        const sheetLink = buildSheetLink("invalidSheetId");
        setCellContent(model, "A1", `[my label](${sheetLink})`);
        const cell = getCell(model, "A1");
        expect(cell.link.label).toBe("my label");
        expect(cell.link.url).toBe(sheetLink);
        expect(cell.urlRepresentation.toString()).toBe("Invalid sheet");
        expect(getCellText(model, "A1")).toBe("my label");
    });
    test("sheet link is updated if the sheet is deleted", () => {
        const model = new Model();
        createSheet(model, { sheetId: "42" });
        const sheetLink = buildSheetLink("42");
        setCellContent(model, "A1", `[my label](${sheetLink})`);
        deleteSheet(model, "42");
        const cell = getCell(model, "A1");
        expect(cell.link.label).toBe("my label");
        expect(cell.link.url).toBe(sheetLink);
        expect(cell.urlRepresentation.toString()).toBe("Invalid sheet");
        expect(getCellText(model, "A1")).toBe("my label");
        undo(model);
        expect(cell.urlRepresentation).toBe("Sheet2");
    });
    test("link text color is applied if a custom style is specified", () => {
        var _a;
        const model = new Model();
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("UPDATE_CELL", {
            col: 0,
            row: 0,
            sheetId,
            content: "[my label](odoo.com)",
            style: { fillColor: "#555", bold: true, textColor: "#111" },
        });
        expect((_a = getCell(model, "A1")) === null || _a === void 0 ? void 0 : _a.style).toEqual({
            fillColor: "#555",
            bold: true,
            textColor: "#111",
            underline: true,
        });
    });
    test("link text color is not overwritten if there is a custom style", () => {
        var _a;
        const model = new Model();
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("UPDATE_CELL", {
            col: 0,
            row: 0,
            sheetId,
            style: { fillColor: "#555", bold: true, textColor: "#111" },
        });
        setCellContent(model, "A1", `[my label](odoo.com)`);
        expect((_a = getCell(model, "A1")) === null || _a === void 0 ? void 0 : _a.style).toEqual({
            fillColor: "#555",
            bold: true,
            textColor: "#111",
            underline: true,
        });
    });
    test("copy-paste web links", () => {
        const model = new Model();
        setCellContent(model, "B2", `[my label](odoo.com)`);
        const B2 = getCell(model, "B2");
        model.dispatch("COPY", { target: [toZone("B2")] });
        model.dispatch("PASTE", { target: [toZone("D2")] });
        const B2After = getCell(model, "B2");
        const D2 = getCell(model, "D2");
        expect(B2After.link).toEqual(B2.link);
        expect(D2.link).toEqual(B2.link);
        expect(D2.style).toEqual(B2.style);
    });
    test("copy-paste sheet links", () => {
        const model = new Model();
        const sheetId = model.getters.getActiveSheetId();
        const sheetLink = buildSheetLink(sheetId);
        setCellContent(model, "B2", `[my label](${sheetLink})`);
        const B2 = getCell(model, "B2");
        model.dispatch("COPY", { target: [toZone("B2")] });
        model.dispatch("PASTE", { target: [toZone("D2")] });
        const B2After = getCell(model, "B2");
        const D2 = getCell(model, "D2");
        expect(B2After.link).toEqual(B2.link);
        expect(D2.link).toEqual(B2.link);
        expect(D2.style).toEqual(B2.style);
    });
    test("copy-paste custom style", () => {
        var _a;
        const model = new Model();
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("UPDATE_CELL", {
            col: 1,
            row: 1,
            sheetId,
            content: "[my label](odoo.com)",
            style: { fillColor: "#555", bold: true, textColor: "#111" },
        });
        model.dispatch("COPY", { target: [toZone("B2")] });
        model.dispatch("PASTE", { target: [toZone("D2")] });
        expect((_a = getCell(model, "D2")) === null || _a === void 0 ? void 0 : _a.style).toEqual({
            fillColor: "#555",
            bold: true,
            textColor: "#111",
            underline: true,
        });
    });
});
//# sourceMappingURL=cell.test.js.map