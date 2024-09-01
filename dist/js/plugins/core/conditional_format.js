import { compile } from "../../formulas/index";
import { isInside, zoneToXc } from "../../helpers/index";
import { CorePlugin } from "../core_plugin";
// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
function stringToNumber(value) {
    return value === "" ? NaN : Number(value);
}
export class ConditionalFormatPlugin extends CorePlugin {
    constructor() {
        super(...arguments);
        this.cfRules = {};
    }
    loopThroughRangesOfSheet(sheetId, applyChange) {
        for (const rule of this.cfRules[sheetId]) {
            for (const range of rule.ranges) {
                const change = applyChange(range);
                switch (change.changeType) {
                    case "REMOVE":
                        let copy = rule.ranges.slice();
                        copy.splice(rule.ranges.indexOf(range), 1);
                        if (copy.length >= 1) {
                            this.history.update("cfRules", sheetId, this.cfRules[sheetId].indexOf(rule), "ranges", copy);
                        }
                        else {
                            this.removeConditionalFormatting(rule.id, sheetId);
                        }
                        break;
                    case "RESIZE":
                    case "MOVE":
                    case "CHANGE":
                        this.history.update("cfRules", sheetId, this.cfRules[sheetId].indexOf(rule), "ranges", rule.ranges.indexOf(range), change.range);
                        break;
                }
            }
        }
    }
    adaptRanges(applyChange, sheetId) {
        if (sheetId) {
            this.loopThroughRangesOfSheet(sheetId, applyChange);
        }
        else {
            for (const sheetId of Object.keys(this.cfRules)) {
                this.loopThroughRangesOfSheet(sheetId, applyChange);
            }
        }
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    allowDispatch(cmd) {
        switch (cmd.type) {
            case "ADD_CONDITIONAL_FORMAT":
                return this.checkValidations(cmd, this.checkCFRule, this.checkEmptyRange);
            case "MOVE_CONDITIONAL_FORMAT":
                return this.checkValidReordering(cmd.cfId, cmd.direction, cmd.sheetId);
        }
        return 0 /* Success */;
    }
    handle(cmd) {
        switch (cmd.type) {
            case "CREATE_SHEET":
                this.cfRules[cmd.sheetId] = [];
                break;
            case "DUPLICATE_SHEET":
                this.history.update("cfRules", cmd.sheetIdTo, []);
                for (const cf of this.getConditionalFormats(cmd.sheetId)) {
                    this.addConditionalFormatting(cf, cmd.sheetIdTo);
                }
                break;
            case "DELETE_SHEET":
                const cfRules = Object.assign({}, this.cfRules);
                delete cfRules[cmd.sheetId];
                this.history.update("cfRules", cfRules);
                break;
            case "ADD_CONDITIONAL_FORMAT":
                const cf = {
                    ...cmd.cf,
                    ranges: cmd.target.map(zoneToXc),
                };
                this.addConditionalFormatting(cf, cmd.sheetId);
                break;
            case "REMOVE_CONDITIONAL_FORMAT":
                this.removeConditionalFormatting(cmd.id, cmd.sheetId);
                break;
            case "MOVE_CONDITIONAL_FORMAT":
                this.reorderConditionalFormatting(cmd.cfId, cmd.direction, cmd.sheetId);
                break;
        }
    }
    import(data) {
        for (let sheet of data.sheets) {
            this.cfRules[sheet.id] = sheet.conditionalFormats.map((rule) => this.mapToConditionalFormatInternal(sheet.id, rule));
        }
    }
    export(data) {
        if (data.sheets) {
            for (let sheet of data.sheets) {
                if (this.cfRules[sheet.id]) {
                    sheet.conditionalFormats = this.cfRules[sheet.id].map((rule) => this.mapToConditionalFormat(sheet.id, rule));
                }
            }
        }
    }
    exportForExcel(data) {
        this.export(data);
    }
    // ---------------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------------
    /**
     * Returns all the conditional format rules defined for the current sheet to display the user
     */
    getConditionalFormats(sheetId) {
        return this.cfRules[sheetId].map((cf) => this.mapToConditionalFormat(sheetId, cf)) || [];
    }
    getRulesSelection(sheetId, selection) {
        const ruleIds = new Set();
        selection.forEach((zone) => {
            const zoneRuleId = this.getRulesByZone(sheetId, zone);
            zoneRuleId.forEach((ruleId) => {
                ruleIds.add(ruleId);
            });
        });
        return Array.from(ruleIds);
    }
    getRulesByZone(sheetId, zone) {
        const ruleIds = new Set();
        for (let row = zone.top; row <= zone.bottom; row++) {
            for (let col = zone.left; col <= zone.right; col++) {
                const cellRules = this.getRulesByCell(sheetId, col, row);
                cellRules.forEach((rule) => {
                    ruleIds.add(rule.id);
                });
            }
        }
        return ruleIds;
    }
    getRulesByCell(sheetId, cellCol, cellRow) {
        const rules = [];
        for (let cf of this.cfRules[sheetId]) {
            for (let range of cf.ranges) {
                if (isInside(cellCol, cellRow, range.zone)) {
                    rules.push(cf);
                }
            }
        }
        return new Set(rules.map((rule) => {
            return this.mapToConditionalFormat(sheetId, rule);
        }));
    }
    // ---------------------------------------------------------------------------
    // Private
    // ---------------------------------------------------------------------------
    mapToConditionalFormat(sheetId, cf) {
        return {
            ...cf,
            ranges: cf.ranges.map((range) => {
                return this.getters.getRangeString(range, sheetId);
            }),
        };
    }
    mapToConditionalFormatInternal(sheet, cf) {
        const conditionalFormat = {
            ...cf,
            ranges: cf.ranges.map((range) => {
                return this.getters.getRangeFromSheetXC(sheet, range);
            }),
        };
        return conditionalFormat;
    }
    /**
     * Add or replace a conditional format rule
     */
    addConditionalFormatting(cf, sheet) {
        const currentCF = this.cfRules[sheet].slice();
        const replaceIndex = currentCF.findIndex((c) => c.id === cf.id);
        const newCF = this.mapToConditionalFormatInternal(sheet, cf);
        if (replaceIndex > -1) {
            currentCF.splice(replaceIndex, 1, newCF);
        }
        else {
            currentCF.push(newCF);
        }
        this.history.update("cfRules", sheet, currentCF);
    }
    checkValidReordering(cfId, direction, sheetId) {
        if (!this.cfRules[sheetId])
            return 21 /* InvalidSheetId */;
        const ruleIndex = this.cfRules[sheetId].findIndex((cf) => cf.id === cfId);
        if (ruleIndex === -1)
            return 54 /* InvalidConditionalFormatId */;
        const cfIndex2 = direction === "up" ? ruleIndex - 1 : ruleIndex + 1;
        if (cfIndex2 < 0 || cfIndex2 >= this.cfRules[sheetId].length) {
            return 54 /* InvalidConditionalFormatId */;
        }
        return 0 /* Success */;
    }
    checkEmptyRange(cmd) {
        return cmd.target.length ? 0 /* Success */ : 19 /* EmptyRange */;
    }
    checkCFRule(cmd) {
        const rule = cmd.cf.rule;
        switch (rule.type) {
            case "CellIsRule":
                return this.checkValidations(rule, this.checkOperatorArgsNumber(2, ["Between", "NotBetween"]), this.checkOperatorArgsNumber(1, [
                    "BeginsWith",
                    "ContainsText",
                    "EndsWith",
                    "GreaterThan",
                    "GreaterThanOrEqual",
                    "LessThan",
                    "LessThanOrEqual",
                    "NotContains",
                ]), this.checkOperatorArgsNumber(0, ["IsEmpty", "IsNotEmpty"]));
            case "ColorScaleRule": {
                return this.checkValidations(rule, this.chainValidations(this.checkThresholds(this.checkFormulaCompilation)), this.chainValidations(this.checkThresholds(this.checkNaN), this.batchValidations(this.checkMinBiggerThanMax, this.checkMinBiggerThanMid, this.checkMidBiggerThanMax
                // ☝️ Those three validations can be factorized further
                )));
            }
            case "IconSetRule": {
                return this.checkValidations(rule, this.chainValidations(this.checkInflectionPoints(this.checkNaN), this.checkLowerBiggerThanUpper), this.chainValidations(this.checkInflectionPoints(this.checkFormulaCompilation)));
            }
        }
        return 0 /* Success */;
    }
    checkOperatorArgsNumber(expectedNumber, operators) {
        if (expectedNumber > 2) {
            throw new Error("Checking more than 2 arguments is currently not supported. Add the appropriate CommandResult if you want to.");
        }
        return (rule) => {
            if (operators.includes(rule.operator)) {
                const errors = [];
                const isEmpty = (value) => value === undefined || value === "";
                if (expectedNumber >= 1 && isEmpty(rule.values[0])) {
                    errors.push(34 /* FirstArgMissing */);
                }
                if (expectedNumber >= 2 && isEmpty(rule.values[1])) {
                    errors.push(35 /* SecondArgMissing */);
                }
                return errors.length ? errors : 0 /* Success */;
            }
            return 0 /* Success */;
        };
    }
    checkNaN(threshold, thresholdName) {
        if (["number", "percentage", "percentile"].includes(threshold.type) &&
            (threshold.value === "" || isNaN(threshold.value))) {
            switch (thresholdName) {
                case "min":
                    return 36 /* MinNaN */;
                case "max":
                    return 38 /* MaxNaN */;
                case "mid":
                    return 37 /* MidNaN */;
                case "upperInflectionPoint":
                    return 39 /* ValueUpperInflectionNaN */;
                case "lowerInflectionPoint":
                    return 40 /* ValueLowerInflectionNaN */;
            }
        }
        return 0 /* Success */;
    }
    checkFormulaCompilation(threshold, thresholdName) {
        if (threshold.type !== "formula")
            return 0 /* Success */;
        try {
            compile(threshold.value || "");
        }
        catch (error) {
            switch (thresholdName) {
                case "min":
                    return 41 /* MinInvalidFormula */;
                case "max":
                    return 43 /* MaxInvalidFormula */;
                case "mid":
                    return 42 /* MidInvalidFormula */;
                case "upperInflectionPoint":
                    return 44 /* ValueUpperInvalidFormula */;
                case "lowerInflectionPoint":
                    return 45 /* ValueLowerInvalidFormula */;
            }
        }
        return 0 /* Success */;
    }
    checkThresholds(check) {
        return this.batchValidations((rule) => check(rule.minimum, "min"), (rule) => check(rule.maximum, "max"), (rule) => (rule.midpoint ? check(rule.midpoint, "mid") : 0 /* Success */));
    }
    checkInflectionPoints(check) {
        return this.batchValidations((rule) => check(rule.lowerInflectionPoint, "lowerInflectionPoint"), (rule) => check(rule.upperInflectionPoint, "upperInflectionPoint"));
    }
    checkLowerBiggerThanUpper(rule) {
        const minValue = rule.lowerInflectionPoint.value;
        const maxValue = rule.upperInflectionPoint.value;
        if (["number", "percentage", "percentile"].includes(rule.lowerInflectionPoint.type) &&
            rule.lowerInflectionPoint.type === rule.upperInflectionPoint.type &&
            Number(minValue) > Number(maxValue)) {
            return 31 /* LowerBiggerThanUpper */;
        }
        return 0 /* Success */;
    }
    checkMinBiggerThanMax(rule) {
        const minValue = rule.minimum.value;
        const maxValue = rule.maximum.value;
        if (["number", "percentage", "percentile"].includes(rule.minimum.type) &&
            rule.minimum.type === rule.maximum.type &&
            stringToNumber(minValue) >= stringToNumber(maxValue)) {
            return 30 /* MinBiggerThanMax */;
        }
        return 0 /* Success */;
    }
    checkMidBiggerThanMax(rule) {
        var _a;
        const midValue = (_a = rule.midpoint) === null || _a === void 0 ? void 0 : _a.value;
        const maxValue = rule.maximum.value;
        if (rule.midpoint &&
            ["number", "percentage", "percentile"].includes(rule.midpoint.type) &&
            rule.midpoint.type === rule.maximum.type &&
            stringToNumber(midValue) >= stringToNumber(maxValue)) {
            return 32 /* MidBiggerThanMax */;
        }
        return 0 /* Success */;
    }
    checkMinBiggerThanMid(rule) {
        var _a;
        const minValue = rule.minimum.value;
        const midValue = (_a = rule.midpoint) === null || _a === void 0 ? void 0 : _a.value;
        if (rule.midpoint &&
            ["number", "percentage", "percentile"].includes(rule.midpoint.type) &&
            rule.minimum.type === rule.midpoint.type &&
            stringToNumber(minValue) >= stringToNumber(midValue)) {
            return 33 /* MinBiggerThanMid */;
        }
        return 0 /* Success */;
    }
    removeConditionalFormatting(id, sheet) {
        const cfIndex = this.cfRules[sheet].findIndex((s) => s.id === id);
        if (cfIndex !== -1) {
            const currentCF = this.cfRules[sheet].slice();
            currentCF.splice(cfIndex, 1);
            this.history.update("cfRules", sheet, currentCF);
        }
    }
    reorderConditionalFormatting(cfId, direction, sheetId) {
        const cfIndex1 = this.cfRules[sheetId].findIndex((s) => s.id === cfId);
        const cfIndex2 = direction === "up" ? cfIndex1 - 1 : cfIndex1 + 1;
        if (cfIndex2 < 0 || cfIndex2 >= this.cfRules[sheetId].length)
            return;
        if (cfIndex1 !== -1 && cfIndex2 !== -1) {
            const currentCF = [...this.cfRules[sheetId]];
            const tmp = currentCF[cfIndex1];
            currentCF[cfIndex1] = currentCF[cfIndex2];
            currentCF[cfIndex2] = tmp;
            this.history.update("cfRules", sheetId, currentCF);
        }
    }
}
ConditionalFormatPlugin.getters = ["getConditionalFormats", "getRulesSelection", "getRulesByCell"];
//# sourceMappingURL=conditional_format.js.map