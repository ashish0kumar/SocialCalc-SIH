import { toZone } from "../../src/helpers/zones";
import { ConditionalFormatPlugin } from "../../src/plugins/core/conditional_format";
import { activateSheet, createSheet, setSelection } from "../test_helpers/commands_helpers";
import { setInputValueAndTrigger, triggerMouseEvent } from "../test_helpers/dom_helper";
import { createColorScale, createEqualCF, getPlugin, makeTestFixture, mockUuidV4To, mountSpreadsheet, nextTick, spyDispatch, textContentAll, } from "../test_helpers/helpers";
jest.mock("../../src/helpers/uuid", () => require("../__mocks__/uuid"));
let model;
describe("UI of conditional formats", () => {
    let fixture;
    let parent;
    let app;
    beforeEach(async () => {
        fixture = makeTestFixture();
        ({ app, parent } = await mountSpreadsheet(fixture));
        model = parent.model;
        parent.env.openSidePanel("ConditionalFormatting");
        await nextTick();
    });
    afterEach(() => {
        fixture.remove();
        app.destroy();
    });
    function errorMessages() {
        return textContentAll(selectors.error);
    }
    const selectors = {
        listPreview: ".o-cf .o-cf-preview",
        ruleEditor: {
            range: ".o-cf .o-cf-ruleEditor .o-cf-range .o-range input",
            editor: {
                operatorInput: ".o-cf .o-cf-ruleEditor .o-cf-editor .o-cell-is-operator",
                valueInput: ".o-cf .o-cf-ruleEditor .o-cf-editor .o-cell-is-value",
                bold: ".o-cf .o-cf-ruleEditor .o-cf-editor .o-tools div.o-tool[title='Bold']",
                italic: ".o-cf .o-cf-ruleEditor .o-cf-editor .o-tools div.o-tool[title='Italic']",
                underline: ".o-cf .o-cf-ruleEditor .o-cf-editor .o-tools div.o-tool[title='Underline']",
                strikethrough: ".o-cf .o-cf-ruleEditor .o-cf-editor .o-tools div.o-tool[title='Strikethrough']",
                colorDropdown: ".o-cf .o-cf-ruleEditor .o-cf-editor .o-tools .o-with-color span",
                iconSetRule: {
                    container: ".o-cf .o-cf-iconset-rule",
                    iconsets: ".o-cf .o-cf-iconset-rule .o-cf-iconsets .o-cf-iconset",
                    inflextion: ".o-cf .o-cf-iconset-rule .o-inflection",
                    icons: ".o-cf .o-cf-iconset-rule .o-inflection .o-cf-icon",
                    reverse: ".o-cf .o-cf-iconset-rule .o-cf-iconset-reverse",
                    rows: ".o-cf .o-cf-iconset-rule .o-inflection tr",
                },
            },
        },
        previewImage: ".o-cf-preview-image",
        description: {
            ruletype: {
                rule: ".o-cf-preview-description-rule",
                values: ".o-cf-preview-description-values",
            },
            range: ".o-cf-preview-range",
        },
        colorScaleEditor: {
            minColor: ".o-threshold-minimum .o-tool.o-dropdown.o-with-color span",
            minType: ".o-threshold-minimum > select",
            minValue: ".o-threshold-minimum .o-threshold-value",
            midColor: ".o-threshold-midpoint .o-tool.o-dropdown.o-with-color span",
            midType: ".o-threshold-midpoint > select",
            midValue: ".o-threshold-midpoint .o-threshold-value",
            maxColor: ".o-threshold-maximum .o-tool.o-dropdown.o-with-color span",
            maxType: ".o-threshold-maximum > select",
            maxValue: ".o-threshold-maximum .o-threshold-value",
            colorPickerBlue: ".o-color-picker div[data-color='#0000ff']",
            colorPickerOrange: ".o-color-picker div[data-color='#ff9900']",
            colorPickerYellow: ".o-color-picker div[data-color='#ffff00']",
        },
        cfReorder: {
            buttonUp: ".o-cf-reorder-button-up",
            buttonDown: ".o-cf-reorder-button-down",
        },
        cfTabSelector: ".o-cf-type-selector .o_form_label",
        buttonSave: ".o-sidePanelButtons .o-cf-save",
        buttonDelete: ".o-cf-delete-button",
        buttonAdd: ".o-cf-add",
        buttonReoder: ".o-cf-reorder",
        buttonExitReorder: ".o-cf-exit-reorder",
        error: ".o-cf-error",
        closePanel: ".o-sidePanelClose",
    };
    describe("Conditional format list", () => {
        beforeEach(async () => {
            model.dispatch("ADD_CONDITIONAL_FORMAT", {
                cf: createEqualCF("2", { fillColor: "#FF0000" }, "1"),
                sheetId: model.getters.getActiveSheetId(),
                target: [toZone("A1:A2")],
            });
            model.dispatch("ADD_CONDITIONAL_FORMAT", {
                cf: createColorScale("2", { type: "value", color: 0xff00ff, value: "" }, { type: "value", color: 0x123456, value: "" }),
                target: [toZone("B1:B5")],
                sheetId: model.getters.getActiveSheetId(),
            });
            await nextTick();
        });
        test("simple snapshot", () => {
            expect(fixture.querySelector(".o-sidePanel")).toMatchSnapshot();
        });
        test("the list of CF has a correct preview", () => {
            // check the html of the list (especially the colors)
            let previews = document.querySelectorAll(selectors.listPreview);
            expect(previews).toHaveLength(2);
            // --> should be the style for CellIsRule
            expect(previews[0].querySelector(selectors.description.ruletype.rule).textContent).toBe("Is equal to 2");
            expect(previews[0].querySelector(selectors.description.range).textContent).toBe("A1:A2");
            expect(window.getComputedStyle(previews[0].querySelector(selectors.previewImage)).backgroundColor).toBe("rgb(255, 0, 0)");
            // --> should be a nothing of color gradient for ColorScaleRule
            expect(previews[1].querySelector(selectors.description.range).textContent).toBe("B1:B5");
            expect(window.getComputedStyle(previews[1].querySelector(selectors.previewImage)).backgroundColor).toBe("");
            // TODO VSC: see how we can test the gradient background image
        });
        test("can edit an existing CellIsRule", async () => {
            triggerMouseEvent(document.querySelectorAll(selectors.listPreview)[0], "click");
            await nextTick();
            await nextTick();
            // change every value
            setInputValueAndTrigger(selectors.ruleEditor.range, "A1:A3", "change");
            setInputValueAndTrigger(selectors.ruleEditor.range, "A1:A3", "input");
            setInputValueAndTrigger(selectors.ruleEditor.editor.operatorInput, "BeginsWith", "change");
            setInputValueAndTrigger(selectors.ruleEditor.editor.valueInput, "3", "input");
            triggerMouseEvent(selectors.ruleEditor.editor.bold, "click");
            triggerMouseEvent(selectors.ruleEditor.editor.italic, "click");
            triggerMouseEvent(selectors.ruleEditor.editor.underline, "click");
            triggerMouseEvent(selectors.ruleEditor.editor.strikethrough, "click");
            const dispatch = spyDispatch(parent);
            //  click save
            triggerMouseEvent(selectors.buttonSave, "click");
            await nextTick();
            expect(dispatch).toHaveBeenNthCalledWith(1, "ADD_CONDITIONAL_FORMAT", {
                cf: {
                    id: "1",
                    rule: {
                        operator: "BeginsWith",
                        style: {
                            bold: true,
                            fillColor: "#FF0000",
                            italic: true,
                            strikethrough: true,
                            underline: true,
                        },
                        type: "CellIsRule",
                        values: ["3"],
                    },
                },
                target: [toZone("A1:A3")],
                sheetId: model.getters.getActiveSheetId(),
            });
        });
        test("the preview should be bold when the rule is bold", async () => {
            model.dispatch("ADD_CONDITIONAL_FORMAT", {
                cf: createEqualCF("2", { bold: true, fillColor: "#ff0000" }, "99"),
                target: [toZone("C1:C5")],
                sheetId: model.getters.getActiveSheetId(),
            });
            await nextTick();
            let previews = document.querySelectorAll(selectors.listPreview);
            let line = previews[2].querySelector(selectors.previewImage);
            expect(line.getAttribute("style")).toMatch("font-weight:bold;");
        });
        test("can edit an existing ColorScaleRule", async () => {
            triggerMouseEvent(document.querySelectorAll(selectors.listPreview)[1], "click");
            await nextTick();
            await nextTick();
            // change every value
            setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
            triggerMouseEvent(selectors.colorScaleEditor.minColor, "click");
            await nextTick();
            triggerMouseEvent(selectors.colorScaleEditor.colorPickerBlue, "click");
            triggerMouseEvent(selectors.colorScaleEditor.maxColor, "click");
            await nextTick();
            triggerMouseEvent(selectors.colorScaleEditor.colorPickerYellow, "click");
            const dispatch = spyDispatch(parent);
            //  click save
            triggerMouseEvent(selectors.buttonSave, "click");
            await nextTick();
            expect(dispatch).toHaveBeenNthCalledWith(1, "ADD_CONDITIONAL_FORMAT", {
                cf: {
                    id: "2",
                    rule: {
                        maximum: {
                            color: 0xffff00,
                            type: "value",
                            value: "",
                        },
                        minimum: {
                            color: 0x0000ff,
                            type: "value",
                            value: "",
                        },
                        type: "ColorScaleRule",
                    },
                },
                target: [toZone("B2:B5")],
                sheetId: model.getters.getActiveSheetId(),
            });
        });
        test("toggle color-picker", async () => {
            triggerMouseEvent(document.querySelectorAll(selectors.listPreview)[0], "click");
            await nextTick();
            triggerMouseEvent(document.querySelectorAll(selectors.ruleEditor.editor.colorDropdown)[0], "click");
            await nextTick();
            expect(fixture.querySelector(".o-color-picker")).toBeTruthy();
            triggerMouseEvent(document.querySelectorAll(selectors.ruleEditor.editor.colorDropdown)[0], "click");
            await nextTick();
            expect(fixture.querySelector(".o-color-picker")).toBeFalsy();
        });
        test("color-picker closes when click elsewhere", async () => {
            triggerMouseEvent(document.querySelectorAll(selectors.listPreview)[0], "click");
            await nextTick();
            triggerMouseEvent(selectors.ruleEditor.editor.colorDropdown, "click");
            await nextTick();
            expect(fixture.querySelector(".o-color-picker")).toBeTruthy();
            triggerMouseEvent(".o-cf-preview-line", "click");
            await nextTick();
            expect(fixture.querySelector(".o-color-picker")).toBeFalsy();
        });
        test("can create a new CellIsRule", async () => {
            mockUuidV4To(model, "42");
            triggerMouseEvent(selectors.buttonAdd, "click");
            await nextTick();
            await nextTick();
            // change every value
            setInputValueAndTrigger(selectors.ruleEditor.range, "A1:A3", "change");
            setInputValueAndTrigger(selectors.ruleEditor.editor.operatorInput, "BeginsWith", "change");
            await nextTick();
            setInputValueAndTrigger(selectors.ruleEditor.editor.valueInput, "3", "input");
            triggerMouseEvent(selectors.ruleEditor.editor.bold, "click");
            triggerMouseEvent(selectors.ruleEditor.editor.italic, "click");
            triggerMouseEvent(selectors.ruleEditor.editor.underline, "click");
            triggerMouseEvent(selectors.ruleEditor.editor.strikethrough, "click");
            const dispatch = spyDispatch(parent);
            //  click save
            triggerMouseEvent(selectors.buttonSave, "click");
            await nextTick();
            expect(dispatch).toHaveBeenNthCalledWith(1, "ADD_CONDITIONAL_FORMAT", {
                cf: {
                    id: "43",
                    rule: {
                        operator: "BeginsWith",
                        style: {
                            bold: true,
                            fillColor: "#b6d7a8",
                            italic: true,
                            strikethrough: true,
                            underline: true,
                        },
                        type: "CellIsRule",
                        values: ["3"],
                    },
                },
                target: [toZone("A1:A3")],
                sheetId: model.getters.getActiveSheetId(),
            });
        });
        test("cannot create a new CF with invalid range", async () => {
            triggerMouseEvent(selectors.buttonAdd, "click");
            await nextTick();
            await nextTick();
            setInputValueAndTrigger(selectors.ruleEditor.range, "hello", "change");
            const dispatch = spyDispatch(parent);
            //  click save
            triggerMouseEvent(selectors.buttonSave, "click");
            await nextTick();
            expect(dispatch).not.toHaveBeenCalledWith("ADD_CONDITIONAL_FORMAT");
            const errorString = document.querySelector(selectors.error);
            expect(errorString.textContent).toBe("The range is invalid");
        });
        test("displayed range is updated if range changes", async () => {
            const previews = document.querySelectorAll(selectors.listPreview);
            expect(previews[0].querySelector(selectors.description.range).textContent).toBe("A1:A2");
            model.dispatch("COPY", { target: [toZone("A1:A2")] });
            model.dispatch("PASTE", { target: [toZone("C1")] });
            await nextTick();
            expect(previews[0].querySelector(selectors.description.range).textContent).toBe("A1:A2,C1:C2");
        });
        test("can delete Rule", async () => {
            const dispatch = spyDispatch(parent);
            const previews = document.querySelectorAll(selectors.listPreview);
            triggerMouseEvent(previews[0].querySelector(selectors.buttonDelete), "click");
            await nextTick();
            expect(dispatch).toHaveBeenCalledWith("REMOVE_CONDITIONAL_FORMAT", {
                id: "1",
                sheetId: model.getters.getActiveSheetId(),
            });
        });
        test("can the reordering CF Rules menu be opened/closed", async () => {
            const previews = document.querySelectorAll(selectors.listPreview);
            expect(document.querySelector(selectors.buttonExitReorder)).toBeFalsy();
            expect(document.querySelector(selectors.cfReorder.buttonUp)).toBeFalsy();
            expect(document.querySelector(selectors.cfReorder.buttonDown)).toBeFalsy();
            triggerMouseEvent(selectors.buttonReoder, "click");
            await nextTick();
            expect(document.querySelector(selectors.buttonExitReorder)).toBeTruthy();
            // Minus one because top rule has no up button, bottom rule no down button
            expect(document.querySelectorAll(selectors.cfReorder.buttonUp).length).toEqual(previews.length - 1);
            expect(document.querySelectorAll(selectors.cfReorder.buttonDown).length).toEqual(previews.length - 1);
            triggerMouseEvent(selectors.buttonExitReorder, "click");
            await nextTick();
            expect(document.querySelector(selectors.buttonExitReorder)).toBeFalsy();
            expect(document.querySelector(selectors.cfReorder.buttonUp)).toBeFalsy();
            expect(document.querySelector(selectors.cfReorder.buttonDown)).toBeFalsy();
        });
        test("can reorder CF rules with up/down buttons", async () => {
            const sheetId = model.getters.getActiveSheetId();
            triggerMouseEvent(selectors.buttonReoder, "click");
            await nextTick();
            let previews = document.querySelectorAll(selectors.listPreview);
            triggerMouseEvent(previews[0].querySelector(selectors.cfReorder.buttonDown), "click");
            await nextTick();
            expect(model.getters.getConditionalFormats(sheetId)[0].id).toEqual("2");
            previews = document.querySelectorAll(selectors.listPreview);
            triggerMouseEvent(previews[1].querySelector(selectors.cfReorder.buttonUp), "click");
            await nextTick();
            expect(model.getters.getConditionalFormats(sheetId)[0].id).toEqual("1");
        });
    });
    test("can create a new ColorScaleRule with cell values", async () => {
        mockUuidV4To(model, "43");
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        triggerMouseEvent(selectors.colorScaleEditor.minColor, "click");
        await nextTick();
        triggerMouseEvent(selectors.colorScaleEditor.colorPickerBlue, "click");
        triggerMouseEvent(selectors.colorScaleEditor.maxColor, "click");
        await nextTick();
        triggerMouseEvent(selectors.colorScaleEditor.colorPickerYellow, "click");
        const dispatch = spyDispatch(parent);
        //  click save
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(dispatch).toHaveBeenCalledWith("ADD_CONDITIONAL_FORMAT", {
            cf: {
                id: "44",
                rule: {
                    maximum: {
                        color: 0xffff00,
                        type: "value",
                    },
                    minimum: {
                        color: 0x0000ff,
                        type: "value",
                    },
                    type: "ColorScaleRule",
                },
            },
            target: [toZone("B2:B5")],
            sheetId: model.getters.getActiveSheetId(),
        });
    });
    test("can create a new ColorScaleRule with fixed values", async () => {
        mockUuidV4To(model, "44");
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        triggerMouseEvent(selectors.colorScaleEditor.minColor, "click");
        await nextTick();
        triggerMouseEvent(selectors.colorScaleEditor.colorPickerBlue, "click");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, "10", "input");
        triggerMouseEvent(selectors.colorScaleEditor.maxColor, "click");
        await nextTick();
        triggerMouseEvent(selectors.colorScaleEditor.colorPickerYellow, "click");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, "20", "input");
        const dispatch = spyDispatch(parent);
        //  click save
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(dispatch).toHaveBeenCalledWith("ADD_CONDITIONAL_FORMAT", {
            cf: {
                id: "45",
                rule: {
                    maximum: {
                        color: 0xffff00,
                        type: "number",
                        value: "20",
                    },
                    minimum: {
                        color: 0x0000ff,
                        type: "number",
                        value: "10",
                    },
                    type: "ColorScaleRule",
                },
            },
            target: [toZone("B2:B5")],
            sheetId: model.getters.getActiveSheetId(),
        });
    });
    test("can create a new ColorScaleRule with percent values", async () => {
        mockUuidV4To(model, "44");
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        triggerMouseEvent(selectors.colorScaleEditor.minColor, "click");
        await nextTick();
        triggerMouseEvent(selectors.colorScaleEditor.colorPickerBlue, "click");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "percentage", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, "10", "input");
        triggerMouseEvent(selectors.colorScaleEditor.maxColor, "click");
        await nextTick();
        triggerMouseEvent(selectors.colorScaleEditor.colorPickerYellow, "click");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "percentage", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, "90", "input");
        const dispatch = spyDispatch(parent);
        //  click save
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(dispatch).toHaveBeenCalledWith("ADD_CONDITIONAL_FORMAT", {
            cf: {
                id: "45",
                rule: {
                    maximum: {
                        color: 0xffff00,
                        type: "percentage",
                        value: "90",
                    },
                    minimum: {
                        color: 0x0000ff,
                        type: "percentage",
                        value: "10",
                    },
                    type: "ColorScaleRule",
                },
            },
            target: [toZone("B2:B5")],
            sheetId: model.getters.getActiveSheetId(),
        });
    });
    test("can create a new ColorScaleRule with percentile values", async () => {
        mockUuidV4To(model, "44");
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        triggerMouseEvent(selectors.colorScaleEditor.minColor, "click");
        await nextTick();
        triggerMouseEvent(selectors.colorScaleEditor.colorPickerBlue, "click");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "percentile", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, "10", "input");
        triggerMouseEvent(selectors.colorScaleEditor.maxColor, "click");
        await nextTick();
        triggerMouseEvent(selectors.colorScaleEditor.colorPickerYellow, "click");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "percentile", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, "90", "input");
        const dispatch = spyDispatch(parent);
        //  click save
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(dispatch).toHaveBeenCalledWith("ADD_CONDITIONAL_FORMAT", {
            cf: {
                id: "45",
                rule: {
                    maximum: {
                        color: 0xffff00,
                        type: "percentile",
                        value: "90",
                    },
                    minimum: {
                        color: 0x0000ff,
                        type: "percentile",
                        value: "10",
                    },
                    type: "ColorScaleRule",
                },
            },
            target: [toZone("B2:B5")],
            sheetId: model.getters.getActiveSheetId(),
        });
    });
    test("can create a new ColorScaleRule with a midpoint", async () => {
        mockUuidV4To(model, "44");
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        triggerMouseEvent(selectors.colorScaleEditor.minColor, "click");
        await nextTick();
        triggerMouseEvent(selectors.colorScaleEditor.colorPickerBlue, "click");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, "0", "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.midType, "number", "change");
        await nextTick();
        triggerMouseEvent(selectors.colorScaleEditor.midColor, "click");
        await nextTick();
        triggerMouseEvent(selectors.colorScaleEditor.colorPickerOrange, "click");
        setInputValueAndTrigger(selectors.colorScaleEditor.midValue, "50", "input");
        triggerMouseEvent(selectors.colorScaleEditor.maxColor, "click");
        await nextTick();
        triggerMouseEvent(selectors.colorScaleEditor.colorPickerYellow, "click");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, "100", "input");
        const dispatch = spyDispatch(parent);
        //  click save
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(dispatch).toHaveBeenCalledWith("ADD_CONDITIONAL_FORMAT", {
            cf: {
                id: "45",
                rule: {
                    maximum: {
                        color: 0xffff00,
                        type: "number",
                        value: "100",
                    },
                    midpoint: {
                        color: 0xff9900,
                        type: "number",
                        value: "50",
                    },
                    minimum: {
                        color: 0x0000ff,
                        type: "number",
                        value: "0",
                    },
                    type: "ColorScaleRule",
                },
            },
            target: [toZone("B2:B5")],
            sheetId: model.getters.getActiveSheetId(),
        });
    });
    test("Make a multiple selection, open CF panel, create a rule => Should create one line per selection", async () => {
        triggerMouseEvent(selectors.closePanel, "click");
        await nextTick();
        setSelection(model, ["B2", "C3"]);
        parent.env.openSidePanel("ConditionalFormatting");
        await nextTick();
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        await nextTick();
        const ranges = document.querySelectorAll(selectors.ruleEditor.range);
        expect(ranges).toHaveLength(2);
        expect(ranges[0]["value"]).toBe("B2");
        expect(ranges[1]["value"]).toBe("C3");
    });
    test("Open CF panel, make a multiple selection, open CF panel, create a rule => Should create one line per selection", async () => {
        setSelection(model, ["B2", "C3"]);
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        const ranges = document.querySelectorAll(selectors.ruleEditor.range);
        expect(ranges).toHaveLength(2);
        expect(ranges[0]["value"]).toBe("B2");
        expect(ranges[1]["value"]).toBe("C3");
    });
    test("switching sheet resets CF Editor to list", async () => {
        triggerMouseEvent(selectors.closePanel, "click");
        model.dispatch("ADD_CONDITIONAL_FORMAT", {
            cf: createEqualCF("2", { bold: true, fillColor: "#ff0000" }, "99"),
            target: [toZone("A1:A2")],
            sheetId: model.getters.getActiveSheetId(),
        });
        createSheet(model, { sheetId: "42" });
        await nextTick();
        const zone = toZone("A1:A2");
        parent.env.openSidePanel("ConditionalFormatting", { selection: [zone] });
        await nextTick();
        expect(fixture.querySelector(selectors.listPreview)).toBeNull();
        expect(fixture.querySelector(selectors.ruleEditor.range).value).toBe("A1:A2");
        activateSheet(model, "42");
        await nextTick();
        expect(fixture.querySelector(selectors.ruleEditor.range)).toBeNull();
        expect(fixture.querySelector(selectors.listPreview)).toBeDefined();
    });
    test("error if range is empty", async () => {
        var _a;
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        await nextTick();
        setInputValueAndTrigger(selectors.ruleEditor.range, "", "change");
        await nextTick();
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(errorMessages()).toEqual(["A range needs to be defined"]);
        expect((_a = fixture.querySelector(selectors.ruleEditor.range)) === null || _a === void 0 ? void 0 : _a.className).toContain("o-invalid");
    });
    test("will not dispatch if minvalue > maxvalue", async () => {
        var _a, _b, _c;
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, "20", "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, "10", "input");
        expect(errorMessages()).toHaveLength(0);
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(model.getters.getConditionalFormats(model.getters.getActiveSheetId())).toHaveLength(0);
        expect(errorMessages()).toEqual(["Minimum must be smaller then Maximum"]);
        expect((_a = fixture.querySelector(selectors.colorScaleEditor.minValue)) === null || _a === void 0 ? void 0 : _a.className).toContain("o-invalid");
        expect((_b = fixture.querySelector(selectors.colorScaleEditor.midValue)) === null || _b === void 0 ? void 0 : _b.className).not.toContain("o-invalid");
        expect((_c = fixture.querySelector(selectors.colorScaleEditor.maxValue)) === null || _c === void 0 ? void 0 : _c.className).not.toContain("o-invalid");
    });
    test("will show error if minvalue > midvalue", async () => {
        var _a, _b, _c;
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, "60", "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.midType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.midValue, "50", "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, "10", "input");
        expect(errorMessages()).toHaveLength(0);
        //  click save
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(model.getters.getConditionalFormats(model.getters.getActiveSheetId())).toHaveLength(0);
        expect(errorMessages()).toEqual([
            "Minimum must be smaller then Maximum",
            "Minimum must be smaller then Midpoint",
            "Midpoint must be smaller then Maximum",
        ]);
        expect((_a = fixture.querySelector(selectors.colorScaleEditor.minValue)) === null || _a === void 0 ? void 0 : _a.className).toContain("o-invalid");
        expect((_b = fixture.querySelector(selectors.colorScaleEditor.midValue)) === null || _b === void 0 ? void 0 : _b.className).toContain("o-invalid");
        expect((_c = fixture.querySelector(selectors.colorScaleEditor.maxValue)) === null || _c === void 0 ? void 0 : _c.className).not.toContain("o-invalid");
    });
    test("will show error if midvalue > maxvalue", async () => {
        var _a, _b, _c;
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "number", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.midType, "number", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, "0", "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.midValue, "50", "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, "25", "input");
        await nextTick();
        expect(errorMessages()).toHaveLength(0);
        //  click save
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(model.getters.getConditionalFormats(model.getters.getActiveSheetId())).toHaveLength(0);
        expect(errorMessages()).toEqual(["Midpoint must be smaller then Maximum"]);
        expect((_a = fixture.querySelector(selectors.colorScaleEditor.minValue)) === null || _a === void 0 ? void 0 : _a.className).not.toContain("o-invalid");
        expect((_b = fixture.querySelector(selectors.colorScaleEditor.midValue)) === null || _b === void 0 ? void 0 : _b.className).toContain("o-invalid");
        expect((_c = fixture.querySelector(selectors.colorScaleEditor.maxValue)) === null || _c === void 0 ? void 0 : _c.className).not.toContain("o-invalid");
    });
    test.each(["", "aaaa", "=SUM(1, 2)"])("will display error if wrong minValue", async (invalidValue) => {
        var _a, _b, _c;
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "number", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.midType, "none", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, invalidValue, "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, "25", "input");
        await nextTick();
        expect(errorMessages()).toHaveLength(0);
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(model.getters.getConditionalFormats(model.getters.getActiveSheetId())).toHaveLength(0);
        expect(errorMessages()).toEqual(["The minpoint must be a number"]);
        expect((_a = fixture.querySelector(selectors.colorScaleEditor.minValue)) === null || _a === void 0 ? void 0 : _a.className).toContain("o-invalid");
        expect((_b = fixture.querySelector(selectors.colorScaleEditor.midValue)) === null || _b === void 0 ? void 0 : _b.className).not.toContain("o-invalid");
        expect((_c = fixture.querySelector(selectors.colorScaleEditor.maxValue)) === null || _c === void 0 ? void 0 : _c.className).not.toContain("o-invalid");
    });
    test.each(["", "aaaa", "=SUM(1, 2)"])("will display error if wrong midValue", async (invalidValue) => {
        var _a, _b, _c;
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "number", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.midType, "number", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, "10", "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.midValue, invalidValue, "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, "25", "input");
        await nextTick();
        expect(errorMessages()).toHaveLength(0);
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(model.getters.getConditionalFormats(model.getters.getActiveSheetId())).toHaveLength(0);
        expect(errorMessages()).toEqual(["The midpoint must be a number"]);
        expect((_a = fixture.querySelector(selectors.colorScaleEditor.minValue)) === null || _a === void 0 ? void 0 : _a.className).not.toContain("o-invalid");
        expect((_b = fixture.querySelector(selectors.colorScaleEditor.midValue)) === null || _b === void 0 ? void 0 : _b.className).toContain("o-invalid");
        expect((_c = fixture.querySelector(selectors.colorScaleEditor.maxValue)) === null || _c === void 0 ? void 0 : _c.className).not.toContain("o-invalid");
    });
    test.each(["", "aaaa", "=SUM(1, 2)"])("will display error if wrong maxValue", async (invalidValue) => {
        var _a, _b, _c;
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "number", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.midType, "none", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, "1", "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, invalidValue, "input");
        await nextTick();
        expect(errorMessages()).toHaveLength(0);
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(model.getters.getConditionalFormats(model.getters.getActiveSheetId())).toHaveLength(0);
        expect(errorMessages()).toEqual(["The maxpoint must be a number"]);
        expect((_a = fixture.querySelector(selectors.colorScaleEditor.minValue)) === null || _a === void 0 ? void 0 : _a.className).not.toContain("o-invalid");
        expect((_b = fixture.querySelector(selectors.colorScaleEditor.midValue)) === null || _b === void 0 ? void 0 : _b.className).not.toContain("o-invalid");
        expect((_c = fixture.querySelector(selectors.colorScaleEditor.maxValue)) === null || _c === void 0 ? void 0 : _c.className).toContain("o-invalid");
    });
    test("will display error if there is an invalid formula for the min", async () => {
        var _a, _b, _c;
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "formula", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.midType, "none", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "formula", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, "=SUM(1", "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, "=SUM(1,2)", "input");
        await nextTick();
        expect(errorMessages()).toHaveLength(0);
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(model.getters.getConditionalFormats(model.getters.getActiveSheetId())).toHaveLength(0);
        expect(errorMessages()).toEqual(["Invalid Minpoint formula"]);
        expect((_a = fixture.querySelector(selectors.colorScaleEditor.minValue)) === null || _a === void 0 ? void 0 : _a.className).toContain("o-invalid");
        expect((_b = fixture.querySelector(selectors.colorScaleEditor.midValue)) === null || _b === void 0 ? void 0 : _b.className).not.toContain("o-invalid");
        expect((_c = fixture.querySelector(selectors.colorScaleEditor.maxValue)) === null || _c === void 0 ? void 0 : _c.className).not.toContain("o-invalid");
    });
    test("will display error if there is an invalid formula for the mid", async () => {
        var _a, _b, _c;
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "number", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.midType, "formula", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "number", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, "1", "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.midValue, "=SUM(1", "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, "3", "input");
        await nextTick();
        expect(errorMessages()).toHaveLength(0);
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(model.getters.getConditionalFormats(model.getters.getActiveSheetId())).toHaveLength(0);
        expect(errorMessages()).toEqual(["Invalid Midpoint formula"]);
        expect((_a = fixture.querySelector(selectors.colorScaleEditor.minValue)) === null || _a === void 0 ? void 0 : _a.className).not.toContain("o-invalid");
        expect((_b = fixture.querySelector(selectors.colorScaleEditor.midValue)) === null || _b === void 0 ? void 0 : _b.className).toContain("o-invalid");
        expect((_c = fixture.querySelector(selectors.colorScaleEditor.maxValue)) === null || _c === void 0 ? void 0 : _c.className).not.toContain("o-invalid");
    });
    test("single color missing a single value", async () => {
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        setInputValueAndTrigger(selectors.ruleEditor.editor.operatorInput, "GreaterThan", "change");
        expect(fixture.querySelector(".o-invalid")).toBeNull();
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(fixture.querySelector(".o-invalid")).not.toBeNull();
        expect(errorMessages()).toEqual(["The argument is missing. Please provide a value"]);
    });
    test("single color missing two values", async () => {
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        setInputValueAndTrigger(selectors.ruleEditor.editor.operatorInput, "Between", "change");
        expect(fixture.querySelector(".o-invalid")).toBeNull();
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect([...fixture.querySelectorAll(".o-invalid")]).toHaveLength(2);
        expect(errorMessages()).toEqual([
            "The argument is missing. Please provide a value",
            "The second argument is missing. Please provide a value",
        ]);
        setInputValueAndTrigger(selectors.ruleEditor.editor.valueInput, "25", "input");
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect([...fixture.querySelectorAll(".o-invalid")]).toHaveLength(1);
        expect(errorMessages()).toEqual(["The second argument is missing. Please provide a value"]);
    });
    test("changing rule type resets errors", async () => {
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        setInputValueAndTrigger(selectors.ruleEditor.editor.operatorInput, "GreaterThan", "change");
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(errorMessages()).not.toHaveLength(0);
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        expect(errorMessages()).toHaveLength(0);
        expect([...fixture.querySelectorAll(".o-invalid")]).toHaveLength(0);
    });
    test("will display error if there is an invalid formula for the max", async () => {
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        // change every value
        setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.minType, "formula", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.midType, "none", "change");
        setInputValueAndTrigger(selectors.colorScaleEditor.maxType, "formula", "change");
        await nextTick();
        setInputValueAndTrigger(selectors.colorScaleEditor.maxValue, "=SUM(1", "input");
        setInputValueAndTrigger(selectors.colorScaleEditor.minValue, "=SUM(1,2)", "input");
        await nextTick();
        expect(errorMessages()).toHaveLength(0);
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(model.getters.getConditionalFormats(model.getters.getActiveSheetId())).toHaveLength(0);
        expect(errorMessages()).toEqual(["Invalid Maxpoint formula"]);
    });
    describe("Icon set CF", () => {
        test("can select the Icon set tab", async () => {
            triggerMouseEvent(selectors.buttonAdd, "click");
            await nextTick();
            triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[2], "click");
            await nextTick();
            expect(document.querySelector(selectors.ruleEditor.editor.iconSetRule.container)).toBeDefined();
        });
        test("can apply different iconSet", async () => {
            triggerMouseEvent(selectors.buttonAdd, "click");
            await nextTick();
            triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[2], "click");
            await nextTick();
            let icons = document.querySelectorAll(selectors.ruleEditor.editor.iconSetRule.icons);
            expect(icons[0].classList.value).toBe("o-cf-icon arrow-up");
            expect(icons[1].classList.value).toBe("o-cf-icon arrow-right");
            expect(icons[2].classList.value).toBe("o-cf-icon arrow-down");
            triggerMouseEvent(document.querySelectorAll(selectors.ruleEditor.editor.iconSetRule.iconsets)[1], "click");
            await nextTick();
            icons = document.querySelectorAll(selectors.ruleEditor.editor.iconSetRule.icons);
            expect(icons[0].classList.value).toBe("o-cf-icon smile");
            expect(icons[1].classList.value).toBe("o-cf-icon meh");
            expect(icons[2].classList.value).toBe("o-cf-icon frown");
            triggerMouseEvent(document.querySelectorAll(selectors.ruleEditor.editor.iconSetRule.iconsets)[2], "click");
            await nextTick();
            icons = document.querySelectorAll(selectors.ruleEditor.editor.iconSetRule.icons);
            expect(icons[0].classList.value).toBe("o-cf-icon green-dot");
            expect(icons[1].classList.value).toBe("o-cf-icon yellow-dot");
            expect(icons[2].classList.value).toBe("o-cf-icon red-dot");
        });
        test("inverse checkbox will inverse icons", async () => {
            triggerMouseEvent(selectors.buttonAdd, "click");
            await nextTick();
            triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[2], "click");
            await nextTick();
            let icons = document.querySelectorAll(selectors.ruleEditor.editor.iconSetRule.icons);
            expect(icons[0].classList.value).toBe("o-cf-icon arrow-up");
            expect(icons[1].classList.value).toBe("o-cf-icon arrow-right");
            expect(icons[2].classList.value).toBe("o-cf-icon arrow-down");
            triggerMouseEvent(selectors.ruleEditor.editor.iconSetRule.reverse, "click");
            await nextTick();
            icons = document.querySelectorAll(selectors.ruleEditor.editor.iconSetRule.icons);
            expect(icons[2].classList.value).toBe("o-cf-icon arrow-up");
            expect(icons[1].classList.value).toBe("o-cf-icon arrow-right");
            expect(icons[0].classList.value).toBe("o-cf-icon arrow-down");
        });
        test("can create a new IconsetRule", async () => {
            mockUuidV4To(model, "44");
            triggerMouseEvent(selectors.buttonAdd, "click");
            await nextTick();
            triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[2], "click");
            await nextTick();
            // change every value
            setInputValueAndTrigger(selectors.ruleEditor.range, "B2:B5", "change");
            const dispatch = spyDispatch(parent);
            //  click save
            triggerMouseEvent(selectors.buttonSave, "click");
            await nextTick();
            expect(dispatch).toHaveBeenCalledWith("ADD_CONDITIONAL_FORMAT", {
                cf: {
                    id: "45",
                    rule: {
                        type: "IconSetRule",
                        icons: {
                            lower: "arrowBad",
                            middle: "arrowNeutral",
                            upper: "arrowGood",
                        },
                        lowerInflectionPoint: {
                            operator: "gt",
                            type: "percentage",
                            value: "33",
                        },
                        upperInflectionPoint: {
                            operator: "gt",
                            type: "percentage",
                            value: "66",
                        },
                    },
                },
                target: [toZone("B2:B5")],
                sheetId: model.getters.getActiveSheetId(),
            });
        });
        test("can change inputs", async () => {
            mockUuidV4To(model, "44");
            triggerMouseEvent(selectors.buttonAdd, "click");
            await nextTick();
            triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[2], "click");
            await nextTick();
            const rows = document.querySelectorAll(selectors.ruleEditor.editor.iconSetRule.rows);
            const typeinflectionLower = rows[1].querySelectorAll("select")[1];
            const operatorinflectionLower = rows[1].querySelectorAll("select")[0];
            const inputinflectionLower = rows[1].querySelectorAll("input")[0];
            const typeinflectionUpper = rows[2].querySelectorAll("select")[1];
            const operatorinflectionUpper = rows[2].querySelectorAll("select")[0];
            const inputinflectionUpper = rows[2].querySelectorAll("input")[0];
            setInputValueAndTrigger(typeinflectionLower, "number", "change");
            await nextTick();
            setInputValueAndTrigger(operatorinflectionLower, "ge", "change");
            await nextTick();
            setInputValueAndTrigger(inputinflectionLower, "10", "input");
            await nextTick();
            setInputValueAndTrigger(typeinflectionUpper, "number", "change");
            await nextTick();
            setInputValueAndTrigger(operatorinflectionUpper, "ge", "change");
            await nextTick();
            setInputValueAndTrigger(inputinflectionUpper, "0", "input");
            await nextTick();
            const dispatch = spyDispatch(parent);
            //  click save
            triggerMouseEvent(selectors.buttonSave, "click");
            await nextTick();
            expect(dispatch).toHaveBeenCalledWith("ADD_CONDITIONAL_FORMAT", {
                cf: {
                    id: "45",
                    rule: {
                        type: "IconSetRule",
                        icons: {
                            lower: "arrowBad",
                            middle: "arrowNeutral",
                            upper: "arrowGood",
                        },
                        lowerInflectionPoint: {
                            operator: "ge",
                            type: "number",
                            value: "0",
                        },
                        upperInflectionPoint: {
                            operator: "ge",
                            type: "number",
                            value: "10",
                        },
                    },
                },
                target: [toZone("A1")],
                sheetId: model.getters.getActiveSheetId(),
            });
        });
    });
    test("can change one icon", async () => {
        mockUuidV4To(model, "44");
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[2], "click");
        await nextTick();
        const middleRow = document.querySelectorAll(".o-inflection tr")[2];
        const middleIcon = middleRow.querySelectorAll("div")[0];
        triggerMouseEvent(middleIcon, "click");
        await nextTick();
        const newIcon = document.querySelectorAll(".o-icon-picker-item")[7];
        triggerMouseEvent(newIcon, "click");
        await nextTick();
        const dispatch = spyDispatch(parent);
        //  click save
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(dispatch).toHaveBeenCalledWith("ADD_CONDITIONAL_FORMAT", {
            cf: {
                id: "45",
                rule: {
                    type: "IconSetRule",
                    icons: {
                        lower: "arrowBad",
                        middle: "dotNeutral",
                        upper: "arrowGood",
                    },
                    lowerInflectionPoint: {
                        operator: "gt",
                        type: "percentage",
                        value: "33",
                    },
                    upperInflectionPoint: {
                        operator: "gt",
                        type: "percentage",
                        value: "66",
                    },
                },
            },
            target: [toZone("A1")],
            sheetId: model.getters.getActiveSheetId(),
        });
    });
    test.each([
        [40 /* ValueLowerInflectionNaN */, "The second value must be a number"],
        [45 /* ValueLowerInvalidFormula */, "Invalid lower inflection point formula"],
        [45 /* ValueLowerInvalidFormula */, "Invalid lower inflection point formula"],
    ])("Show right lowerInflection point error message (Command result: %s , Message: %s)", async (error, errorMessage) => {
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[2], "click");
        await nextTick();
        const cfPlugin = getPlugin(parent.model, ConditionalFormatPlugin);
        cfPlugin.allowDispatch = jest.fn(() => error);
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        const rows = document.querySelectorAll(selectors.ruleEditor.editor.iconSetRule.rows);
        const inputInflectionLower = rows[1].querySelectorAll("input")[0];
        const inputInflectionUpper = rows[2].querySelectorAll("input")[0];
        expect(inputInflectionUpper.classList).toContain("o-invalid");
        expect(inputInflectionLower.classList).not.toContain("o-invalid");
        expect(errorMessages()).toEqual([errorMessage]);
    });
    test.each([
        [39 /* ValueUpperInflectionNaN */, "The first value must be a number"],
        [44 /* ValueUpperInvalidFormula */, "Invalid upper inflection point formula"],
    ])("Show right upperInflection point error message (Command result: %s , Message: %s)", async (error, errorMessage) => {
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[2], "click");
        await nextTick();
        const cfPlugin = getPlugin(parent.model, ConditionalFormatPlugin);
        cfPlugin.allowDispatch = jest.fn(() => error);
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        const rows = document.querySelectorAll(selectors.ruleEditor.editor.iconSetRule.rows);
        const inputInflectionLower = rows[1].querySelectorAll("input")[0];
        const inputInflectionUpper = rows[2].querySelectorAll("input")[0];
        expect(inputInflectionUpper.classList).not.toContain("o-invalid");
        expect(inputInflectionLower.classList).toContain("o-invalid");
        expect(errorMessages()).toEqual([errorMessage]);
    });
    test("display both inflection point errors", async () => {
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[2], "click");
        await nextTick();
        const rows = document.querySelectorAll(selectors.ruleEditor.editor.iconSetRule.rows);
        const inputInflectionLower = rows[1].querySelectorAll("input")[0];
        const inputInflectionUpper = rows[2].querySelectorAll("input")[0];
        setInputValueAndTrigger(inputInflectionLower, "hello", "input");
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(inputInflectionLower.classList).toContain("o-invalid");
        expect(inputInflectionUpper.classList).not.toContain("o-invalid");
        expect(errorMessages()).toEqual(["The first value must be a number"]);
        setInputValueAndTrigger(inputInflectionUpper, "hello", "input");
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(inputInflectionLower.classList).toContain("o-invalid");
        expect(inputInflectionUpper.classList).toContain("o-invalid");
        expect(errorMessages()).toEqual([
            "The second value must be a number",
            "The first value must be a number",
        ]);
    });
    test("lower point bigger than upper displays both input as invalid", async () => {
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[2], "click");
        await nextTick();
        const rows = document.querySelectorAll(selectors.ruleEditor.editor.iconSetRule.rows);
        const inputInflectionLower = rows[1].querySelectorAll("input")[0];
        const inputInflectionUpper = rows[2].querySelectorAll("input")[0];
        setInputValueAndTrigger(inputInflectionUpper, "10", "input");
        await nextTick();
        setInputValueAndTrigger(inputInflectionLower, "1", "input");
        await nextTick();
        triggerMouseEvent(selectors.buttonSave, "click");
        await nextTick();
        expect(inputInflectionLower.classList).toContain("o-invalid");
        expect(inputInflectionUpper.classList).toContain("o-invalid");
        expect(errorMessages()).toEqual([
            "Lower inflection point must be smaller then upper inflection point",
        ]);
    });
    test("Configuration is locally saved when switching cf type", async () => {
        triggerMouseEvent(selectors.buttonAdd, "click");
        await nextTick();
        setInputValueAndTrigger(selectors.ruleEditor.editor.operatorInput, "BeginsWith", "change");
        await nextTick();
        expect(document.querySelector(`${selectors.ruleEditor.editor.operatorInput} option:checked`).value).toBe("BeginsWith");
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[1], "click");
        await nextTick();
        triggerMouseEvent(document.querySelectorAll(selectors.cfTabSelector)[0], "click");
        await nextTick();
        expect(document.querySelector(`${selectors.ruleEditor.editor.operatorInput} option:checked`).value).toBe("BeginsWith");
    });
});
//# sourceMappingURL=conditional_formatting.test.js.map