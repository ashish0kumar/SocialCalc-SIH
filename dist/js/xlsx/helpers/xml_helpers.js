import { DEFAULT_FONT_SIZE } from "../../constants";
import { concat } from "../../helpers";
import { XMLString, } from "../../types/xlsx";
// -------------------------------------
//            XML HELPERS
// -------------------------------------
export function createXMLFile(doc, path, contentType) {
    return {
        content: new XMLSerializer().serializeToString(doc),
        path,
        contentType,
    };
}
function xmlEscape(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
export function formatAttributes(attrs) {
    return new XMLString(attrs.map(([key, val]) => `${key}="${xmlEscape(val)}"`).join(" "));
}
export function parseXML(xmlString) {
    const document = new DOMParser().parseFromString(xmlString.toString(), "text/xml");
    const parserError = document.querySelector("parsererror");
    if (parserError) {
        const errorString = parserError.innerHTML;
        const lineNumber = parseInt(errorString.split(":")[0], 10);
        const xmlStringArray = xmlString.toString().trim().split("\n");
        const xmlPreview = xmlStringArray
            .slice(Math.max(lineNumber - 3, 0), Math.min(lineNumber + 2, xmlStringArray.length))
            .join("\n");
        throw new Error(`XML string could not be parsed: ${errorString}\n${xmlPreview}`);
    }
    return document;
}
export function getDefaultXLSXStructure() {
    return {
        relsFiles: [],
        sharedStrings: [],
        // default Values that will always be part of the style sheet
        styles: [
            {
                fontId: 0,
                fillId: 0,
                numFmtId: 0,
                borderId: 0,
                verticalAlignment: "center",
            },
        ],
        fonts: [
            {
                size: DEFAULT_FONT_SIZE,
                family: 2,
                color: "000000",
                name: "Calibri",
            },
        ],
        fills: [{ reservedAttribute: "none" }, { reservedAttribute: "gray125" }],
        borders: [{}],
        numFmts: [],
        dxfs: [],
    };
}
export function createOverride(partName, contentType) {
    return escapeXml /*xml*/ `
    <Override ContentType="${contentType}" PartName="${partName}" />
  `;
}
export function joinXmlNodes(xmlNodes) {
    return new XMLString(xmlNodes.join("\n"));
}
/**
 * Escape interpolated values except if the value is already
 * a properly escaped XML string.
 *
 * ```
 * escapeXml`<t>${"This will be escaped"}</t>`
 * ```
 */
export function escapeXml(strings, ...expressions) {
    let str = [strings[0]];
    for (let i = 0; i < expressions.length; i++) {
        const value = expressions[i] instanceof XMLString ? expressions[i] : xmlEscape(expressions[i]);
        str.push(value + strings[i + 1]);
    }
    return new XMLString(concat(str));
}
//# sourceMappingURL=xml_helpers.js.map