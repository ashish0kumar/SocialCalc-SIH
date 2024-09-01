import { positionToZone, rangeReference } from "../../helpers/index";
import { UIPlugin } from "../ui_plugin";
import { SelectionInputPlugin } from "./selection_input";
/**
 * Selection input Plugin
 *
 * The SelectionInput component input and output are both arrays of strings, but
 * it requires an intermediary internal state to work.
 * This plugin handles this internal state.
 */
export class SelectionInputsManagerPlugin extends UIPlugin {
    constructor(getters, state, dispatch, config, selection) {
        super(getters, state, dispatch, config, selection);
        this.state = state;
        this.config = config;
        this.inputs = {};
        this.focusedInputId = null;
    }
    get currentInput() {
        return this.focusedInputId ? this.inputs[this.focusedInputId] : null;
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    allowDispatch(cmd) {
        var _a, _b;
        switch (cmd.type) {
            case "FOCUS_RANGE":
                const index = (_a = this.currentInput) === null || _a === void 0 ? void 0 : _a.getIndex(cmd.rangeId);
                if (this.focusedInputId === cmd.id && ((_b = this.currentInput) === null || _b === void 0 ? void 0 : _b.focusedRangeIndex) === index) {
                    return 22 /* InputAlreadyFocused */;
                }
                break;
        }
        if (this.currentInput) {
            return this.currentInput.allowDispatch(cmd);
        }
        return 0 /* Success */;
    }
    handle(cmd) {
        var _a;
        switch (cmd.type) {
            case "ENABLE_NEW_SELECTION_INPUT":
                this.initInput(cmd.id, cmd.initialRanges || [], cmd.hasSingleRange);
                break;
            case "DISABLE_SELECTION_INPUT":
                if (this.focusedInputId === cmd.id) {
                    this.unfocus();
                }
                delete this.inputs[cmd.id];
                break;
            case "UNFOCUS_SELECTION_INPUT":
                this.unfocus();
                break;
            case "ADD_EMPTY_RANGE":
            case "REMOVE_RANGE":
            case "FOCUS_RANGE":
            case "CHANGE_RANGE":
                if (cmd.id !== this.focusedInputId) {
                    const input = this.inputs[cmd.id];
                    this.selection.capture(input, { cell: { col: 0, row: 0 }, zone: positionToZone({ col: 0, row: 0 }) }, { handleEvent: input.handleEvent.bind(input) });
                    this.focusedInputId = cmd.id;
                }
                break;
        }
        (_a = this.currentInput) === null || _a === void 0 ? void 0 : _a.handle(cmd);
    }
    unsubscribe() {
        this.unfocus();
    }
    // ---------------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------------
    /**
     * Return a list of all valid XCs.
     * e.g. ["A1", "Sheet2!B3", "E12"]
     */
    getSelectionInput(id) {
        if (!this.inputs[id]) {
            return [];
        }
        return this.inputs[id].ranges.map((input, index) => Object.assign({}, input, {
            color: this.focusedInputId === id &&
                this.inputs[id].focusedRangeIndex !== null &&
                this.isRangeValid(input.xc)
                ? input.color
                : null,
            isFocused: this.focusedInputId === id && this.inputs[id].focusedRangeIndex === index,
        }));
    }
    isRangeValid(xc) {
        if (!xc) {
            return false;
        }
        const [rangeXc, sheetName] = xc.split("!").reverse();
        return (rangeXc.match(rangeReference) !== null &&
            (sheetName === undefined || this.getters.getSheetIdByName(sheetName) !== undefined));
    }
    getSelectionInputValue(id) {
        return this.inputs[id].getSelectionInputValue();
    }
    getSelectionInputHighlights() {
        if (!this.focusedInputId) {
            return [];
        }
        return this.inputs[this.focusedInputId].getSelectionInputHighlights();
    }
    // ---------------------------------------------------------------------------
    // Other
    // ---------------------------------------------------------------------------
    initInput(id, initialRanges, inputHasSingleRange = false) {
        this.inputs[id] = new SelectionInputPlugin(this.getters, this.state, this.dispatch, this.config, this.selection, initialRanges, inputHasSingleRange);
        if (initialRanges.length === 0) {
            const input = this.inputs[id];
            const anchor = {
                zone: positionToZone({ col: 0, row: 0 }),
                cell: { col: 0, row: 0 },
            };
            this.selection.capture(input, anchor, { handleEvent: input.handleEvent.bind(input) });
            this.focusedInputId = id;
        }
    }
    unfocus() {
        this.selection.release(this.currentInput);
        this.focusedInputId = null;
    }
}
SelectionInputsManagerPlugin.modes = ["normal"];
SelectionInputsManagerPlugin.layers = [1 /* Highlights */];
SelectionInputsManagerPlugin.getters = [
    "getSelectionInput",
    "getSelectionInputValue",
    "isRangeValid",
    "getSelectionInputHighlights",
];
//# sourceMappingURL=selection_inputs_manager.js.map