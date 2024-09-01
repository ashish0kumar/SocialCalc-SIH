import { getComposerSheetName, getNextColor, UuidGenerator, zoneToXc } from "../../helpers/index";
import { UIPlugin } from "../ui_plugin";
const uuidGenerator = new UuidGenerator();
/**
 * Selection input Plugin
 *
 * The SelectionInput component input and output are both arrays of strings, but
 * it requires an intermediary internal state to work.
 * This plugin handles this internal state.
 */
export class SelectionInputPlugin extends UIPlugin {
    constructor(getters, state, dispatch, config, selection, initialRanges, inputHasSingleRange) {
        super(getters, state, dispatch, config, selection);
        this.inputHasSingleRange = inputHasSingleRange;
        this.ranges = [];
        this.focusedRangeIndex = null;
        this.willAddNewRange = false;
        this.insertNewRange(0, initialRanges);
        this.activeSheet = this.getters.getActiveSheetId();
        if (this.ranges.length === 0) {
            this.insertNewRange(this.ranges.length, [""]);
            this.focusLast();
        }
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    allowDispatch(cmd) {
        switch (cmd.type) {
            case "ADD_EMPTY_RANGE":
                if (this.inputHasSingleRange && this.ranges.length === 1) {
                    return 23 /* MaximumRangesReached */;
                }
                break;
        }
        return 0 /* Success */;
    }
    handleEvent(event) {
        const xc = zoneToXc(event.anchor.zone);
        const inputSheetId = this.activeSheet;
        const sheetId = this.getters.getActiveSheetId();
        const sheetName = this.getters.getSheetName(sheetId);
        this.add([sheetId === inputSheetId ? xc : `${getComposerSheetName(sheetName)}!${xc}`]);
    }
    handle(cmd) {
        switch (cmd.type) {
            case "UNFOCUS_SELECTION_INPUT":
                this.unfocus();
                break;
            case "FOCUS_RANGE":
                this.focus(this.getIndex(cmd.rangeId));
                break;
            case "CHANGE_RANGE": {
                const index = this.getIndex(cmd.rangeId);
                if (index !== null && this.focusedRangeIndex !== index) {
                    this.focus(index);
                }
                if (index !== null) {
                    const values = cmd.value.split(",").map((reference) => reference.trim());
                    this.setRange(index, values);
                }
                break;
            }
            case "ADD_EMPTY_RANGE":
                this.insertNewRange(this.ranges.length, [""]);
                this.focusLast();
                break;
            case "REMOVE_RANGE":
                const index = this.getIndex(cmd.rangeId);
                if (index !== null) {
                    this.removeRange(index);
                }
                break;
            case "STOP_SELECTION_INPUT":
                this.willAddNewRange = false;
                break;
            case "PREPARE_SELECTION_INPUT_EXPANSION": {
                const index = this.focusedRangeIndex;
                if (index !== null && !this.inputHasSingleRange) {
                    this.willAddNewRange = this.ranges[index].xc.trim() !== "";
                }
                break;
            }
        }
    }
    unsubscribe() {
        this.unfocus();
    }
    // ---------------------------------------------------------------------------
    // Getters || only callable by the parent
    // ---------------------------------------------------------------------------
    getSelectionInputValue() {
        return this.cleanInputs(this.ranges.map((range) => {
            return range.xc ? range.xc : "";
        }));
    }
    getSelectionInputHighlights() {
        return this.ranges.map((input) => this.inputToHighlights(input)).flat();
    }
    // ---------------------------------------------------------------------------
    // Other
    // ---------------------------------------------------------------------------
    /**
     * Focus a given range or remove the focus.
     */
    focus(index) {
        this.focusedRangeIndex = index;
    }
    focusLast() {
        this.focus(this.ranges.length - 1);
    }
    unfocus() {
        this.focusedRangeIndex = null;
    }
    add(newRanges) {
        if (this.focusedRangeIndex === null || newRanges.length === 0) {
            return;
        }
        if (this.willAddNewRange) {
            this.insertNewRange(this.ranges.length, newRanges);
            this.focusLast();
            this.willAddNewRange = false;
        }
        else {
            this.setRange(this.focusedRangeIndex, newRanges);
        }
    }
    setContent(index, xc) {
        this.ranges[index] = {
            ...this.ranges[index],
            id: uuidGenerator.uuidv4(),
            xc,
        };
    }
    /**
     * Insert new inputs after the given index.
     */
    insertNewRange(index, values) {
        this.ranges.splice(index, 0, ...values.map((xc, i) => ({
            xc,
            id: (this.ranges.length + i + 1).toString(),
            color: getNextColor(),
        })));
    }
    /**
     * Set a new value in a given range input. If more than one value is provided,
     * new inputs will be added.
     */
    setRange(index, values) {
        const [, ...additionalValues] = values;
        this.setContent(index, values[0]);
        this.insertNewRange(index + 1, additionalValues);
        // focus the last newly added range
        if (additionalValues.length) {
            this.focus(index + additionalValues.length);
        }
    }
    removeRange(index) {
        this.ranges.splice(index, 1);
        if (this.focusedRangeIndex !== null) {
            this.focusLast();
        }
    }
    /**
     * Convert highlights input format to the command format.
     * The first xc in the input range will keep its color.
     * Invalid ranges and ranges from other sheets than the active sheets
     * are ignored.
     */
    inputToHighlights({ xc, color, }) {
        const ranges = this.cleanInputs([xc])
            .filter((range) => this.getters.isRangeValid(range))
            .filter((reference) => this.shouldBeHighlighted(this.activeSheet, reference));
        if (ranges.length === 0)
            return [];
        const [fromInput, ...otherRanges] = ranges;
        const highlights = [[fromInput, color || getNextColor()]];
        for (const range of otherRanges) {
            highlights.push([range, getNextColor()]);
        }
        return highlights;
    }
    cleanInputs(ranges) {
        return ranges
            .map((xc) => xc.split(","))
            .flat()
            .map((xc) => xc.trim())
            .filter((xc) => xc !== "");
    }
    /**
     * Check if a cell or range reference should be highlighted.
     * It should be highlighted if it references the current active sheet.
     * Note that if no sheet name is given in the reference ("A1"), it refers to the
     * active sheet when the selection input was enabled which might be different from
     * the current active sheet.
     */
    shouldBeHighlighted(inputSheetId, reference) {
        const sheetName = reference.split("!").reverse()[1];
        const sheetId = this.getters.getSheetIdByName(sheetName);
        const activeSheetId = this.getters.getActiveSheet().id;
        const valid = this.getters.isRangeValid(reference);
        return (valid &&
            (sheetId === activeSheetId || (sheetId === undefined && activeSheetId === inputSheetId)));
    }
    /**
     * Return the index of a range given its id
     * or `null` if the range is not found.
     */
    getIndex(rangeId) {
        const index = this.ranges.findIndex((range) => range.id === rangeId);
        return index >= 0 ? index : null;
    }
}
SelectionInputPlugin.modes = ["normal"];
SelectionInputPlugin.layers = [1 /* Highlights */];
SelectionInputPlugin.getters = [];
//# sourceMappingURL=selection_input.js.map