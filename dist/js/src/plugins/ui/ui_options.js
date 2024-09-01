import { UIPlugin } from "../ui_plugin";
export class UIOptionsPlugin extends UIPlugin {
    constructor() {
        super(...arguments);
        this.showFormulas = false;
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    handle(cmd) {
        switch (cmd.type) {
            case "SET_FORMULA_VISIBILITY":
                this.showFormulas = cmd.show;
                break;
        }
    }
    // ---------------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------------
    shouldShowFormulas() {
        return this.showFormulas;
    }
}
UIOptionsPlugin.modes = ["normal"];
UIOptionsPlugin.getters = ["shouldShowFormulas"];
//# sourceMappingURL=ui_options.js.map