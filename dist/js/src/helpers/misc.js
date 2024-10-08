//------------------------------------------------------------------------------
// Miscellaneous
//------------------------------------------------------------------------------
import { DEFAULT_FONT, DEFAULT_FONT_SIZE, DEFAULT_FONT_WEIGHT, MIN_CF_ICON_MARGIN, } from "../constants";
import { fontSizeMap } from "../fonts";
import { parseDateTime } from "./dates";
/**
 * Stringify an object, like JSON.stringify, except that the first level of keys
 * is ordered.
 */
export function stringify(obj) {
    return JSON.stringify(obj, Object.keys(obj).sort());
}
/**
 * Remove quotes from a quoted string
 * ```js
 * removeStringQuotes('"Hello"')
 * > 'Hello'
 * ```
 */
export function removeStringQuotes(str) {
    if (str[0] === '"' && str[str.length - 1] === '"') {
        return str.slice(1).slice(0, str.length - 2);
    }
    return str;
}
/**
 * Deep copy arrays, plain objects and primitive values.
 * Throws an error for other types such as class instances.
 * Sparse arrays remain sparse.
 */
export function deepCopy(obj) {
    const result = Array.isArray(obj) ? [] : {};
    switch (typeof obj) {
        case "object": {
            if (obj === null) {
                return obj;
            }
            else if (!(isPlainObject(obj) || obj instanceof Array)) {
                throw new Error("Unsupported type: only objects and arrays are supported");
            }
            for (const key in obj) {
                result[key] = deepCopy(obj[key]);
            }
            return result;
        }
        case "number":
        case "string":
        case "boolean":
        case "function":
        case "undefined":
            return obj;
        default:
            throw new Error(`Unsupported type: ${typeof obj}`);
    }
}
/**
 * Check if the object is a plain old javascript object.
 */
function isPlainObject(obj) {
    return typeof obj === "object" && (obj === null || obj === void 0 ? void 0 : obj.constructor) === Object;
}
/**
 * Sanitize the name of a sheet, by eventually removing quotes
 * @param sheetName name of the sheet, potentially quoted with single quotes
 */
export function getUnquotedSheetName(sheetName) {
    if (sheetName.startsWith("'")) {
        sheetName = sheetName.slice(1, -1).replace(/''/g, "'");
    }
    return sheetName;
}
/**
 * Add quotes around the sheet name if it contains at least one non alphanumeric character
 * '\w' captures [0-9][a-z][A-Z] and _.
 * @param sheetName Name of the sheet
 */
export function getComposerSheetName(sheetName) {
    var _a;
    if (((_a = sheetName.match(/\w/g)) === null || _a === void 0 ? void 0 : _a.length) !== sheetName.length) {
        sheetName = `'${sheetName}'`;
    }
    return sheetName;
}
export function clip(val, min, max) {
    return val < min ? min : val > max ? max : val;
}
export function computeTextWidth(context, text, style) {
    const italic = style.italic ? "italic " : "";
    const weight = style.bold ? "bold" : DEFAULT_FONT_WEIGHT;
    const sizeInPt = style.fontSize || DEFAULT_FONT_SIZE;
    const size = fontSizeMap[sizeInPt];
    context.font = `${italic}${weight} ${size}px ${DEFAULT_FONT}`;
    return context.measureText(text).width;
}
export function computeIconWidth(context, style) {
    const sizeInPt = style.fontSize || DEFAULT_FONT_SIZE;
    const size = fontSizeMap[sizeInPt];
    return size + 2 * MIN_CF_ICON_MARGIN;
}
/**
 * Create a range from start (included) to end (excluded).
 * range(10, 13) => [10, 11, 12]
 * range(2, 8, 2) => [2, 4, 6]
 */
export function range(start, end, step = 1) {
    if (end <= start && step > 0) {
        return [];
    }
    if (step === 0) {
        throw new Error("range() step must not be zero");
    }
    const length = Math.ceil(Math.abs((end - start) / step));
    const array = Array(length);
    for (let i = 0; i < length; i++) {
        array[i] = start + i * step;
    }
    return array;
}
/**
 * Groups consecutive numbers.
 * The input array is assumed to be sorted
 * @param numbers
 */
