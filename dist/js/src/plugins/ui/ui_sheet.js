import { DEFAULT_FONT_SIZE, PADDING_AUTORESIZE } from "../../constants";
import { fontSizeMap } from "../../fonts";
import { computeIconWidth, computeTextWidth, isDefined } from "../../helpers/index";
import { CellValueType } from "../../types";
import { UIPlugin } from "../ui_plugin";
export class SheetUIPlugin extends UIPlugin {
    constructor() {
        super(...arguments);
        this.ctx = document.createElement("canvas").getContext("2d");
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    allowDispatch(cmd) {
        switch (cmd.type) {
            case "AUTORESIZE_ROWS":
            case "AUTORESIZE_COLUMNS":
                try {
                    this.getters.getSheet(cmd.sheetId);
                    break;
                }
                catch (error) {
                    return 21 /* InvalidSheetId */;
                }
        }
        return 0 /* Success */;
    }
    handle(cmd) {
        switch (cmd.type) {
            case "AUTORESIZE_COLUMNS":
                for (let col of cmd.cols) {
                    const size = this.getColMaxWidth(cmd.sheetId, col);
                    if (size !== 0) {
                        this.dispatch("RESIZE_COLUMNS_ROWS", {
                            elements: [col],
                            dimension: "COL",
                            size: size + 2 * PADDING_AUTORESIZE,
                            sheetId: cmd.sheetId,
                        });
                    }
                }
                break;
            case "AUTORESIZE_ROWS":
                for (let row of cmd.rows) {
                    const size = this.getRowMaxHeight(cmd.sheetId, row);
                    if (size !== 0) {
                        this.dispatch("RESIZE_COLUMNS_ROWS", {
                            elements: [row],
                            dimension: "ROW",
                            size: size + 2 * PADDING_AUTORESIZE,
                            sheetId: cmd.sheetId,
                        });
                    }
                }
                break;
        }
    }
    // ---------------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------------
    getCellWidth(cell) {
        let width = this.getTextWidth(cell);
        const cellPosition = this.getters.getCellPosition(cell.id);
        const icon = this.getters.getConditionalIcon(cellPosition.col, cellPosition.row);
        if (icon) {
            width += computeIconWidth(this.ctx, this.getters.getCellStyle(cell));
        }
        return width;
    }
    getTextWidth(cell) {
        const text = this.getters.getCellText(cell, this.getters.shouldShowFormulas());
        return computeTextWidth(this.ctx, text, this.getters.getCellStyle(cell));
    }
    getCellHeight(cell) {
        const style = this.getters.getCellStyle(cell);
        const sizeInPt = style.fontSize || DEFAULT_FONT_SIZE;
        return fontSizeMap[sizeInPt];
    }
    getCellText(cell, showFormula = false) {
        if (showFormula && (cell.isFormula() || cell.evaluated.type === CellValueType.error)) {
            return cell.content;
        }
        else {
            return cell.formattedValue;
        }
    }
    // ---------------------------------------------------------------------------
    // Grid manipulation
    // ---------------------------------------------------------------------------
    getColMaxWidth(sheetId, index) {
        const cells = this.getters.getColCells(sheetId, index);
        const sizes = cells.map((cell) => this.getCellWidth(cell));
        return Math.max(0, ...sizes);
    }
    getRowMaxHeight(sheetId, index) {
        const sheet = this.getters.getSheet(sheetId);
        const cells = Object.values(sheet.rows[index].cells)
            .filter(isDefined)
            .map((cellId) => this.getters.getCellById(cellId));
        const sizes = cells.map((cell) => this.getCellHeight(cell));
        return Math.max(0, ...sizes);
    }
}
SheetUIPlugin.getters = ["getCellWidth", "getCellHeight", "getTextWidth", "getCellText"];
//# sourceMappingURL=ui_sheet.js.map