import { isBoolean, isDateTime, isNumber, parseDateTime, parseNumber } from "..";
import { DATETIME_FORMAT } from "../../constants";
import { formatDateTime } from "../dates";
import { formatNumber, formatStandardNumber } from "../numbers";
/**
 * Format a cell value with its format.
 */
export function formatValue(value, format) {
    switch (typeof value) {
        case "string":
            return value;
        case "boolean":
            return value ? "TRUE" : "FALSE";
        case "number":
            if (format === null || format === void 0 ? void 0 : format.match(DATETIME_FORMAT)) {
                return formatDateTime({ value, format: format });
            }
            return format ? formatNumber(value, format) : formatStandardNumber(value);
        case "object":
            return "0";
    }
}
/**
 * Parse a string representing a primitive cell value
 */
export function parsePrimitiveContent(content) {
    if (content === "") {
        return "";
    }
    else if (isNumber(content)) {
        return parseNumber(content);
    }
    else if (isBoolean(content)) {
        return content.toUpperCase() === "TRUE" ? true : false;
    }
    else if (isDateTime(content)) {
        return parseDateTime(content).value;
    }
    else {
        return content;
    }
}
//# sourceMappingURL=cell_helpers.js.map