export function groupConsecutive(numbers) {
    return numbers.reduce((groups, currentRow, index, rows) => {
        if (Math.abs(currentRow - rows[index - 1]) === 1) {
            const lastGroup = groups[groups.length - 1];
            lastGroup.push(currentRow);
        }
        else {
            groups.push([currentRow]);
        }
        return groups;
    }, []);
}
/**
 * Create one generator from two generators by linking
 * each item of the first generator to the next item of
 * the second generator.
 *
 * Let's say generator G1 yields A, B, C and generator G2 yields X, Y, Z.
 * The resulting generator of `linkNext(G1, G2)` will yield A', B', C'
 * where `A' = A & {next: Y}`, `B' = B & {next: Z}` and `C' = C & {next: undefined}`
 * @param generator
 * @param nextGenerator
 */
export function* linkNext(generator, nextGenerator) {
    nextGenerator.next();
    for (const item of generator) {
        const nextItem = nextGenerator.next();
        yield {
            ...item,
            next: nextItem.done ? undefined : nextItem.value,
        };
    }
}
export function isBoolean(str) {
    const upperCased = str.toUpperCase();
    return upperCased === "TRUE" || upperCased === "FALSE";
}
export function isDateTime(str) {
    return parseDateTime(str) !== null;
}
const MARKDOWN_LINK_REGEX = /^\[([^\[]+)\]\((.+)\)$/;
//link must start with http or https
//https://stackoverflow.com/a/3809435/4760614
const WEB_LINK_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/;
export function isMarkdownLink(str) {
    return MARKDOWN_LINK_REGEX.test(str);
}
/**
 * Check if the string is a web link.
 * e.g. http://odoo.com
 */
export function isWebLink(str) {
    return WEB_LINK_REGEX.test(str);
}
/**
 * Build a markdown link from a label and an url
 */
export function markdownLink(label, url) {
    return `[${label}](${url})`;
}
export function parseMarkdownLink(str) {
    const matches = str.match(MARKDOWN_LINK_REGEX) || [];
    const label = matches[1];
    const url = matches[2];
    if (!label || !url) {
        throw new Error(`Could not parse markdown link ${str}.`);
    }
    return {
        label,
        url,
    };
}
const O_SPREADSHEET_LINK_PREFIX = "o-spreadsheet://";
export function isMarkdownSheetLink(str) {
    if (!isMarkdownLink(str)) {
        return false;
    }
    const { url } = parseMarkdownLink(str);
    return url.startsWith(O_SPREADSHEET_LINK_PREFIX);
}
export function buildSheetLink(sheetId) {
    return `${O_SPREADSHEET_LINK_PREFIX}${sheetId}`;
}
/**
 * Parse a sheet link and return the sheet id
 */
export function parseSheetLink(sheetLink) {
    if (sheetLink.startsWith(O_SPREADSHEET_LINK_PREFIX)) {
        return sheetLink.substr(O_SPREADSHEET_LINK_PREFIX.length);
    }
    throw new Error(`${sheetLink} is not a valid sheet link`);
}
/**
 * This helper function can be used as a type guard when filtering arrays.
 * const foo: number[] = [1, 2, undefined, 4].filter(isDefined)
 */
export function isDefined(argument) {
    return argument !== undefined;
}
/**
 * Get the id of the given item (its key in the given dictionnary).
 * If the given item does not exist in the dictionary, it creates one with a new id.
 */
export function getItemId(item, itemsDic) {
    for (let [key, value] of Object.entries(itemsDic)) {
        if (stringify(value) === stringify(item)) {
            return parseInt(key, 10);
        }
    }
    // Generate new Id if the item didn't exist in the dictionary
    const ids = Object.keys(itemsDic);
    const maxId = ids.length === 0 ? 0 : Math.max(...ids.map((id) => parseInt(id, 10)));
    itemsDic[maxId + 1] = item;
    return maxId + 1;
}
/**
 * This method comes from owl 1 as it was removed in owl 2
 *
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 *
 * Inspired by https://davidwalsh.name/javascript-debounce-function
 */
export function debounce(func, wait, immediate) {
    let timeout;
    return function () {
        const context = this;
        const args = arguments;
        function later() {
            timeout = null;
            if (!immediate) {
                func.apply(context, args);
            }
        }
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) {
            func.apply(context, args);
        }
    };
}
/*
 * Concatenate an array of strings.
 */
export function concat(chars) {
    // ~40% faster than chars.join("")
    let output = "";
    for (let i = 0, len = chars.length; i < len; i++) {
        output += chars[i];
    }
    return output;
}
//# sourceMappingURL=misc.js.map