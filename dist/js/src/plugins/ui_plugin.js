import { BasePlugin } from "./base_plugin";
/**
 * UI plugins handle any transient data required to display a spreadsheet.
 * They can draw on the grid canvas.
 */
export class UIPlugin extends BasePlugin {
    constructor(getters, state, dispatch, config, selection) {
        super(state, dispatch, config);
        this.getters = getters;
        this.ui = config;
        this.selection = selection;
    }
    // ---------------------------------------------------------------------------
    // Grid rendering
    // ---------------------------------------------------------------------------
    drawGrid(ctx, layer) { }
}
UIPlugin.layers = [];
//# sourceMappingURL=ui_plugin.js.map