import { buildSheetLink } from "../../../src/helpers";
import { clearCell, createSheet, setCellContent } from "../../test_helpers/commands_helpers";
import { clickCell, rightClickCell, simulateClick } from "../../test_helpers/dom_helper";
import { getCell } from "../../test_helpers/getters_helpers";
import { makeTestFixture, mountSpreadsheet, nextTick } from "../../test_helpers/helpers";
describe("link display component", () => {
    let fixture;
    let model;
    let app;
    let parent;
    beforeEach(async () => {
        fixture = makeTestFixture();
        ({ app, parent } = await mountSpreadsheet(fixture));
        model = parent.model;
    });
    afterEach(() => {
        app.destroy();
        fixture.remove();
    });
    test("link shows the url", async () => {
        var _a, _b, _c, _d;
        setCellContent(model, "A1", "[label](url.com)");
        await clickCell(model, "A1");
        expect((_a = fixture.querySelector("a")) === null || _a === void 0 ? void 0 : _a.innerHTML).toBe("https://url.com");
        expect((_b = fixture.querySelector("a")) === null || _b === void 0 ? void 0 : _b.getAttribute("href")).toBe("https://url.com");
        expect((_c = fixture.querySelector("a")) === null || _c === void 0 ? void 0 : _c.getAttribute("title")).toBe("https://url.com");
        expect((_d = fixture.querySelector("a")) === null || _d === void 0 ? void 0 : _d.getAttribute("target")).toBe("_blank");
    });
    test("sheet link title shows the sheet name and doesn't have a href", async () => {
        var _a, _b, _c;
        const sheetId = model.getters.getActiveSheetId();
        setCellContent(model, "A1", `[label](${buildSheetLink(sheetId)})`);
        await clickCell(model, "A1");
        expect((_a = fixture.querySelector("a")) === null || _a === void 0 ? void 0 : _a.innerHTML).toBe("Sheet1");
        expect((_b = fixture.querySelector("a")) === null || _b === void 0 ? void 0 : _b.getAttribute("title")).toBe("Sheet1");
        // with "href", the browser opens a new tab on CTRL+Click
        // it won't work since the "url" is custom and only makes sense within the spreadsheet
        expect((_c = fixture.querySelector("a")) === null || _c === void 0 ? void 0 : _c.getAttribute("href")).toBeNull();
    });
    test("link is displayed and closed when cell is clicked", async () => {
        setCellContent(model, "A1", "[label](url.com)");
        await clickCell(model, "A1");
        expect(fixture.querySelector(".o-link-tool")).toBeTruthy();
        await clickCell(model, "A2");
        expect(fixture.querySelector(".o-link-tool")).toBeFalsy();
    });
    test("link is displayed and closed when the cell is right-clicked", async () => {
        setCellContent(model, "A1", "[label](url.com)");
        await clickCell(model, "A1");
        expect(fixture.querySelector(".o-link-tool")).toBeTruthy();
        await rightClickCell(model, "A1");
        expect(fixture.querySelector(".o-link-tool")).toBeFalsy();
    });
    test("link is displayed and closed when other cell is right-clicked", async () => {
        setCellContent(model, "A1", "[label](url.com)");
        await clickCell(model, "A1");
        expect(fixture.querySelector(".o-link-tool")).toBeTruthy();
        await rightClickCell(model, "A2");
        expect(fixture.querySelector(".o-link-tool")).toBeFalsy();
    });
    test("link is closed when other cell is selected with arrows", async () => {
        var _a;
        setCellContent(model, "A1", "[label](url.com)");
        await clickCell(model, "A1");
        expect(fixture.querySelector(".o-link-tool")).toBeTruthy();
        (_a = fixture
            .querySelector("canvas")) === null || _a === void 0 ? void 0 : _a.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        await nextTick();
        expect(fixture.querySelector(".o-link-tool")).toBeFalsy();
    });
    test("component is closed when cell is deleted", async () => {
        setCellContent(model, "A1", "[label](url.com)");
        await clickCell(model, "A1");
        expect(fixture.querySelector(".o-link-tool")).toBeTruthy();
        clearCell(model, "A1");
        await nextTick();
        expect(fixture.querySelector(".o-link-tool")).toBeFalsy();
    });
    test("component is closed when side panel is opened", async () => {
        setCellContent(model, "A1", "[label](url.com)");
        await clickCell(model, "A1");
        expect(fixture.querySelector(".o-link-tool")).toBeTruthy();
        parent.env.openSidePanel("FindAndReplace");
        await nextTick();
        expect(fixture.querySelector(".o-link-tool")).toBeFalsy();
    });
    test("remove link by clicking the unlink icon", async () => {
        setCellContent(model, "A1", "[label](url.com)");
        await clickCell(model, "A1");
        await simulateClick(".o-unlink");
        expect(fixture.querySelector(".o-link-tool")).toBeFalsy();
        const cell = getCell(model, "A1");
        expect(cell === null || cell === void 0 ? void 0 : cell.isLink()).toBeFalsy();
        expect(cell === null || cell === void 0 ? void 0 : cell.content).toBe("label");
    });
    test("link text color is removed when the cell is unlinked", async () => {
        var _a;
        setCellContent(model, "A1", "[label](url.com)");
        await clickCell(model, "A1");
        model.dispatch("UPDATE_CELL", {
            col: 0,
            row: 0,
            sheetId: model.getters.getActiveSheetId(),
            content: "[label](url.com)",
            style: { bold: true },
        });
        await simulateClick(".o-unlink");
        expect((_a = getCell(model, "A1")) === null || _a === void 0 ? void 0 : _a.style).toEqual({
            bold: true,
            textColor: undefined,
            underline: undefined,
        });
    });
    test("link text color is not removed when the cell is unlinked if it is custom", async () => {
        var _a;
        setCellContent(model, "A1", "[label](url.com)");
        model.dispatch("UPDATE_CELL", {
            col: 0,
            row: 0,
            sheetId: model.getters.getActiveSheetId(),
            style: { bold: true, textColor: "#555" },
        });
        await clickCell(model, "A1");
        await simulateClick(".o-unlink");
        expect((_a = getCell(model, "A1")) === null || _a === void 0 ? void 0 : _a.style).toEqual({
            bold: true,
            textColor: "#555",
            underline: undefined,
        });
    });
    test("open link editor", async () => {
        setCellContent(model, "A1", "[label](url.com)");
        await clickCell(model, "A1");
        await simulateClick(".o-edit-link");
        expect(fixture.querySelector(".o-link-tool")).toBeFalsy();
        const editor = fixture.querySelector(".o-link-editor");
        expect(editor).toBeTruthy();
        const inputs = editor === null || editor === void 0 ? void 0 : editor.querySelectorAll("input");
        expect(inputs[0].value).toBe("label");
        expect(inputs[1].value).toBe("https://url.com");
    });
    test("click on a web link opens the page", async () => {
        const spy = jest.spyOn(window, "open").mockImplementation();
        setCellContent(model, "A1", "[label](url.com)");
        await clickCell(model, "A1");
        await simulateClick("a");
        expect(spy).toHaveBeenCalledWith("https://url.com", "_blank");
        expect(fixture.querySelector(".o-link-tool")).toBeTruthy();
    });
    test("click on a sheet link activates the sheet", async () => {
        const sheetId = "42";
        createSheet(model, { sheetId });
        setCellContent(model, "A1", `[label](${buildSheetLink(sheetId)})`);
        await clickCell(model, "A1");
        expect(model.getters.getActiveSheetId()).not.toBe(sheetId);
        await simulateClick("a");
        expect(model.getters.getActiveSheetId()).toBe(sheetId);
        expect(fixture.querySelector(".o-link-tool")).toBeFalsy();
    });
});
//# sourceMappingURL=link_display.test.js.map