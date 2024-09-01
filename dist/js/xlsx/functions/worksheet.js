import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH } from "../../constants";
import { isMarkdownLink, isMarkdownSheetLink, parseMarkdownLink, parseSheetLink, toXC, } from "../../helpers";
import { addRelsToFile, convertHeight, convertWidth, extractStyle, normalizeStyle, } from "../helpers/content_helpers";
import { escapeXml, formatAttributes, joinXmlNodes } from "../helpers/xml_helpers";
import { addContent, addFormula } from "./cells";
export function addColumns(cols) {
    if (!Object.values(cols).length) {
        return escapeXml ``;
    }
    const colNodes = [];
    for (let [id, col] of Object.entries(cols)) {
        // Always force our own col width
        const attributes = [
            ["min", parseInt(id) + 1],
            ["max", parseInt(id) + 1],
            ["width", convertWidth(col.size || DEFAULT_CELL_WIDTH)],
            ["customWidth", 1],
            ["hidden", col.isHidden ? 1 : 0],
        ];
        colNodes.push(escapeXml /*xml*/ `
      <col ${formatAttributes(attributes)}/>
    `);
    }
    return escapeXml /*xml*/ `
    <cols>
      ${joinXmlNodes(colNodes)}
    </cols>
  `;
}
export function addRows(construct, data, sheet) {
    const rowNodes = [];
    for (let r = 0; r < sheet.rowNumber; r++) {
        const rowAttrs = [["r", r + 1]];
        const row = sheet.rows[r] || {};
        // Always force our own row height
        rowAttrs.push(["ht", convertHeight(row.size || DEFAULT_CELL_HEIGHT)], ["customHeight", 1], ["hidden", row.isHidden ? 1 : 0]);
        const cellNodes = [];
        for (let c = 0; c < sheet.colNumber; c++) {
            const xc = toXC(c, r);
            const cell = sheet.cells[xc];
            if (cell) {
                const attributes = [["r", xc]];
                // style
                const id = normalizeStyle(construct, extractStyle(cell, data));
                attributes.push(["s", id]);
                let additionalAttrs = [];
                let cellNode = escapeXml ``;
                // Either formula or static value inside the cell
                if (cell.isFormula) {
                    ({ attrs: additionalAttrs, node: cellNode } = addFormula(cell));
                }
                else if (cell.content && isMarkdownLink(cell.content)) {
                    const { label } = parseMarkdownLink(cell.content);
                    ({ attrs: additionalAttrs, node: cellNode } = addContent(label, construct.sharedStrings));
                }
                else if (cell.content && cell.content !== "") {
                    ({ attrs: additionalAttrs, node: cellNode } = addContent(cell.content, construct.sharedStrings));
                }
                attributes.push(...additionalAttrs);
                cellNodes.push(escapeXml /*xml*/ `
          <c ${formatAttributes(attributes)}>
            ${cellNode}
          </c>
        `);
            }
        }
        if (cellNodes.length) {
            rowNodes.push(escapeXml /*xml*/ `
        <row ${formatAttributes(rowAttrs)}>
          ${joinXmlNodes(cellNodes)}
        </row>
      `);
        }
    }
    return escapeXml /*xml*/ `
    <sheetData>
      ${joinXmlNodes(rowNodes)}
    </sheetData>
  `;
}
export function addHyperlinks(construct, data, sheetIndex) {
    var _a;
    const sheet = data.sheets[sheetIndex];
    const cells = sheet.cells;
    const linkNodes = [];
    for (const xc in cells) {
        const content = (_a = cells[xc]) === null || _a === void 0 ? void 0 : _a.content;
        if (content && isMarkdownLink(content)) {
            const { label, url } = parseMarkdownLink(content);
            if (isMarkdownSheetLink(content)) {
                const sheetId = parseSheetLink(url);
                const sheet = data.sheets.find((sheet) => sheet.id === sheetId);
                linkNodes.push(escapeXml /*xml*/ `
          <hyperlink display="${label}" location="${sheet.name}!A1" ref="${xc}"/>
        `);
            }
            else {
                const linkRelId = addRelsToFile(construct.relsFiles, `xl/worksheets/_rels/sheet${sheetIndex}.xml.rels`, {
                    target: url,
                    type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
                    targetMode: "External",
                });
                linkNodes.push(escapeXml /*xml*/ `
          <hyperlink r:id="${linkRelId}" ref="${xc}"/>
        `);
            }
        }
    }
    if (!linkNodes.length) {
        return escapeXml ``;
    }
    return escapeXml /*xml*/ `
    <hyperlinks>
      ${joinXmlNodes(linkNodes)}
    </hyperlinks>
  `;
}
export function addMerges(merges) {
    if (merges.length) {
        const mergeNodes = merges.map((merge) => escapeXml /*xml*/ `<mergeCell ref="${merge}" />`);
        return escapeXml /*xml*/ `
      <mergeCells count="${merges.length}">
        ${joinXmlNodes(mergeNodes)}
      </mergeCells>
    `;
    }
    else
        return escapeXml ``;
}
//# sourceMappingURL=worksheet.js.map