import { INCORRECT_RANGE_STRING } from "../../constants";
import { deepCopy, rangeReference, zoneToDimension, zoneToXc } from "../../helpers/index";
import { CorePlugin } from "../core_plugin";
export class ChartPlugin extends CorePlugin {
    constructor() {
        super(...arguments);
        this.chartFigures = {};
        this.nextId = 1;
    }
    adaptRanges(applyChange) {
        for (let [chartId, chart] of Object.entries(this.chartFigures)) {
            if (chart) {
                this.adaptDataSetRanges(chart, chartId, applyChange);
                this.adaptLabelRanges(chart, chartId, applyChange);
            }
        }
    }
    adaptDataSetRanges(chart, chartId, applyChange) {
        for (let ds of chart.dataSets) {
            if (ds.labelCell) {
                const labelCellChange = applyChange(ds.labelCell);
                switch (labelCellChange.changeType) {
                    case "REMOVE":
                        this.history.update("chartFigures", chartId, "dataSets", chart.dataSets.indexOf(ds), "labelCell", undefined);
                        break;
                    case "RESIZE":
                    case "MOVE":
                    case "CHANGE":
                        this.history.update("chartFigures", chartId, "dataSets", chart.dataSets.indexOf(ds), "labelCell", labelCellChange.range);
                }
            }
            const dataRangeChange = applyChange(ds.dataRange);
            switch (dataRangeChange.changeType) {
                case "REMOVE":
                    const newDataSets = chart.dataSets.filter((dataset) => dataset !== ds);
                    this.history.update("chartFigures", chartId, "dataSets", newDataSets);
                    break;
                case "RESIZE":
                case "MOVE":
                case "CHANGE":
                    // We have to remove the ranges that are #REF
                    if (this.getters.getRangeString(dataRangeChange.range, dataRangeChange.range.sheetId) !==
                        INCORRECT_RANGE_STRING) {
                        this.history.update("chartFigures", chartId, "dataSets", chart.dataSets.indexOf(ds), "dataRange", dataRangeChange.range);
                    }
                    else {
                        const newDataSets = chart.dataSets.filter((dataset) => dataset !== ds);
                        this.history.update("chartFigures", chartId, "dataSets", newDataSets);
                    }
                    break;
            }
        }
    }
    adaptLabelRanges(chart, chartId, applyChange) {
        if (chart.labelRange) {
            const labelRangeChange = applyChange(chart.labelRange);
            switch (labelRangeChange.changeType) {
                case "REMOVE":
                    this.history.update("chartFigures", chartId, "labelRange", undefined);
                    break;
                case "RESIZE":
                case "MOVE":
                case "CHANGE":
                    this.history.update("chartFigures", chartId, "labelRange", labelRangeChange.range);
                    break;
            }
        }
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    allowDispatch(cmd) {
        const success = 0 /* Success */;
        switch (cmd.type) {
            case "UPDATE_CHART":
            case "CREATE_CHART":
                return this.checkValidations(cmd, this.chainValidations(this.checkEmptyDataset, this.checkDataset), this.checkLabelRange);
            default:
                return success;
        }
    }
    handle(cmd) {
        var _a, _b;
        switch (cmd.type) {
            case "CREATE_CHART":
                const x = cmd.position ? cmd.position.x : 0;
                const y = cmd.position ? cmd.position.y : 0;
                this.addChartFigure(cmd.sheetId, this.createChartDefinition(cmd.definition, cmd.sheetId), {
                    id: cmd.id,
                    x,
                    y,
                    height: 335,
                    width: 536,
                    tag: "chart",
                });
                break;
            case "UPDATE_CHART": {
                this.updateChartDefinition(cmd.id, cmd.definition);
                break;
            }
            case "DUPLICATE_SHEET": {
                const sheetFiguresFrom = this.getters.getFigures(cmd.sheetId);
                for (const fig of sheetFiguresFrom) {
                    if (fig.tag === "chart") {
                        const id = this.nextId.toString();
                        this.history.update("nextId", this.nextId + 1);
                        const chartDefinition = { ...deepCopy(this.chartFigures[fig.id]), id };
                        chartDefinition.sheetId = cmd.sheetIdTo;
                        chartDefinition.dataSets.forEach((dataset) => {
                            var _a;
                            if (dataset.dataRange.sheetId === cmd.sheetId) {
                                dataset.dataRange.sheetId = cmd.sheetIdTo;
                            }
                            if (((_a = dataset.labelCell) === null || _a === void 0 ? void 0 : _a.sheetId) === cmd.sheetId) {
                                dataset.labelCell.sheetId = cmd.sheetIdTo;
                            }
                        });
                        if (((_a = chartDefinition.labelRange) === null || _a === void 0 ? void 0 : _a.sheetId) === cmd.sheetId) {
                            chartDefinition.labelRange.sheetId = cmd.sheetIdTo;
                        }
                        const figure = {
                            id: id,
                            x: fig.x,
                            y: fig.y,
                            height: fig.height,
                            width: fig.width,
                            tag: "chart",
                        };
                        this.addChartFigure(cmd.sheetIdTo, chartDefinition, figure);
                    }
                }
                break;
            }
            case "DELETE_FIGURE":
                this.history.update("chartFigures", cmd.id, undefined);
                break;
            case "DELETE_SHEET":
                for (let id of Object.keys(this.chartFigures)) {
                    if (((_b = this.chartFigures[id]) === null || _b === void 0 ? void 0 : _b.sheetId) === cmd.sheetId) {
                        this.history.update("chartFigures", id, undefined);
                    }
                }
                break;
        }
    }
    // ---------------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------------
    getChartDefinition(figureId) {
        return this.chartFigures[figureId];
    }
    getChartsIdBySheet(sheetId) {
        return Object.entries(this.chartFigures)
            .filter((chart) => {
            return chart[1].sheetId === sheetId;
        })
            .map((chart) => chart[0]);
    }
    getChartDefinitionUI(sheetId, figureId) {
        const data = this.chartFigures[figureId];
        const dataSets = data.dataSets
            .map((ds) => (ds ? this.getters.getRangeString(ds.dataRange, sheetId) : ""))
            .filter((ds) => {
            return ds !== ""; // && range !== INCORRECT_RANGE_STRING ? show incorrect #ref ?
        });
        return {
            title: data && data.title ? data.title : "",
            dataSets,
            labelRange: data.labelRange
                ? this.getters.getRangeString(data.labelRange, sheetId)
                : undefined,
            type: data ? data.type : "bar",
            dataSetsHaveTitle: data && dataSets.length !== 0 ? Boolean(data.dataSets[0].labelCell) : false,
            background: data.background,
            verticalAxisPosition: data.verticalAxisPosition,
            legendPosition: data.legendPosition,
            stackedBar: data.stackedBar,
        };
    }
    getChartDefinitionExcel(sheetId, figureId) {
        const data = this.chartFigures[figureId];
        const dataSets = data.dataSets
            .map((ds) => this.toExcelDataset(ds))
            .filter((ds) => ds.range !== ""); // && range !== INCORRECT_RANGE_STRING ? show incorrect #ref ?
        return {
            ...this.getChartDefinitionUI("forceSheetReference", figureId),
            backgroundColor: data.background,
            dataSets,
        };
    }
    toExcelDataset(ds) {
        var _a;
        const labelZone = (_a = ds.labelCell) === null || _a === void 0 ? void 0 : _a.zone;
        let dataZone = ds.dataRange.zone;
        if (labelZone) {
            const { height, width } = zoneToDimension(dataZone);
            if (height === 1) {
                dataZone = { ...dataZone, left: dataZone.left + 1 };
            }
            else if (width === 1) {
                dataZone = { ...dataZone, top: dataZone.top + 1 };
            }
        }
        const dataRange = {
            ...ds.dataRange,
            zone: dataZone,
        };
        return {
            label: ds.labelCell
                ? this.getters.getRangeString(ds.labelCell, "forceSheetReference")
                : undefined,
            range: this.getters.getRangeString(dataRange, "forceSheetReference"),
        };
    }
    // ---------------------------------------------------------------------------
    // Import/Export
    // ---------------------------------------------------------------------------
    import(data) {
        for (let sheet of data.sheets) {
            if (sheet.figures) {
                for (let figure of sheet.figures) {
                    if (figure.tag === "chart") {
                        const figureData = {
                            ...figure.data,
                        };
                        this.chartFigures[figure.id] = this.createChartDefinition(figureData, sheet.id);
                        delete figure.data;
                    }
                }
            }
        }
    }
    export(data) {
        if (data.sheets) {
            for (let sheet of data.sheets) {
                const sheetFigures = this.getters.getFigures(sheet.id);
                const figures = sheetFigures;
                for (let figure of figures) {
                    if (figure && figure.tag === "chart") {
                        figure.data = this.getChartDefinitionUI(sheet.id, figure.id);
                    }
                }
                sheet.figures = figures;
            }
        }
    }
    exportForExcel(data) {
        for (let sheet of data.sheets) {
            const sheetFigures = this.getters.getFigures(sheet.id);
            const figures = sheetFigures;
            for (let figure of figures) {
                if (figure && figure.tag === "chart") {
                    figure.data = this.getChartDefinitionExcel(sheet.id, figure.id);
                }
            }
            sheet.charts = figures;
        }
    }
    // ---------------------------------------------------------------------------
    // Private
    // ---------------------------------------------------------------------------
    /**
     * Create a new chart definition based on the given UI definition
     */
    createChartDefinition(definition, sheetId) {
        return {
            ...definition,
            dataSets: this.createDataSets(definition.dataSets, sheetId, definition.dataSetsHaveTitle),
            labelRange: definition.labelRange
                ? this.getters.getRangeFromSheetXC(sheetId, definition.labelRange)
                : undefined,
            sheetId,
        };
    }
    /**
     * Update the chart definition linked to the given id with the attributes
     * given in the partial UI definition
     */
    updateChartDefinition(id, definition) {
        const chart = this.chartFigures[id];
        if (!chart) {
            return;
        }
        if (definition.title !== undefined) {
            this.history.update("chartFigures", id, "title", definition.title);
        }
        if (definition.type) {
            this.history.update("chartFigures", id, "type", definition.type);
        }
        if (definition.dataSets) {
            const dataSetsHaveTitle = !!definition.dataSetsHaveTitle;
            const dataSets = this.createDataSets(definition.dataSets, chart.sheetId, dataSetsHaveTitle);
            this.history.update("chartFigures", id, "dataSets", dataSets);
        }
        if (definition.labelRange !== undefined) {
            const labelRange = definition.labelRange
                ? this.getters.getRangeFromSheetXC(chart.sheetId, definition.labelRange)
                : undefined;
            this.history.update("chartFigures", id, "labelRange", labelRange);
        }
        if (definition.background) {
            this.history.update("chartFigures", id, "background", definition.background);
        }
        if (definition.verticalAxisPosition) {
            this.history.update("chartFigures", id, "verticalAxisPosition", definition.verticalAxisPosition);
        }
        if (definition.legendPosition) {
            this.history.update("chartFigures", id, "legendPosition", definition.legendPosition);
        }
        if (definition.stackedBar !== undefined) {
            this.history.update("chartFigures", id, "stackedBar", definition.stackedBar);
        }
    }
    createDataSets(dataSetsString, sheetId, dataSetsHaveTitle) {
        const dataSets = [];
        for (const sheetXC of dataSetsString) {
            const dataRange = this.getters.getRangeFromSheetXC(sheetId, sheetXC);
            const { zone, sheetId: dataSetSheetId, invalidSheetName } = dataRange;
            if (invalidSheetName) {
                continue;
            }
            if (zone.left !== zone.right && zone.top !== zone.bottom) {
                // It's a rectangle. We treat all columns (arbitrary) as different data series.
                for (let column = zone.left; column <= zone.right; column++) {
                    const columnZone = {
                        left: column,
                        right: column,
                        top: zone.top,
                        bottom: zone.bottom,
                    };
                    dataSets.push(this.createDataSet(dataSetSheetId, columnZone, dataSetsHaveTitle
                        ? {
                            top: columnZone.top,
                            bottom: columnZone.top,
                            left: columnZone.left,
                            right: columnZone.left,
                        }
                        : undefined));
                }
            }
            else if (zone.left === zone.right && zone.top === zone.bottom) {
                // A single cell. If it's only the title, the dataset is not added.
                if (!dataSetsHaveTitle) {
                    dataSets.push(this.createDataSet(dataSetSheetId, zone, undefined));
                }
            }
            else {
                /* 1 row or 1 column */
                dataSets.push(this.createDataSet(dataSetSheetId, zone, dataSetsHaveTitle
                    ? {
                        top: zone.top,
                        bottom: zone.top,
                        left: zone.left,
                        right: zone.left,
                    }
                    : undefined));
            }
        }
        return dataSets;
    }
    addChartFigure(sheetId, data, figure) {
        this.dispatch("CREATE_FIGURE", {
            sheetId,
            figure,
        });
        this.history.update("chartFigures", figure.id, data);
    }
    createDataSet(sheetId, fullZone, titleZone) {
        if (fullZone.left !== fullZone.right && fullZone.top !== fullZone.bottom) {
            throw new Error(`Zone should be a single column or row: ${zoneToXc(fullZone)}`);
        }
        if (titleZone) {
            const dataXC = zoneToXc(fullZone);
            const labelCellXC = zoneToXc(titleZone);
            return {
                labelCell: this.getters.getRangeFromSheetXC(sheetId, labelCellXC),
                dataRange: this.getters.getRangeFromSheetXC(sheetId, dataXC),
            };
        }
        else {
            return {
                labelCell: undefined,
                dataRange: this.getters.getRangeFromSheetXC(sheetId, zoneToXc(fullZone)),
            };
        }
    }
    checkEmptyDataset(cmd) {
        return cmd.definition.dataSets && cmd.definition.dataSets.length === 0
            ? 25 /* EmptyDataSet */
            : 0 /* Success */;
    }
    checkDataset(cmd) {
        if (!cmd.definition.dataSets) {
            return 0 /* Success */;
        }
        const invalidRanges = cmd.definition.dataSets.find((range) => !rangeReference.test(range)) !== undefined;
        return invalidRanges ? 26 /* InvalidDataSet */ : 0 /* Success */;
    }
    checkLabelRange(cmd) {
        if (!cmd.definition.labelRange) {
            return 0 /* Success */;
        }
        const invalidLabels = !rangeReference.test(cmd.definition.labelRange || "");
        return invalidLabels ? 27 /* InvalidLabelRange */ : 0 /* Success */;
    }
}
ChartPlugin.getters = ["getChartDefinition", "getChartDefinitionUI", "getChartsIdBySheet"];
//# sourceMappingURL=chart.js.map