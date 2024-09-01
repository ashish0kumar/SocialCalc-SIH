import { FORBIDDEN_IN_EXCEL_REGEX } from "../../constants";
import { createCols, createDefaultCols, createDefaultRows, createRows, exportCols, exportRows, getUnquotedSheetName, groupConsecutive, isDefined, isZoneInside, isZoneValid, numberToLetters, positions, toCartesian, } from "../../helpers/index";
import { _lt, _t } from "../../translation";
import { CorePlugin } from "../core_plugin";
export class SheetPlugin extends CorePlugin {
    constructor() {
        super(...arguments);
        this.sheetIds = {};
        this.visibleSheets = []; // ids of visible sheets
        this.sheets = {};
        this.cellPosition = {};
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    allowDispatch(cmd) {
        const genericChecks = this.chainValidations(this.checkSheetExists, this.checkZones)(cmd);
        if (genericChecks !== 0 /* Success */) {
            return genericChecks;
        }
        switch (cmd.type) {
            case "CREATE_SHEET": {
                const { visibleSheets } = this;
                if (cmd.position > visibleSheets.length || cmd.position < 0) {
                    return 13 /* WrongSheetPosition */;
                }
                return 0 /* Success */;
            }
            case "MOVE_SHEET":
                const currentIndex = this.visibleSheets.findIndex((id) => id === cmd.sheetId);
                return (cmd.direction === "left" && currentIndex === 0) ||
                    (cmd.direction === "right" && currentIndex === this.visibleSheets.length - 1)
                    ? 12 /* WrongSheetMove */
                    : 0 /* Success */;
            case "RENAME_SHEET":
                return this.isRenameAllowed(cmd);
            case "DELETE_SHEET":
                return this.visibleSheets.length > 1
                    ? 0 /* Success */
                    : 8 /* NotEnoughSheets */;
            case "REMOVE_COLUMNS_ROWS":
                const sheet = this.getSheet(cmd.sheetId);
                const length = cmd.dimension === "COL" ? sheet.cols.length : sheet.rows.length;
                return length > cmd.elements.length
                    ? 0 /* Success */
                    : 7 /* NotEnoughElements */;
            case "HIDE_COLUMNS_ROWS": {
                const sheet = this.sheets[cmd.sheetId];
                const hiddenGroup = cmd.dimension === "COL" ? sheet.hiddenColsGroups : sheet.hiddenRowsGroups;
                const elements = cmd.dimension === "COL" ? sheet.cols : sheet.rows;
                return (hiddenGroup || []).flat().concat(cmd.elements).length < elements.length
                    ? 0 /* Success */
                    : 49 /* TooManyHiddenElements */;
            }
            default:
                return 0 /* Success */;
        }
    }
    handle(cmd) {
        switch (cmd.type) {
            case "SET_GRID_LINES_VISIBILITY":
                this.setGridLinesVisibility(cmd.sheetId, cmd.areGridLinesVisible);
                break;
            case "DELETE_CONTENT":
                this.clearZones(cmd.sheetId, cmd.target);
                break;
            case "CREATE_SHEET":
                const sheet = this.createSheet(cmd.sheetId, this.generateSheetName(), cmd.cols || 26, cmd.rows || 100, cmd.position);
                this.history.update("sheetIds", sheet.name, sheet.id);
                break;
            case "RESIZE_COLUMNS_ROWS":
                const dimension = cmd.dimension === "COL" ? "cols" : "rows";
                for (let elt of cmd.elements) {
                    this.setHeaderSize(this.getSheet(cmd.sheetId), dimension, elt, cmd.size);
                }
                break;
            case "MOVE_SHEET":
                this.moveSheet(cmd.sheetId, cmd.direction);
                break;
            case "RENAME_SHEET":
                this.renameSheet(this.sheets[cmd.sheetId], cmd.name);
                break;
            case "DUPLICATE_SHEET":
                this.duplicateSheet(cmd.sheetId, cmd.sheetIdTo);
                break;
            case "DELETE_SHEET":
                this.deleteSheet(this.sheets[cmd.sheetId]);
                break;
            case "REMOVE_COLUMNS_ROWS":
                if (cmd.dimension === "COL") {
                    this.removeColumns(this.sheets[cmd.sheetId], [...cmd.elements]);
                }
                else {
                    this.removeRows(this.sheets[cmd.sheetId], [...cmd.elements]);
                }
                break;
            case "ADD_COLUMNS_ROWS":
                if (cmd.dimension === "COL") {
                    this.addColumns(this.sheets[cmd.sheetId], cmd.base, cmd.position, cmd.quantity);
                }
                else {
                    this.addRows(this.sheets[cmd.sheetId], cmd.base, cmd.position, cmd.quantity);
                }
                break;
            case "HIDE_COLUMNS_ROWS": {
                if (cmd.dimension === "COL") {
                    this.setElementsVisibility(this.sheets[cmd.sheetId], cmd.elements, "cols", "hide");
                }
                else {
                    this.setElementsVisibility(this.sheets[cmd.sheetId], cmd.elements, "rows", "hide");
                }
                break;
            }
            case "UNHIDE_COLUMNS_ROWS": {
                if (cmd.dimension === "COL") {
                    this.setElementsVisibility(this.sheets[cmd.sheetId], cmd.elements, "cols", "show");
                }
                else {
                    this.setElementsVisibility(this.sheets[cmd.sheetId], cmd.elements, "rows", "show");
                }
                break;
            }
            case "UPDATE_CELL_POSITION":
                this.updateCellPosition(cmd);
                break;
        }
    }
    // ---------------------------------------------------------------------------
    // Import/Export
    // ---------------------------------------------------------------------------
    import(data) {
        // we need to fill the sheetIds mapping first, because otherwise formulas
        // that depends on a sheet not already imported will not be able to be
        // compiled
        for (let sheet of data.sheets) {
            this.sheetIds[sheet.name] = sheet.id;
        }
        for (let sheetData of data.sheets) {
            const name = sheetData.name || _t("Sheet") + (Object.keys(this.sheets).length + 1);
            const { colNumber, rowNumber } = this.getImportedSheetSize(sheetData);
            const sheet = {
                id: sheetData.id,
                name: name,
                cols: createCols(sheetData.cols || {}, colNumber),
                rows: createRows(sheetData.rows || {}, rowNumber),
                hiddenColsGroups: [],
                hiddenRowsGroups: [],
                areGridLinesVisible: sheetData.areGridLinesVisible === undefined ? true : sheetData.areGridLinesVisible,
            };
            this.visibleSheets.push(sheet.id);
            this.sheets[sheet.id] = sheet;
            this.updateHiddenElementsGroups(sheet.id, "cols");
            this.updateHiddenElementsGroups(sheet.id, "rows");
        }
    }
    exportSheets(data, exportDefaultSizes = false) {
        data.sheets = this.visibleSheets.filter(isDefined).map((id) => {
            const sheet = this.sheets[id];
            return {
                id: sheet.id,
                name: sheet.name,
                colNumber: sheet.cols.length,
                rowNumber: sheet.rows.length,
                rows: exportRows(sheet.rows, exportDefaultSizes),
                cols: exportCols(sheet.cols, exportDefaultSizes),
                merges: [],
                cells: {},
                conditionalFormats: [],
                figures: [],
                areGridLinesVisible: sheet.areGridLinesVisible === undefined ? true : sheet.areGridLinesVisible,
            };
        });
    }
    export(data) {
        this.exportSheets(data);
    }
    exportForExcel(data) {
        this.exportSheets(data, true);
    }
    // ---------------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------------
    getGridLinesVisibility(sheetId) {
        return this.getSheet(sheetId).areGridLinesVisible;
    }
    tryGetSheet(sheetId) {
        return this.sheets[sheetId];
    }
    getSheet(sheetId) {
        const sheet = this.sheets[sheetId];
        if (!sheet) {
            throw new Error(`Sheet ${sheetId} not found.`);
        }
        return sheet;
    }
    /**
     * Return the sheet name. Throw if the sheet is not found.
     */
    getSheetName(sheetId) {
        return this.getSheet(sheetId).name;
    }
    getCellsInZone(sheetId, zone) {
        return positions(zone).map(([col, row]) => this.getCell(sheetId, col, row));
    }
    /**
     * Return the sheet name or undefined if the sheet doesn't exist.
     */
    tryGetSheetName(sheetId) {
        var _a;
        return (_a = this.tryGetSheet(sheetId)) === null || _a === void 0 ? void 0 : _a.name;
    }
    getSheetIdByName(name) {
        if (name) {
            const unquotedName = getUnquotedSheetName(name);
            for (const key in this.sheetIds) {
                if (key.toUpperCase() === unquotedName.toUpperCase()) {
                    return this.sheetIds[key];
                }
            }
        }
        return undefined;
    }
    getSheets() {
        const { visibleSheets, sheets } = this;
        return visibleSheets.map((id) => sheets[id]).filter(isDefined);
    }
    getVisibleSheets() {
        return this.visibleSheets;
    }
    getEvaluationSheets() {
        return this.sheets;
    }
    tryGetCol(sheetId, index) {
        var _a;
        return (_a = this.sheets[sheetId]) === null || _a === void 0 ? void 0 : _a.cols[index];
    }
    getCol(sheetId, index) {
        const col = this.getSheet(sheetId).cols[index];
        if (!col) {
            throw new Error(`Col ${col} not found.`);
        }
        return col;
    }
    tryGetRow(sheetId, index) {
        var _a;
        return (_a = this.sheets[sheetId]) === null || _a === void 0 ? void 0 : _a.rows[index];
    }
    getRow(sheetId, index) {
        const row = this.getSheet(sheetId).rows[index];
        if (!row) {
            throw new Error(`Row ${row} not found.`);
        }
        return row;
    }
    getCell(sheetId, col, row) {
        var _a;
        const sheet = this.tryGetSheet(sheetId);
        const cellId = (_a = sheet === null || sheet === void 0 ? void 0 : sheet.rows[row]) === null || _a === void 0 ? void 0 : _a.cells[col];
        if (cellId === undefined) {
            return undefined;
        }
        return this.getters.getCellById(cellId);
    }
    /**
     * Returns all the cells of a col
     */
    getColCells(sheetId, col) {
        return this.getSheet(sheetId)
            .rows.map((row) => row.cells[col])
            .filter(isDefined)
            .map((cellId) => this.getters.getCellById(cellId))
            .filter(isDefined);
    }
    getColsZone(sheetId, start, end) {
        return {
            top: 0,
            bottom: this.getSheet(sheetId).rows.length - 1,
            left: start,
            right: end,
        };
    }
    getRowsZone(sheetId, start, end) {
        return {
            top: start,
            bottom: end,
            left: 0,
            right: this.getSheet(sheetId).cols.length - 1,
        };
    }
    getCellPosition(cellId) {
        const cell = this.cellPosition[cellId];
        if (!cell) {
            throw new Error(`asking for a cell position that doesn't exist, cell id: ${cellId}`);
        }
        return cell;
    }
    getHiddenColsGroups(sheetId) {
        var _a;
        return ((_a = this.sheets[sheetId]) === null || _a === void 0 ? void 0 : _a.hiddenColsGroups) || [];
    }
    getHiddenRowsGroups(sheetId) {
        var _a;
        return ((_a = this.sheets[sheetId]) === null || _a === void 0 ? void 0 : _a.hiddenRowsGroups) || [];
    }
    getNumberCols(sheetId) {
        return this.getSheet(sheetId).cols.length;
    }
    getNumberRows(sheetId) {
        return this.getSheet(sheetId).rows.length;
    }
    // ---------------------------------------------------------------------------
    // Row/Col manipulation
    // ---------------------------------------------------------------------------
    /**
     * Check if a zone only contains empty cells
     */
    isEmpty(sheetId, zone) {
        return this.getCellsInZone(sheetId, zone)
            .flat()
            .every((cell) => !cell || cell.isEmpty());
    }
    setHeaderSize(sheet, dimension, index, size) {
        let start, end;
        const elements = sheet[dimension];
        const base = elements[index];
        const delta = size - base.size;
        this.history.update("sheets", sheet.id, dimension, index, "size", size);
        if (!base.isHidden)
            this.history.update("sheets", sheet.id, dimension, index, "end", base.end + delta);
        start = base.end;
        for (let i = index + 1; i < elements.length; i++) {
            const element = elements[i];
            end = element.isHidden ? start : start + element.size;
            this.history.update("sheets", sheet.id, dimension, i, "start", start);
            this.history.update("sheets", sheet.id, dimension, i, "end", end);
            start = end;
        }
    }
    updateCellPosition(cmd) {
        const { sheetId, cellId, col, row } = cmd;
        if (cellId) {
            this.setNewPosition(cellId, sheetId, col, row);
        }
        else {
            this.clearPosition(sheetId, col, row);
        }
    }
    /**
     * Set the cell at a new position and clear its previous position.
     */
    setNewPosition(cellId, sheetId, col, row) {
        const currentPosition = this.cellPosition[cellId];
        if (currentPosition) {
            this.clearPosition(sheetId, currentPosition.col, currentPosition.row);
        }
        this.history.update("cellPosition", cellId, {
            row: row,
            col: col,
            sheetId: sheetId,
        });
        this.history.update("sheets", sheetId, "rows", row, "cells", col, cellId);
    }
    /**
     * Remove the cell at the given position (if there's one)
     */
    clearPosition(sheetId, col, row) {
        var _a;
        const cellId = (_a = this.sheets[sheetId]) === null || _a === void 0 ? void 0 : _a.rows[row].cells[col];
        if (cellId) {
            this.history.update("cellPosition", cellId, undefined);
            this.history.update("sheets", sheetId, "rows", row, "cells", col, undefined);
        }
    }
    setGridLinesVisibility(sheetId, areGridLinesVisible) {
        this.history.update("sheets", sheetId, "areGridLinesVisible", areGridLinesVisible);
    }
    clearZones(sheetId, zones) {
        for (let zone of zones) {
            for (let col = zone.left; col <= zone.right; col++) {
                for (let row = zone.top; row <= zone.bottom; row++) {
                    const cell = this.sheets[sheetId].rows[row].cells[col];
                    if (cell) {
                        this.dispatch("UPDATE_CELL", {
                            sheetId: sheetId,
                            content: "",
                            col,
                            row,
                        });
                    }
                }
            }
        }
    }
    generateSheetName() {
        let i = 1;
        const names = this.getSheets().map((s) => s.name);
        const baseName = _lt("Sheet");
        let name = `${baseName}${i}`;
        while (names.includes(name)) {
            name = `${baseName}${i}`;
            i++;
        }
        return name;
    }
    createSheet(id, name, colNumber, rowNumber, position) {
        const sheet = {
            id,
            name,
            cols: createDefaultCols(colNumber),
            rows: createDefaultRows(rowNumber),
            hiddenColsGroups: [],
            hiddenRowsGroups: [],
            areGridLinesVisible: true,
        };
        const visibleSheets = this.visibleSheets.slice();
        visibleSheets.splice(position, 0, sheet.id);
        const sheets = this.sheets;
        this.history.update("visibleSheets", visibleSheets);
        this.history.update("sheets", Object.assign({}, sheets, { [sheet.id]: sheet }));
        return sheet;
    }
    moveSheet(sheetId, direction) {
        const visibleSheets = this.visibleSheets.slice();
        const currentIndex = visibleSheets.findIndex((id) => id === sheetId);
        const sheet = visibleSheets.splice(currentIndex, 1);
        visibleSheets.splice(currentIndex + (direction === "left" ? -1 : 1), 0, sheet[0]);
        this.history.update("visibleSheets", visibleSheets);
    }
    checkSheetName(cmd) {
        const { visibleSheets, sheets } = this;
        const name = cmd.name && cmd.name.trim().toLowerCase();
        if (visibleSheets.find((id) => { var _a; return ((_a = sheets[id]) === null || _a === void 0 ? void 0 : _a.name.toLowerCase()) === name; })) {
            return 10 /* DuplicatedSheetName */;
        }
        if (FORBIDDEN_IN_EXCEL_REGEX.test(name)) {
            return 11 /* ForbiddenCharactersInSheetName */;
        }
        return 0 /* Success */;
    }
    isRenameAllowed(cmd) {
        const name = cmd.name && cmd.name.trim().toLowerCase();
        if (!name) {
            return 9 /* MissingSheetName */;
        }
        return this.checkSheetName(cmd);
    }
    renameSheet(sheet, name) {
        const oldName = sheet.name;
        this.history.update("sheets", sheet.id, "name", name.trim());
        const sheetIds = Object.assign({}, this.sheetIds);
        sheetIds[name] = sheet.id;
        delete sheetIds[oldName];
        this.history.update("sheetIds", sheetIds);
    }
    duplicateSheet(fromId, toId) {
        const sheet = this.getSheet(fromId);
        const toName = this.getDuplicateSheetName(sheet.name);
        const newSheet = JSON.parse(JSON.stringify(sheet));
        newSheet.id = toId;
        newSheet.name = toName;
        for (let col = 0; col <= newSheet.cols.length; col++) {
            for (let row = 0; row <= newSheet.rows.length; row++) {
                if (newSheet.rows[row]) {
                    newSheet.rows[row].cells[col] = undefined;
                }
            }
        }
        const visibleSheets = this.visibleSheets.slice();
        const currentIndex = visibleSheets.findIndex((id) => id === fromId);
        visibleSheets.splice(currentIndex + 1, 0, newSheet.id);
        this.history.update("visibleSheets", visibleSheets);
        this.history.update("sheets", Object.assign({}, this.sheets, { [newSheet.id]: newSheet }));
        for (const cell of Object.values(this.getters.getCells(fromId))) {
            const { col, row } = this.getCellPosition(cell.id);
            this.dispatch("UPDATE_CELL", {
                sheetId: newSheet.id,
                col,
                row,
                content: cell.content,
                format: cell.format,
                style: cell.style,
            });
        }
        const sheetIds = Object.assign({}, this.sheetIds);
        sheetIds[newSheet.name] = newSheet.id;
        this.history.update("sheetIds", sheetIds);
    }
    getDuplicateSheetName(sheetName) {
        let i = 1;
        const names = this.getters.getSheets().map((s) => s.name);
        const baseName = _lt("Copy of %s", sheetName);
        let name = baseName.toString();
        while (names.includes(name)) {
            name = `${baseName} (${i})`;
            i++;
        }
        return name;
    }
    deleteSheet(sheet) {
        const name = sheet.name;
        const sheets = Object.assign({}, this.sheets);
        delete sheets[sheet.id];
        this.history.update("sheets", sheets);
        const visibleSheets = this.visibleSheets.slice();
        const currentIndex = visibleSheets.findIndex((id) => id === sheet.id);
        visibleSheets.splice(currentIndex, 1);
        this.history.update("visibleSheets", visibleSheets);
        const sheetIds = Object.assign({}, this.sheetIds);
        delete sheetIds[name];
        this.history.update("sheetIds", sheetIds);
    }
    /**
     * Delete column. This requires a lot of handling:
     * - Update all the formulas in all sheets
     * - Move the cells
     * - Update the cols/rows (size, number, (cells), ...)
     * - Reevaluate the cells
     *
     * @param sheet ID of the sheet on which deletion should be applied
     * @param columns Columns to delete
     */
    removeColumns(sheet, columns) {
        // This is necessary because we have to delete elements in correct order:
        // begin with the end.
        columns.sort((a, b) => b - a);
        for (let column of columns) {
            // Move the cells.
            this.moveCellOnColumnsDeletion(sheet, column);
        }
        // Effectively delete the element and recompute the left-right.
        this.updateColumnsStructureOnDeletion(sheet, columns);
    }
    /**
     * Delete row. This requires a lot of handling:
     * - Update the merges
     * - Update all the formulas in all sheets
     * - Move the cells
     * - Update the cols/rows (size, number, (cells), ...)
     * - Reevaluate the cells
     *
     * @param sheet ID of the sheet on which deletion should be applied
     * @param rows Rows to delete
     */
    removeRows(sheet, rows) {
        // This is necessary because we have to delete elements in correct order:
        // begin with the end.
        rows.sort((a, b) => b - a);
        for (let group of groupConsecutive(rows)) {
            // Move the cells.
            this.moveCellOnRowsDeletion(sheet, group[group.length - 1], group[0]);
            // Effectively delete the element and recompute the left-right/top-bottom.
            group.map((row) => this.updateRowsStructureOnDeletion(row, sheet));
        }
    }
    addColumns(sheet, column, position, quantity) {
        // Move the cells.
        this.moveCellsOnAddition(sheet, position === "before" ? column : column + 1, quantity, "columns");
        // Recompute the left-right/top-bottom.
        this.updateColumnsStructureOnAddition(sheet, column, quantity);
    }
    addRows(sheet, row, position, quantity) {
        this.addEmptyRows(sheet, quantity);
        // Move the cells.
        this.moveCellsOnAddition(sheet, position === "before" ? row : row + 1, quantity, "rows");
        // Recompute the left-right/top-bottom.
        this.updateRowsStructureOnAddition(sheet, row, quantity);
    }
    moveCellOnColumnsDeletion(sheet, deletedColumn) {
        for (let [index, row] of Object.entries(sheet.rows)) {
            const rowIndex = parseInt(index, 10);
            for (let i in row.cells) {
                const colIndex = parseInt(i, 10);
                const cellId = row.cells[i];
                if (cellId) {
                    if (colIndex === deletedColumn) {
                        this.dispatch("CLEAR_CELL", {
                            sheetId: sheet.id,
                            col: colIndex,
                            row: rowIndex,
                        });
                    }
                    if (colIndex > deletedColumn) {
                        this.dispatch("UPDATE_CELL_POSITION", {
                            sheetId: sheet.id,
                            cellId: cellId,
                            col: colIndex - 1,
                            row: rowIndex,
                        });
                    }
                }
            }
        }
    }
    /**
     * Move the cells after a column or rows insertion
     */
    moveCellsOnAddition(sheet, addedElement, quantity, dimension) {
        const commands = [];
        for (const [index, row] of Object.entries(sheet.rows)) {
            const rowIndex = parseInt(index, 10);
            if (dimension !== "rows" || rowIndex >= addedElement) {
                for (let i in row.cells) {
                    const colIndex = parseInt(i, 10);
                    const cellId = row.cells[i];
                    if (cellId) {
                        if (dimension === "rows" || colIndex >= addedElement) {
                            commands.push({
                                type: "UPDATE_CELL_POSITION",
                                sheetId: sheet.id,
                                cellId: cellId,
                                col: colIndex + (dimension === "columns" ? quantity : 0),
                                row: rowIndex + (dimension === "rows" ? quantity : 0),
                            });
                        }
                    }
                }
            }
        }
        for (let cmd of commands.reverse()) {
            this.dispatch(cmd.type, cmd);
        }
    }
    /**
     * Move all the cells that are from the row under `deleteToRow` up to `deleteFromRow`
     *
     * b.e.
     * move vertically with delete from 3 and delete to 5 will first clear all the cells from lines 3 to 5,
     * then take all the row starting at index 6 and add them back at index 3
     *
     */
    moveCellOnRowsDeletion(sheet, deleteFromRow, deleteToRow) {
        const numberRows = deleteToRow - deleteFromRow + 1;
        for (let [index, row] of Object.entries(sheet.rows)) {
            const rowIndex = parseInt(index, 10);
            if (rowIndex >= deleteFromRow && rowIndex <= deleteToRow) {
                for (let i in row.cells) {
                    const colIndex = parseInt(i, 10);
                    const cellId = row.cells[i];
                    if (cellId) {
                        this.dispatch("CLEAR_CELL", {
                            sheetId: sheet.id,
                            col: colIndex,
                            row: rowIndex,
                        });
                    }
                }
            }
            if (rowIndex > deleteToRow) {
                for (let i in row.cells) {
                    const colIndex = parseInt(i, 10);
                    const cellId = row.cells[i];
                    if (cellId) {
                        this.dispatch("UPDATE_CELL_POSITION", {
                            sheetId: sheet.id,
                            cellId: cellId,
                            col: colIndex,
                            row: rowIndex - numberRows,
                        });
                    }
                }
            }
        }
    }
    /**
     * Update the cols of the sheet after a deletion:
     * - Rename the cols
     * - Update start-end
     *
     * @param sheet Sheet on which the deletion occurs
     * @param deletedColumns Indexes of the deleted columns
     */
    updateColumnsStructureOnDeletion(sheet, deletedColumns) {
        const cols = [];
        let start = 0;
        let colSizeIndex = 0;
        for (let index in sheet.cols) {
            if (deletedColumns.includes(parseInt(index, 10))) {
                continue;
            }
            const { size, isHidden } = sheet.cols[index];
            const end = isHidden ? start : start + size;
            cols.push({
                name: numberToLetters(colSizeIndex),
                size,
                start,
                end,
                isHidden,
            });
            start = end;
            colSizeIndex++;
        }
        this.history.update("sheets", sheet.id, "cols", cols);
        this.updateHiddenElementsGroups(sheet.id, "cols");
    }
    /**
     * Update the cols of the sheet after an addition:
     * - Rename the cols
     * - Update start-end
     *
     * @param sheet Sheet on which the deletion occurs
     * @param addedColumn Index of the added columns
     * @param columnsToAdd Number of the columns to add
     */
    updateColumnsStructureOnAddition(sheet, addedColumn, columnsToAdd) {
        const cols = [];
        let start = 0;
        let colIndex = 0;
        for (let i in sheet.cols) {
            if (parseInt(i, 10) === addedColumn) {
                const { size } = sheet.cols[colIndex];
                for (let a = 0; a < columnsToAdd; a++) {
                    cols.push({
                        name: numberToLetters(colIndex),
                        size,
                        start,
                        end: start + size,
                    });
                    start += size;
                    colIndex++;
                }
            }
            const { size, isHidden } = sheet.cols[i];
            const end = isHidden ? start : start + size;
            cols.push({
                name: numberToLetters(colIndex),
                size,
                start,
                end,
                isHidden,
            });
            start = end;
            colIndex++;
        }
        this.history.update("sheets", sheet.id, "cols", cols);
        this.updateHiddenElementsGroups(sheet.id, "cols");
    }
    updateRowsStructureOnDeletion(index, sheet) {
        const rows = [];
        let start = 0;
        let rowIndex = 0;
        const cellsQueue = sheet.rows.map((row) => row.cells);
        for (let i in sheet.rows) {
            const row = sheet.rows[i];
            const { size, isHidden } = row;
            const end = isHidden ? start : start + size;
            if (parseInt(i, 10) === index) {
                continue;
            }
            rowIndex++;
            rows.push({
                start,
                end,
                size,
                cells: cellsQueue.shift(),
                name: String(rowIndex),
                isHidden,
            });
            start = end;
        }
        this.history.update("sheets", sheet.id, "rows", rows);
        this.updateHiddenElementsGroups(sheet.id, "rows");
    }
    /**
     * Update the rows of the sheet after an addition:
     * - Rename the rows
     * - Update start-end
     *
     * @param sheet Sheet on which the deletion occurs
     * @param addedRow Index of the added row
     * @param rowsToAdd Number of the rows to add
     */
    updateRowsStructureOnAddition(sheet, addedRow, rowsToAdd) {
        const rows = [];
        let start = 0;
        let rowIndex = 0;
        let sizeIndex = 0;
        const cellsQueue = sheet.rows.map((row) => row.cells);
        for (let i in sheet.rows) {
            const { size, isHidden } = sheet.rows[sizeIndex];
            const end = isHidden ? start : start + size;
            if (parseInt(i, 10) < addedRow || parseInt(i, 10) >= addedRow + rowsToAdd) {
                sizeIndex++;
            }
            rowIndex++;
            rows.push({
                start,
                end,
                size,
                cells: cellsQueue.shift(),
                name: String(rowIndex),
                isHidden,
            });
            start = end;
        }
        this.history.update("sheets", sheet.id, "rows", rows);
        this.updateHiddenElementsGroups(sheet.id, "rows");
    }
    /**
     * Add empty rows at the end of the rows
     *
     * @param sheet Sheet
     * @param quantity Number of rows to add
     */
    addEmptyRows(sheet, quantity) {
        const lastEnd = sheet.rows[sheet.rows.length - 1].end;
        const rows = sheet.rows.slice();
        for (let i = 0; i < quantity; i++) {
            rows.push({
                start: lastEnd,
                end: lastEnd,
                size: 0,
                name: (rows.length + 1).toString(),
                cells: {},
            });
        }
        this.history.update("sheets", sheet.id, "rows", rows);
    }
    getImportedSheetSize(data) {
        const positions = Object.keys(data.cells).map(toCartesian);
        return {
            rowNumber: Math.max(data.rowNumber, ...positions.map(([col, row]) => row + 1)),
            colNumber: Math.max(data.colNumber, ...positions.map(([col, row]) => col + 1)),
        };
    }
    // ----------------------------------------------------
    //  HIDE / SHOW
    // ----------------------------------------------------
    setElementsVisibility(sheet, elements, direction, visibility) {
        let start = 0;
        const hide = visibility === "hide";
        for (let index = 0; index < sheet[direction].length; index++) {
            const { size, isHidden } = sheet[direction][index];
            const newIsHidden = elements.includes(index) ? hide : isHidden || false;
            const end = newIsHidden ? start : start + size;
            this.history.update("sheets", sheet.id, direction, index, "start", start);
            this.history.update("sheets", sheet.id, direction, index, "end", end);
            this.history.update("sheets", sheet.id, direction, index, "isHidden", newIsHidden);
            start = end;
        }
        this.updateHiddenElementsGroups(sheet.id, direction);
    }
    updateHiddenElementsGroups(sheetId, dimension) {
        var _a;
        const elements = ((_a = this.sheets[sheetId]) === null || _a === void 0 ? void 0 : _a[dimension]) || [];
        const elementsRef = dimension === "cols" ? "hiddenColsGroups" : "hiddenRowsGroups";
        const hiddenEltsGroups = elements.reduce((acc, currentElt, index) => {
            if (!currentElt.isHidden) {
                return acc;
            }
            const currentGroup = acc[acc.length - 1];
            if (!currentGroup || currentGroup[currentGroup.length - 1] != index - 1) {
                acc.push([]);
            }
            acc[acc.length - 1].push(index);
            return acc;
        }, []);
        this.history.update("sheets", sheetId, elementsRef, hiddenEltsGroups);
    }
    /**
     * Check that any "sheetId" in the command matches an existing
     * sheet.
     */
    checkSheetExists(cmd) {
        if (cmd.type !== "CREATE_SHEET" && "sheetId" in cmd && this.sheets[cmd.sheetId] === undefined) {
            return 21 /* InvalidSheetId */;
        }
        return 0 /* Success */;
    }
    /**
     * Check if zones in the command are well formed and
     * not outside the sheet.
     */
    checkZones(cmd) {
        const zones = [];
        if ("zone" in cmd) {
            zones.push(cmd.zone);
        }
        if ("target" in cmd && Array.isArray(cmd.target)) {
            zones.push(...cmd.target);
        }
        if (!zones.every(isZoneValid)) {
            return 20 /* InvalidRange */;
        }
        else if (zones.length && "sheetId" in cmd) {
            const sheet = this.getSheet(cmd.sheetId);
            const sheetZone = {
                top: 0,
                left: 0,
                bottom: sheet.rows.length - 1,
                right: sheet.cols.length - 1,
            };
            return zones.every((zone) => isZoneInside(zone, sheetZone))
                ? 0 /* Success */
                : 16 /* TargetOutOfSheet */;
        }
        return 0 /* Success */;
    }
}
SheetPlugin.getters = [
    "getSheetName",
    "tryGetSheetName",
    "getSheet",
    "tryGetSheet",
    "getSheetIdByName",
    "getSheets",
    "getVisibleSheets",
    "getEvaluationSheets",
    "tryGetCol",
    "getCol",
    "tryGetRow",
    "getRow",
    "getCell",
    "getCellsInZone",
    "getCellPosition",
    "getColCells",
    "getColsZone",
    "getRowsZone",
    "getNumberCols",
    "getNumberRows",
    "getHiddenColsGroups",
    "getHiddenRowsGroups",
    "getGridLinesVisibility",
    "isEmpty",
];
//# sourceMappingURL=sheet.js.map