import { colorNumberString } from "../../helpers";
import { XLSX_ICONSET_MAP } from "../constants";
import { convertOperator, pushElement } from "../helpers/content_helpers";
import { escapeXml, formatAttributes, joinXmlNodes } from "../helpers/xml_helpers";
import { adaptFormulaToExcel } from "./cells";
export function addConditionalFormatting(dxfs, conditionalFormats) {
    // Conditional Formats
    const cfNodes = [];
    for (const cf of conditionalFormats) {
        // Special case for each type of rule: might be better to extract that logic in dedicated functions
        switch (cf.rule.type) {
            case "CellIsRule":
                cfNodes.push(addCellIsRule(cf, cf.rule, dxfs));
                break;
            case "ColorScaleRule":
                cfNodes.push(addColorScaleRule(cf, cf.rule));
                break;
            case "IconSetRule":
                cfNodes.push(addIconSetRule(cf, cf.rule));
                break;
            default:
                // @ts-ignore Typescript knows it will never happen at compile time
                console.warn(`Conditional formatting ${cf.rule.type} not implemented`);
                break;
        }
    }
    return cfNodes;
}
// ----------------------
//         RULES
// ----------------------
function addCellIsRule(cf, rule, dxfs) {
    const ruleAttributes = commonCfAttributes(cf);
    ruleAttributes.push(["type", "cellIs"], ["operator", convertOperator(rule.operator)]);
    const formulas = rule.values.map((value) => escapeXml /*xml*/ `<formula>${value}</formula>`);
    const dxf = {};
    if (rule.style.textColor) {
        dxf.font = { color: rule.style.textColor };
    }
    if (rule.style.fillColor) {
        dxf.fill = { fgColor: rule.style.fillColor };
    }
    const { id } = pushElement(dxf, dxfs);
    ruleAttributes.push(["dxfId", id]);
    return escapeXml /*xml*/ `
    <conditionalFormatting sqref="${cf.ranges.join(" ")}">
      <cfRule ${formatAttributes(ruleAttributes)}>
        ${joinXmlNodes(formulas)}
      </cfRule>
    </conditionalFormatting>
  `;
}
function addColorScaleRule(cf, rule) {
    const ruleAttributes = commonCfAttributes(cf);
    ruleAttributes.push(["type", "colorScale"]);
    /** mimic our flow:
     * for a given ColorScale CF, each range of the "ranges set" has its own behaviour.
     */
    const conditionalFormats = [];
    for (const range of cf.ranges) {
        const cfValueObject = [];
        const colors = [];
        let canExport = true;
        for (let position of ["minimum", "midpoint", "maximum"]) {
            const threshold = rule[position];
            if (!threshold) {
                // pass midpoint if not defined
                continue;
            }
            if (threshold.type === "formula") {
                canExport = false;
                continue;
            }
            cfValueObject.push(thresholdAttributes(threshold, position));
            colors.push([["rgb", colorNumberString(threshold.color)]]);
        }
        if (!canExport) {
            console.warn("Conditional formats with formula rules are not supported at the moment. The rule is therefore skipped.");
            continue;
        }
        const cfValueObjectNodes = cfValueObject.map((attrs) => escapeXml /*xml*/ `<cfvo ${formatAttributes(attrs)}/>`);
        const cfColorNodes = colors.map((attrs) => escapeXml /*xml*/ `<color ${formatAttributes(attrs)}/>`);
        conditionalFormats.push(escapeXml /*xml*/ `
      <conditionalFormatting sqref="${range}">
        <cfRule ${formatAttributes(ruleAttributes)}>
          <colorScale>
            ${joinXmlNodes(cfValueObjectNodes)}
            ${joinXmlNodes(cfColorNodes)}
          </colorScale>
        </cfRule>
      </conditionalFormatting>
    `);
    }
    return joinXmlNodes(conditionalFormats);
}
function addIconSetRule(cf, rule) {
    const ruleAttributes = commonCfAttributes(cf);
    ruleAttributes.push(["type", "iconSet"]);
    /** mimic our flow:
     * for a given IconSet CF, each range of the "ranges set" has its own behaviour.
     */
    const conditionalFormats = [];
    for (const range of cf.ranges) {
        const cfValueObject = [
            // It looks like they always want 3 cfvo and they add a dummy entry
            [
                ["type", "percent"],
                ["val", 0],
            ],
        ];
        let canExport = true;
        for (let position of ["lowerInflectionPoint", "upperInflectionPoint"]) {
            if (rule[position].type === "formula") {
                canExport = false;
                continue;
            }
            const threshold = rule[position];
            cfValueObject.push([
                ...thresholdAttributes(threshold, position),
                ["gte", threshold.operator === "ge" ? "1" : "0"],
            ]);
        }
        if (!canExport) {
            console.warn("Conditional formats with formula rules are not supported at the moment. The rule is therefore skipped.");
            continue;
        }
        const cfValueObjectNodes = cfValueObject.map((attrs) => escapeXml /*xml*/ `<cfvo ${formatAttributes(attrs)} />`);
        conditionalFormats.push(escapeXml /*xml*/ `
      <conditionalFormatting sqref="${range}">
        <cfRule ${formatAttributes(ruleAttributes)}>
          <iconSet iconSet="${getIconSet(rule.icons)}">
            ${joinXmlNodes(cfValueObjectNodes)}
          </iconSet>
        </cfRule>
      </conditionalFormatting>
    `);
    }
    return joinXmlNodes(conditionalFormats);
}
// ----------------------
//         MISC
// ----------------------
function commonCfAttributes(cf) {
    return [
        ["priority", 1],
        ["stopIfTrue", cf.stopIfTrue ? 1 : 0],
    ];
}
function getIconSet(iconSet) {
    return XLSX_ICONSET_MAP[Object.keys(XLSX_ICONSET_MAP).find((key) => iconSet.upper.toLowerCase().startsWith(key)) ||
        "dots"];
}
function thresholdAttributes(threshold, position) {
    const type = getExcelThresholdType(threshold.type, position);
    const attrs = [["type", type]];
    if (type !== "min" && type !== "max") {
        // what if the formula is not correct
        // references cannot be relative :/
        let val = threshold.value;
        if (type === "formula") {
            try {
                // Relative references are not supported in formula
                val = adaptFormulaToExcel(threshold.value);
            }
            catch (error) {
                val = threshold.value;
            }
        }
        attrs.push(["val", val]); // value is undefined only for type="value")
    }
    return attrs;
}
/**
 * This function adapts our Threshold types to their Excel equivalents.
 *
 * if type === "value" ,then we must replace it by min or max according to the position
 * if type === "number", then it becomes num
 * if type === "percentage", it becomes "percent"
 * rest of the time, the type is unchanged
 */
function getExcelThresholdType(type, position) {
    switch (type) {
        case "value":
            return position === "minimum" ? "min" : "max";
        case "number":
            return "num";
        case "percentage":
            return "percent";
        default:
            return type;
    }
}
//# sourceMappingURL=conditional_formatting.js.map