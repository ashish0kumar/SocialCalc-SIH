import { isDefined } from "../../helpers/index";
import { CorePlugin } from "../core_plugin";
export class FigurePlugin extends CorePlugin {
    constructor() {
        super(...arguments);
        this.figures = {};
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    allowDispatch(cmd) {
        switch (cmd.type) {
            case "UPDATE_FIGURE":
            case "DELETE_FIGURE":
                return this.checkFigureExists(cmd.sheetId, cmd.id);
            default:
                return 0 /* Success */;
        }
    }
    handle(cmd) {
        switch (cmd.type) {
            case "CREATE_SHEET":
                this.figures[cmd.sheetId] = {};
                break;
            case "DELETE_SHEET":
                this.deleteSheet(cmd.sheetId);
                break;
            case "CREATE_FIGURE":
                this.addFigure(cmd.figure, cmd.sheetId);
                break;
            case "UPDATE_FIGURE":
                const { type, sheetId, ...update } = cmd;
                const figure = update;
                this.updateFigure(sheetId, figure);
                break;
            case "DELETE_FIGURE":
                this.removeFigure(cmd.id, cmd.sheetId);
                break;
        }
    }
    updateFigure(sheetId, figure) {
        if (!("id" in figure)) {
            return;
        }
        for (const [key, value] of Object.entries(figure)) {
            switch (key) {
                case "x":
                case "y":
                    if (value !== undefined) {
                        this.history.update("figures", sheetId, figure.id, key, Math.max(value, 0));
                    }
                    break;
                case "width":
                case "height":
                    if (value !== undefined) {
                        this.history.update("figures", sheetId, figure.id, key, value);
                    }
                    break;
            }
        }
    }
    addFigure(figure, sheetId) {
        this.history.update("figures", sheetId, figure.id, figure);
    }
    deleteSheet(sheetId) {
        this.history.update("figures", sheetId, undefined);
    }
    removeFigure(id, sheetId) {
        this.history.update("figures", sheetId, id, undefined);
    }
    checkFigureExists(sheetId, figureId) {
        var _a;
        if (((_a = this.figures[sheetId]) === null || _a === void 0 ? void 0 : _a[figureId]) === undefined) {
            return 53 /* FigureDoesNotExist */;
        }
        return 0 /* Success */;
    }
    // ---------------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------------
    getFigures(sheetId) {
        return Object.values(this.figures[sheetId] || {}).filter(isDefined);
    }
    getFigure(sheetId, figureId) {
        var _a;
        return (_a = this.figures[sheetId]) === null || _a === void 0 ? void 0 : _a[figureId];
    }
    // ---------------------------------------------------------------------------
    // Import/Export
    // ---------------------------------------------------------------------------
    import(data) {
        for (let sheet of data.sheets) {
            const figures = {};
            sheet.figures.forEach((figure) => {
                figures[figure.id] = figure;
            });
            this.figures[sheet.id] = figures;
        }
    }
    export(data) {
        for (const sheet of data.sheets) {
            for (const figure of this.getFigures(sheet.id)) {
                const data = undefined;
                sheet.figures.push({ ...figure, data });
            }
        }
    }
    exportForExcel(data) {
        this.export(data);
    }
}
FigurePlugin.getters = ["getFigures", "getFigure"];
//# sourceMappingURL=figures.js.map