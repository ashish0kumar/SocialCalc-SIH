import { transform } from "../../../src/collaborative/ot/ot";
import { toZone } from "../../../src/helpers";
import { createEqualCF, target } from "../../test_helpers/helpers";
describe("OT with DELETE_SHEET", () => {
    const deletedSheetId = "deletedSheet";
    const sheetId = "stillPresent";
    const deleteSheet = { type: "DELETE_SHEET", sheetId: deletedSheetId };
    const updateCell = { type: "UPDATE_CELL", col: 0, row: 0 };
    const updateCellPosition = {
        type: "UPDATE_CELL_POSITION",
        col: 0,
        row: 0,
        cellId: "ID",
    };
    const clearCell = { type: "CLEAR_CELL", col: 0, row: 0 };
    const deleteContent = {
        type: "DELETE_CONTENT",
        target: [toZone("A1")],
    };
    const addColumns = {
        type: "ADD_COLUMNS_ROWS",
        dimension: "COL",
        base: 0,
        position: "after",
        quantity: 1,
    };
    const addRows = {
        type: "ADD_COLUMNS_ROWS",
        dimension: "ROW",
        base: 1,
        position: "after",
        quantity: 1,
    };
    const removeColumn = {
        type: "REMOVE_COLUMNS_ROWS",
        dimension: "COL",
        elements: [0],
    };
    const removeRows = {
        type: "REMOVE_COLUMNS_ROWS",
        elements: [0],
        dimension: "ROW",
    };
    const addMerge = { type: "ADD_MERGE", target: target("A1:B1") };
    const removeMerge = {
        type: "REMOVE_MERGE",
        target: target("A1:B1"),
    };
    const moveSheet = { type: "MOVE_SHEET", direction: "left" };
    const renameSheet = { type: "RENAME_SHEET", name: "test" };
    const addCF = {
        type: "ADD_CONDITIONAL_FORMAT",
        cf: createEqualCF("test", { fillColor: "orange" }, "id"),
        target: [toZone("A1:B1")],
    };
    const createFigure = {
        type: "CREATE_FIGURE",
        figure: {},
    };
    const setFormatting = {
        type: "SET_FORMATTING",
        target: [toZone("A1")],
    };
    const clearFormatting = {
        type: "CLEAR_FORMATTING",
        target: [toZone("A1")],
    };
    const setBorder = {
        type: "SET_BORDER",
        col: 0,
        row: 0,
        border: undefined,
    };
    const setDecimal = {
        type: "SET_DECIMAL",
        target: [toZone("A1")],
        step: 3,
    };
    const createChart = {
        type: "CREATE_CHART",
        id: "1",
        definition: {},
    };
    const resizeColumns = {
        type: "RESIZE_COLUMNS_ROWS",
        dimension: "COL",
        elements: [1],
        size: 10,
    };
    const resizeRows = {
        type: "RESIZE_COLUMNS_ROWS",
        dimension: "ROW",
        elements: [1],
        size: 10,
    };
    const removeConditionalFormatting = {
        type: "REMOVE_CONDITIONAL_FORMAT",
        id: "789",
    };
    const otherDeleteSheet = {
        type: "DELETE_SHEET",
    };
    describe.each([
        updateCell,
        updateCellPosition,
        clearCell,
        deleteContent,
        addColumns,
        addRows,
        removeColumn,
        removeRows,
        addMerge,
        removeMerge,
        moveSheet,
        renameSheet,
        addCF,
        createFigure,
        setFormatting,
        clearFormatting,
        setBorder,
        setDecimal,
        createChart,
        resizeColumns,
        resizeRows,
        removeConditionalFormatting,
        otherDeleteSheet,
    ])("Delete sheet", (cmd) => {
        test("Delete the sheet on which the command is triggered", () => {
            const result = transform({ ...cmd, sheetId: deletedSheetId }, deleteSheet);
            expect(result).toBeUndefined();
        });
        test("Delete the sheet on which the command is triggered", () => {
            const command = { ...cmd, sheetId };
            const result = transform(command, deleteSheet);
            expect(result).toEqual(command);
        });
    });
    describe("Delete sheet with duplicate sheet", () => {
        const cmd = {
            type: "DUPLICATE_SHEET",
            sheetIdTo: "sheetIdTo",
        };
        test("Delete the sheet on which the command is triggered", () => {
            const result = transform({ ...cmd, sheetId: deletedSheetId }, deleteSheet);
            expect(result).toBeUndefined();
        });
        test("Delete the sheet on which the command is triggered", () => {
            const command = { ...cmd, sheetId: sheetId };
            const result = transform(command, deleteSheet);
            expect(result).toEqual(command);
        });
    });
});
//# sourceMappingURL=ot_sheet_deleted.test.js.map