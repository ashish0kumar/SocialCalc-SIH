import { DATETIME_FORMAT, NULL_FORMAT } from "../../constants";
import { cellFactory } from "../../helpers/cells/cell_factory";
import { concat, getItemId, isInside, maximumDecimalPlaces, range, toCartesian, toXC, } from "../../helpers/index";
import { CellValueType, } from "../../types/index";
import { CorePlugin } from "../core_plugin";
const nbspRegexp = new RegExp(String.fromCharCode(160), "g");
/**
 * Core Plugin
 *
 * This is the most fundamental of all plugins. It defines how to interact with
 * cell and sheet content.
 */
export class CellPlugin extends CorePlugin {
    constructor() {
        super(...arguments);
        this.cells = {};
        this.createCell = cellFactory(this.getters);
    }
    adaptRanges(applyChange, sheetId) {
        for (const sheet of Object.keys(this.cells)) {
            for (const cell of Object.values(this.cells[sheet] || {})) {
                if (cell.isFormula()) {
                    for (const range of cell.dependencies) {
                        if (!sheetId || range.sheetId === sheetId) {
                            const change = applyChange(range);
                            if (change.changeType !== "NONE") {
                                this.history.update("cells", sheet, cell.id, "dependencies", cell.dependencies.indexOf(range), change.range);
                            }
                        }
                    }
                }
            }
        }
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    allowDispatch(cmd) {
        switch (cmd.type) {
            case "UPDATE_CELL":
                return this.checkCellOutOfSheet(cmd.sheetId, cmd.col, cmd.row);
            default:
                return 0 /* Success */;
        }
    }
    handle(cmd) {
        switch (cmd.type) {
            case "SET_FORMATTING":
                if ("style" in cmd) {
                    this.setStyle(cmd.sheetId, cmd.target, cmd.style);
                }
                if ("format" in cmd && cmd.format !== undefined) {
                    this.setFormatter(cmd.sheetId, cmd.target, cmd.format);
                }
                break;
            case "SET_DECIMAL":
                this.setDecimal(cmd.sheetId, cmd.target, cmd.step);
                break;
            case "CLEAR_FORMATTING":
                this.clearStyles(cmd.sheetId, cmd.target);
                break;
            case "ADD_COLUMNS_ROWS":
                if (cmd.dimension === "COL") {
                    this.handleAddColumnsRows(cmd, this.copyColumnStyle.bind(this));
                }
                else {
                    this.handleAddColumnsRows(cmd, this.copyRowStyle.bind(this));
                }
                break;
            case "UPDATE_CELL":
                this.updateCell(this.getters.getSheet(cmd.sheetId), cmd.col, cmd.row, cmd);
                break;
            case "CLEAR_CELL":
                this.dispatch("UPDATE_CELL", {
                    sheetId: cmd.sheetId,
                    col: cmd.col,
                    row: cmd.row,
                    content: "",
                    style: null,
                    format: "",
                });
                break;
        }
    }
    /**
     * Set a format to all the cells in a zone
     */
    setFormatter(sheetId, zones, format) {
        for (let zone of zones) {
            for (let row = zone.top; row <= zone.bottom; row++) {
                for (let col = zone.left; col <= zone.right; col++) {
                    this.dispatch("UPDATE_CELL", {
                        sheetId,
                        col,
                        row,
                        format,
                    });
                }
            }
        }
    }
    /**
     * This function allows to adjust the quantity of decimal places after a decimal
     * point on cells containing number value. It does this by changing the cells
     * format. Values aren't modified.
     *
     * The change of the decimal quantity is done one by one, the sign of the step
     * variable indicates whether we are increasing or decreasing.
     *
     * If several cells are in the zone, the format resulting from the change of the
     * first cell (with number type) will be applied to the whole zone.
     */
    setDecimal(sheetId, zones, step) {
        // Find the first cell with a number value and get the format
        const numberFormat = this.searchNumberFormat(sheetId, zones);
        if (numberFormat !== undefined) {
            // Depending on the step sign, increase or decrease the decimal representation
            // of the format
            const newFormat = this.changeDecimalFormat(numberFormat, step);
            // Apply the new format on the whole zone
            this.setFormatter(sheetId, zones, newFormat);
        }
    }
    /**
     * Take a range of cells and return the format of the first cell containing a
     * number value. Returns a default format if the cell hasn't format. Returns
     * undefined if no number value in the range.
     */
    searchNumberFormat(sheetId, zones) {
        var _a;
        for (let zone of zones) {
            for (let row = zone.top; row <= zone.bottom; row++) {
                for (let col = zone.left; col <= zone.right; col++) {
                    const cell = this.getters.getCell(sheetId, col, row);
                    if ((cell === null || cell === void 0 ? void 0 : cell.evaluated.type) === CellValueType.number &&
                        !((_a = cell.format) === null || _a === void 0 ? void 0 : _a.match(DATETIME_FORMAT)) // reject dates
                    ) {
                        return cell.format || this.setDefaultNumberFormat(cell.evaluated.value);
                    }
                }
            }
        }
        return undefined;
    }
    /**
     * Function used to give the default format of a cell with a number for value.
     * It is considered that the default format of a number is 0 followed by as many
     * 0 as there are decimal places.
     *
     * Example:
     * - 1 --> '0'
     * - 123 --> '0'
     * - 12345 --> '0'
     * - 42.1 --> '0.0'
     * - 456.0001 --> '0.0000'
     */
    setDefaultNumberFormat(cellValue) {
        const strValue = cellValue.toString();
        const parts = strValue.split(".");
        if (parts.length === 1) {
            return "0";
        }
        return "0." + Array(parts[1].length + 1).join("0");
    }
    /**
     * This function take a cell format representation and return a new format representation
     * with more or less decimal places.
     *
     * If the format doesn't look like a digital format (means that not contain '0')
     * or if this one cannot be increased or decreased, the returned format will be
     * the same.
     *
     * This function aims to work with all possible formats as well as custom formats.
     *
     * Examples of format changed by this function:
     * - "0" (step = 1) --> "0.0"
     * - "0.000%" (step = 1) --> "0.0000%"
     * - "0.00" (step = -1) --> "0.0"
     * - "0%" (step = -1) --> "0%"
     * - "#,##0.0" (step = -1) --> "#,##0"
     * - "#,##0;0.0%;0.000" (step = 1) --> "#,##0.0;0.00%;0.0000"
     */
    changeDecimalFormat(format, step) {
        const sign = Math.sign(step);
        // According to the representation of the cell format. A format can contain
        // up to 4 sub-formats which can be applied depending on the value of the cell
        // (among positive / negative / zero / text), each of these sub-format is separated
        // by ';' in the format. We need to make the change on each sub-format.
        const subFormats = format.split(";");
        let newSubFormats = [];
        for (let subFormat of subFormats) {
            const decimalPointPosition = subFormat.indexOf(".");
            const exponentPosition = subFormat.toUpperCase().indexOf("E");
            let newSubFormat;
            // the 1st step is to find the part of the zeros located before the
            // exponent (when existed)
            const subPart = exponentPosition > -1 ? subFormat.slice(0, exponentPosition) : subFormat;
            const zerosAfterDecimal = decimalPointPosition > -1 ? subPart.slice(decimalPointPosition).match(/0/g).length : 0;
            // the 2nd step is to add (or remove) zero after the last zeros obtained in
            // step 1
            const lastZeroPosition = subPart.lastIndexOf("0");
            if (lastZeroPosition > -1) {
                if (sign > 0) {
                    // in this case we want to add decimal information
                    if (zerosAfterDecimal < maximumDecimalPlaces) {
                        newSubFormat =
                            subFormat.slice(0, lastZeroPosition + 1) +
                                (zerosAfterDecimal === 0 ? ".0" : "0") +
                                subFormat.slice(lastZeroPosition + 1);
                    }
                    else {
                        newSubFormat = subFormat;
                    }
                }
                else {
                    // in this case we want to remove decimal information
                    if (zerosAfterDecimal > 0) {
                        // remove last zero
                        newSubFormat =
                            subFormat.slice(0, lastZeroPosition) + subFormat.slice(lastZeroPosition + 1);
                        // if a zero always exist after decimal point else remove decimal point
                        if (zerosAfterDecimal === 1) {
                            newSubFormat =
                                newSubFormat.slice(0, decimalPointPosition) +
                                    newSubFormat.slice(decimalPointPosition + 1);
                        }
                    }
                    else {
                        // zero after decimal isn't present, we can't remove zero
                        newSubFormat = subFormat;
                    }
                }
            }
            else {
                // no zeros are present in this format, we do nothing
                newSubFormat = subFormat;
            }
            newSubFormats.push(newSubFormat);
        }
        return newSubFormats.join(";");
    }
    /**
     * Clear the styles of zones
     */
    clearStyles(sheetId, zones) {
        for (let zone of zones) {
            for (let col = zone.left; col <= zone.right; col++) {
                for (let row = zone.top; row <= zone.bottom; row++) {
                    // commandHelpers.updateCell(sheetId, col, row, { style: undefined});
                    this.dispatch("UPDATE_CELL", {
                        sheetId,
                        col,
                        row,
                        style: null,
                    });
                }
            }
        }
    }
    /**
     * Copy the style of the reference column/row to the new columns/rows.
     */
    handleAddColumnsRows(cmd, fn) {
        const sheet = this.getters.getSheet(cmd.sheetId);
        // The new elements have already been inserted in the sheet at this point.
        let insertedElements;
        let styleReference;
        if (cmd.position === "before") {
            insertedElements = range(cmd.base, cmd.base + cmd.quantity);
            styleReference = cmd.base + cmd.quantity;
        }
        else {
            insertedElements = range(cmd.base + 1, cmd.base + cmd.quantity + 1);
            styleReference = cmd.base;
        }
        fn(sheet, styleReference, insertedElements);
    }
    // ---------------------------------------------------------------------------
    // Import/Export
    // ---------------------------------------------------------------------------
    import(data) {
        for (let sheet of data.sheets) {
            const imported_sheet = this.getters.getSheet(sheet.id);
            // cells
            for (let xc in sheet.cells) {
                const cellData = sheet.cells[xc];
                const [col, row] = toCartesian(xc);
                if ((cellData === null || cellData === void 0 ? void 0 : cellData.content) || (cellData === null || cellData === void 0 ? void 0 : cellData.format) || (cellData === null || cellData === void 0 ? void 0 : cellData.style)) {
                    const cell = this.importCell(imported_sheet, cellData, data.styles, data.formats);
                    this.history.update("cells", sheet.id, cell.id, cell);
                    this.dispatch("UPDATE_CELL_POSITION", {
                        cellId: cell.id,
                        col,
                        row,
                        sheetId: sheet.id,
                    });
                }
            }
        }
    }
    export(data) {
        const styles = {};
        const formats = {};
        for (let _sheet of data.sheets) {
            const cells = {};
            const positions = Object.keys(this.cells[_sheet.id] || {})
                .map((cellId) => this.getters.getCellPosition(cellId))
                .sort((a, b) => (a.col === b.col ? a.row - b.row : a.col - b.col));
            for (const { col, row } of positions) {
                const cell = this.getters.getCell(_sheet.id, col, row);
                const xc = toXC(col, row);
                cells[xc] = {
                    style: cell.style ? getItemId(cell.style, styles) : undefined,
                    format: cell.format ? getItemId(cell.format, formats) : undefined,
                    content: cell.content,
                };
            }
            _sheet.cells = cells;
        }
        data.styles = styles;
        data.formats = formats;
    }
    importCell(sheet, cellData, normalizedStyles, normalizedFormats) {
        const style = (cellData.style && normalizedStyles[cellData.style]) || undefined;
        const format = (cellData.format && normalizedFormats[cellData.format]) || undefined;
        const cellId = this.uuidGenerator.uuidv4();
        const properties = { format, style };
        return this.createCell(cellId, (cellData === null || cellData === void 0 ? void 0 : cellData.content) || "", properties, sheet.id);
    }
    exportForExcel(data) {
        this.export(data);
        for (let sheet of data.sheets) {
            for (const xc in sheet.cells) {
                const [col, row] = toCartesian(xc);
                const cell = this.getters.getCell(sheet.id, col, row);
                const exportedCellData = sheet.cells[xc];
                exportedCellData.value = cell.evaluated.value;
                exportedCellData.isFormula = cell.isFormula();
            }
        }
    }
    // ---------------------------------------------------------------------------
    // GETTERS
    // ---------------------------------------------------------------------------
    getCells(sheetId) {
        return this.cells[sheetId] || {};
    }
    /**
     * get a cell by ID. Used in evaluation when evaluating an async cell, we need to be able to find it back after
     * starting an async evaluation even if it has been moved or re-allocated
     */
    getCellById(cellId) {
        for (const sheet of Object.values(this.cells)) {
            if (sheet[cellId]) {
                return sheet[cellId];
            }
        }
        return undefined;
    }
    /**
     * Try to infer the cell format based on the formula dependencies.
     * e.g. if the formula is `=A1` and A1 has a given format, the
     * same format will be used.
     */
    inferFormulaFormat(compiledFormula, dependencies) {
        const dependenciesFormat = compiledFormula.dependenciesFormat;
        for (let dependencyFormat of dependenciesFormat) {
            switch (typeof dependencyFormat) {
                case "string":
                    // dependencyFormat corresponds to a literal format which can be applied
                    // directly.
                    return dependencyFormat;
                case "number":
                    // dependencyFormat corresponds to a dependency cell from which we must
                    // find the cell and extract the associated format
                    const ref = dependencies[dependencyFormat];
                    if (this.getters.tryGetSheet(ref.sheetId)) {
                        // if the reference is a range --> the first cell in the range
                        // determines the format
                        const cellRef = this.getters.getCell(ref.sheetId, ref.zone.left, ref.zone.top);
                        if (cellRef && cellRef.format) {
                            return cellRef.format;
                        }
                    }
            }
        }
        return NULL_FORMAT;
    }
    /*
     * Reconstructs the original formula string based on a normalized form and its dependencies
     */
    buildFormulaContent(sheetId, cell, dependencies) {
        const ranges = dependencies || [...cell.dependencies];
        return concat(cell.compiledFormula.tokens.map((token) => {
            if (token.type === "REFERENCE") {
                const range = ranges.shift();
                return this.getters.getRangeString(range, sheetId);
            }
            return token.value;
        }));
    }
    getFormulaCellContent(sheetId, cell) {
        return this.buildFormulaContent(sheetId, cell);
    }
    getCellStyle(cell) {
        return (cell && cell.style) || {};
    }
    /**
     * Converts a zone to a XC coordinate system
     *
     * The conversion also treats merges as one single cell
     *
     * Examples:
     * {top:0,left:0,right:0,bottom:0} ==> A1
     * {top:0,left:0,right:1,bottom:1} ==> A1:B2
     *
     * if A1:B2 is a merge:
     * {top:0,left:0,right:1,bottom:1} ==> A1
     * {top:1,left:0,right:1,bottom:2} ==> A1:B3
     *
     * if A1:B2 and A4:B5 are merges:
     * {top:1,left:0,right:1,bottom:3} ==> A1:A5
     */
    zoneToXC(sheetId, zone, fixedParts = [{ colFixed: false, rowFixed: false }]) {
        zone = this.getters.expandZone(sheetId, zone);
        const topLeft = toXC(zone.left, zone.top, fixedParts[0]);
        const botRight = toXC(zone.right, zone.bottom, fixedParts.length > 1 ? fixedParts[1] : fixedParts[0]);
        const cellTopLeft = this.getters.getMainCell(sheetId, zone.left, zone.top);
        const cellBotRight = this.getters.getMainCell(sheetId, zone.right, zone.bottom);
        const sameCell = cellTopLeft[0] == cellBotRight[0] && cellTopLeft[1] == cellBotRight[1];
        if (topLeft != botRight && !sameCell) {
            return topLeft + ":" + botRight;
        }
        return topLeft;
    }
    setStyle(sheetId, target, style) {
        for (let zone of target) {
            for (let col = zone.left; col <= zone.right; col++) {
                for (let row = zone.top; row <= zone.bottom; row++) {
                    const cell = this.getters.getCell(sheetId, col, row);
                    this.dispatch("UPDATE_CELL", {
                        sheetId,
                        col,
                        row,
                        style: style ? { ...cell === null || cell === void 0 ? void 0 : cell.style, ...style } : undefined,
                    });
                }
            }
        }
    }
    /**
     * Copy the style of one column to other columns.
     */
    copyColumnStyle(sheet, refColumn, targetCols) {
        for (let row = 0; row < sheet.rows.length; row++) {
            const format = this.getFormat(sheet.id, refColumn, row);
            if (format.style || format.format) {
                for (let col of targetCols) {
                    this.dispatch("UPDATE_CELL", { sheetId: sheet.id, col, row, ...format });
                }
            }
        }
    }
    /**
     * Copy the style of one row to other rows.
     */
    copyRowStyle(sheet, refRow, targetRows) {
        for (let col = 0; col < sheet.cols.length; col++) {
            const format = this.getFormat(sheet.id, col, refRow);
            if (format.style || format.format) {
                for (let row of targetRows) {
                    this.dispatch("UPDATE_CELL", { sheetId: sheet.id, col, row, ...format });
                }
            }
        }
    }
    /**
     * gets the currently used style/border of a cell based on it's coordinates
     */
    getFormat(sheetId, col, row) {
        const format = {};
        const [mainCol, mainRow] = this.getters.getMainCell(sheetId, col, row);
        const cell = this.getters.getCell(sheetId, mainCol, mainRow);
        if (cell) {
            if (cell.style) {
                format["style"] = cell.style;
            }
            if (cell.format) {
                format["format"] = cell.format;
            }
        }
        return format;
    }
    updateCell(sheet, col, row, after) {
        const before = this.getters.getCell(sheet.id, col, row);
        const hasContent = "content" in after || "formula" in after;
        // Compute the new cell properties
        const afterContent = after.content ? after.content.replace(nbspRegexp, "") : "";
        let style;
        if (after.style !== undefined) {
            style = after.style || undefined;
        }
        else {
            style = before ? before.style : undefined;
        }
        let format = ("format" in after ? after.format : before && before.format) || NULL_FORMAT;
        /* Read the following IF as:
         * we need to remove the cell if it is completely empty, but we can know if it completely empty if:
         * - the command says the new content is empty and has no border/format/style
         * - the command has no content property, in this case
         *     - either there wasn't a cell at this place and the command says border/format/style is empty
         *     - or there was a cell at this place, but it's an empty cell and the command says border/format/style is empty
         *  */
        if (((hasContent && !afterContent && !after.formula) ||
            (!hasContent && (!before || before.isEmpty()))) &&
            !style &&
            !format) {
            if (before) {
                this.history.update("cells", sheet.id, before.id, undefined);
                this.dispatch("UPDATE_CELL_POSITION", {
                    cellId: undefined,
                    col,
                    row,
                    sheetId: sheet.id,
                });
            }
            return;
        }
        const cellId = (before === null || before === void 0 ? void 0 : before.id) || this.uuidGenerator.uuidv4();
        const didContentChange = hasContent;
        let cell;
        const properties = { format, style };
        if (before && !didContentChange) {
            cell = before.withDisplayProperties(properties);
        }
        else {
            cell = this.createCell(cellId, afterContent, properties, sheet.id);
        }
        this.history.update("cells", sheet.id, cell.id, cell);
        this.dispatch("UPDATE_CELL_POSITION", { cellId: cell.id, col, row, sheetId: sheet.id });
    }
    checkCellOutOfSheet(sheetId, col, row) {
        const sheet = this.getters.tryGetSheet(sheetId);
        if (!sheet)
            return 21 /* InvalidSheetId */;
        const sheetZone = {
            top: 0,
            left: 0,
            bottom: sheet.rows.length - 1,
            right: sheet.cols.length - 1,
        };
        return isInside(col, row, sheetZone) ? 0 /* Success */ : 16 /* TargetOutOfSheet */;
    }
}
CellPlugin.getters = [
    "zoneToXC",
    "getCells",
    "getFormulaCellContent",
    "inferFormulaFormat",
    "getCellStyle",
    "buildFormulaContent",
    "getCellById",
];
//# sourceMappingURL=cell.js.map