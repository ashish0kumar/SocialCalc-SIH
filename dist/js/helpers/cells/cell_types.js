import { DATETIME_FORMAT, LINK_COLOR, LOADING } from "../../constants";
import { _lt } from "../../translation";
import { CellValueType, } from "../../types";
import { formatDateTime } from "../dates";
import { markdownLink, parseMarkdownLink, parseSheetLink } from "../misc";
import { formatStandardNumber } from "../numbers";
import { formatValue } from "./cell_helpers";
/**
 * Abstract base implementation of a cell.
 * Concrete cell classes are responsible to build the raw cell `content` based on
 * whatever data they have (formula, string, ...).
 */
class AbstractCell {
    constructor(id, evaluated, properties) {
        this.id = id;
        this.evaluated = evaluated;
        this.style = properties.style;
        this.format = properties.format;
    }
    isFormula() {
        return false;
    }
    isLink() {
        return false;
    }
    isEmpty() {
        return false;
    }
    get formattedValue() {
        return formatValue(this.evaluated.value, this.format);
    }
    get composerContent() {
        return this.content;
    }
    get defaultAlign() {
        switch (this.evaluated.type) {
            case CellValueType.number:
                return "right";
            case CellValueType.boolean:
            case CellValueType.error:
                return "center";
            case CellValueType.text:
            case CellValueType.empty:
                return "left";
        }
    }
    /**
     * Only empty cells, text cells and numbers are valid
     */
    get isAutoSummable() {
        var _a;
        switch (this.evaluated.type) {
            case CellValueType.empty:
            case CellValueType.text:
                return true;
            case CellValueType.number:
                return !((_a = this.format) === null || _a === void 0 ? void 0 : _a.match(DATETIME_FORMAT));
            case CellValueType.error:
            case CellValueType.boolean:
                return false;
        }
    }
    withDisplayProperties(properties) {
        return Object.create(this, {
            style: {
                value: properties.style,
            },
            format: {
                value: properties.format,
            },
        });
    }
}
export class EmptyCell extends AbstractCell {
    constructor(id, properties = {}) {
        super(id, { value: "", type: CellValueType.empty }, properties);
        this.content = "";
    }
    isEmpty() {
        return true;
    }
}
export class NumberCell extends AbstractCell {
    constructor(id, value, properties = {}) {
        super(id, { value: value, type: CellValueType.number }, properties);
        this.content = formatStandardNumber(this.evaluated.value);
    }
    get composerContent() {
        var _a;
        if ((_a = this.format) === null || _a === void 0 ? void 0 : _a.includes("%")) {
            return `${this.evaluated.value * 100}%`;
        }
        return super.composerContent;
    }
}
export class BooleanCell extends AbstractCell {
    constructor(id, value, properties = {}) {
        super(id, { value: value, type: CellValueType.boolean }, properties);
        this.content = this.evaluated.value ? "TRUE" : "FALSE";
    }
}
export class TextCell extends AbstractCell {
    constructor(id, value, properties = {}) {
        super(id, { value: value, type: CellValueType.text }, properties);
        this.content = this.evaluated.value;
    }
}
/**
 * A date time cell is a number cell with a required
 * date time format.
 */
export class DateTimeCell extends NumberCell {
    constructor(id, value, properties) {
        super(id, value, properties);
        this.format = properties.format;
    }
    get composerContent() {
        return formatDateTime({ value: this.evaluated.value, format: this.format });
    }
}
export class LinkCell extends AbstractCell {
    constructor(id, content, properties = {}) {
        var _a;
        const link = parseMarkdownLink(content);
        properties = {
            ...properties,
            style: {
                ...properties.style,
                textColor: ((_a = properties.style) === null || _a === void 0 ? void 0 : _a.textColor) || LINK_COLOR,
                underline: true,
            },
        };
        super(id, { value: link.label, type: CellValueType.text }, properties);
        this.link = link;
        this.content = content;
    }
    isLink() {
        return true;
    }
    get composerContent() {
        return this.link.label;
    }
}
/**
 * Simple web link cell
 */
export class WebLinkCell extends LinkCell {
    constructor(id, content, properties = {}) {
        super(id, content, properties);
        this.link.url = this.withHttp(this.link.url);
        this.link.isExternal = true;
        this.content = markdownLink(this.link.label, this.link.url);
        this.urlRepresentation = this.link.url;
        this.isUrlEditable = true;
    }
    action(env) {
        window.open(this.link.url, "_blank");
    }
    /**
     * Add the `https` prefix to the url if it's missing
     */
    withHttp(url) {
        return !/^https?:\/\//i.test(url) ? `https://${url}` : url;
    }
}
/**
 * Link redirecting to a given sheet in the workbook.
 */
export class SheetLinkCell extends LinkCell {
    constructor(id, content, properties = {}, sheetName) {
        super(id, content, properties);
        this.sheetName = sheetName;
        this.sheetId = parseSheetLink(this.link.url);
        this.isUrlEditable = false;
    }
    action(env) {
        env.model.dispatch("ACTIVATE_SHEET", {
            sheetIdFrom: env.model.getters.getActiveSheetId(),
            sheetIdTo: this.sheetId,
        });
    }
    get urlRepresentation() {
        return this.sheetName(this.sheetId) || _lt("Invalid sheet");
    }
}
export class FormulaCell extends AbstractCell {
    constructor(buildFormulaString, id, normalizedText, compiledFormula, dependencies, properties) {
        super(id, { value: LOADING, type: CellValueType.text }, properties);
        this.buildFormulaString = buildFormulaString;
        this.normalizedText = normalizedText;
        this.compiledFormula = compiledFormula;
        this.dependencies = dependencies;
    }
    get content() {
        return this.buildFormulaString(this);
    }
    isFormula() {
        return true;
    }
    startEvaluation() {
        this.evaluated = { value: LOADING, type: CellValueType.text };
    }
    assignValue(value) {
        switch (typeof value) {
            case "number":
                this.evaluated = {
                    value,
                    type: CellValueType.number,
                };
                break;
            case "boolean":
                this.evaluated = {
                    value,
                    type: CellValueType.boolean,
                };
                break;
            case "string":
                this.evaluated = {
                    value,
                    type: CellValueType.text,
                };
                break;
            // `null` and `undefined` values are not allowed according to `CellValue`
            // but it actually happens with empty evaluated cells.
            // TODO fix `CellValue`
            case "object": // null
                this.evaluated = {
                    value,
                    type: CellValueType.empty,
                };
                break;
            case "undefined":
                this.evaluated = {
                    value,
                    type: CellValueType.empty,
                };
                break;
        }
    }
    assignError(value, errorMessage) {
        this.evaluated = {
            value,
            error: errorMessage,
            type: CellValueType.error,
        };
    }
}
/**
 * Cell containing a formula which could not be compiled
 * or a content which could not be parsed.
 */
export class BadExpressionCell extends AbstractCell {
    /**
     * @param id
     * @param content Invalid formula string
     * @param error Compilation or parsing error
     * @param properties
     */
    constructor(id, content, error, properties) {
        super(id, { value: "#BAD_EXPR", type: CellValueType.error, error }, properties);
        this.content = content;
    }
}
//# sourceMappingURL=cell_types.js.map