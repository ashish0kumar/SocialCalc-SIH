import { Component, onMounted, onPatched, onWillUnmount, useRef, useState, xml } from "@odoo/owl";
import { SELECTION_BORDER_COLOR } from "../../constants";
import { functionRegistry } from "../../functions/index";
import { isEqual, rangeReference, toZone } from "../../helpers/index";
import { SelectionIndicator } from "../../plugins/ui/edition";
import { css } from "../helpers/css";
import { TextValueProvider } from "./autocomplete_dropdown";
import { ContentEditableHelper } from "./content_editable_helper";
import { FunctionDescriptionProvider } from "./formula_assistant";
const functions = functionRegistry.content;
const ASSISTANT_WIDTH = 300;
export const FunctionColor = "#4a4e4d";
export const OperatorColor = "#3da4ab";
export const StringColor = "#f6cd61";
export const SelectionIndicatorColor = "darkgrey";
export const NumberColor = "#02c39a";
export const MatchingParenColor = "pink";
export const SelectionIndicatorClass = "selector-flag";
export const tokenColor = {
    OPERATOR: OperatorColor,
    NUMBER: NumberColor,
    STRING: StringColor,
    FUNCTION: FunctionColor,
    DEBUGGER: OperatorColor,
    LEFT_PAREN: FunctionColor,
    RIGHT_PAREN: FunctionColor,
    COMMA: FunctionColor,
};
const TEMPLATE = xml /* xml */ `
<div class="o-composer-container">
  <div
    t-att-class="{ 'o-composer': true, 'text-muted': env.model.getters.isReadonly(), 'unfocusable': env.model.getters.isReadonly() }"
    t-att-style="props.inputStyle"
    t-ref="o_composer"
    tabindex="1"
    t-att-contenteditable="env.model.getters.isReadonly() ? 'false' : 'true'"
    spellcheck="false"

    t-on-keydown="onKeydown"
    t-on-mousedown="onMousedown"
    t-on-input="onInput"
    t-on-keyup="onKeyup"
    t-on-click.stop="onClick"
    t-on-blur="onBlur"
  />

  <div t-if="props.focus !== 'inactive' and (autoCompleteState.showProvider or functionDescriptionState.showDescription)"
    class="o-composer-assistant" t-att-style="assistantStyle">
    <TextValueProvider
        t-if="autoCompleteState.showProvider"
        exposeAPI="(api) => this.autocompleteAPI = api"
        search="autoCompleteState.search"
        provider="autoCompleteState.provider"
        onCompleted="(text) => this.onCompleted(text)"
        borderStyle="borderStyle"
    />
    <FunctionDescriptionProvider
        t-if="functionDescriptionState.showDescription"
        functionName = "functionDescriptionState.functionName"
        functionDescription = "functionDescriptionState.functionDescription"
        argToFocus = "functionDescriptionState.argToFocus"
        borderStyle="borderStyle"
    />
  </div>
</div>
  `;
css /* scss */ `
  .o-composer-container {
    padding: 0;
    margin: 0;
    border: 0;
    z-index: 5;
    flex-grow: 1;
    max-height: inherit;
    .o-composer {
      caret-color: black;
      padding-left: 3px;
      padding-right: 3px;
      word-break: break-all;
      &:focus {
        outline: none;
      }
      &.unfocusable {
        pointer-events: none;
      }
      span {
        white-space: pre;
        &.${SelectionIndicatorClass}:after {
          content: "${SelectionIndicator}";
          color: ${SelectionIndicatorColor};
        }
      }
    }
    .o-composer-assistant {
      position: absolute;
      margin: 4px;
      pointer-events: none;
    }
  }

  /* Custom css to highlight topbar composer on focus */
  .o-topbar-toolbar .o-composer-container:focus-within {
    border: 1px solid ${SELECTION_BORDER_COLOR};
  }
`;
export class Composer extends Component {
    constructor() {
        super(...arguments);
        this.composerRef = useRef("o_composer");
        this.contentHelper = new ContentEditableHelper(this.composerRef.el);
        this.composerState = useState({
            positionStart: 0,
            positionEnd: 0,
        });
        this.autoCompleteState = useState({
            showProvider: false,
            provider: "functions",
            search: "",
        });
        this.functionDescriptionState = useState({
            showDescription: false,
            functionName: "",
            functionDescription: {},
            argToFocus: 0,
        });
        this.isKeyStillDown = false;
        this.borderStyle = `box-shadow: 0 1px 4px 3px rgba(60, 64, 67, 0.15);`;
        // we can't allow input events to be triggered while we remove and add back the content of the composer in processContent
        this.shouldProcessInputEvents = false;
        this.tokens = [];
        this.keyMapping = {
            ArrowUp: this.processArrowKeys,
            ArrowDown: this.processArrowKeys,
            ArrowLeft: this.processArrowKeys,
            ArrowRight: this.processArrowKeys,
            Enter: this.processEnterKey,
            Escape: this.processEscapeKey,
            F2: () => console.warn("Not implemented"),
            F4: this.processF4Key,
            Tab: (ev) => this.processTabKey(ev),
        };
    }
    get assistantStyle() {
        if (this.props.delimitation && this.props.rect) {
            const [cellX, cellY, , cellHeight] = this.props.rect;
            const remainingHeight = this.props.delimitation.height - (cellY + cellHeight);
            let assistantStyle = "";
            if (cellY > remainingHeight) {
                // render top
                assistantStyle += `
          top: -8px;
          transform: translate(0, -100%);
        `;
            }
            if (cellX + ASSISTANT_WIDTH > this.props.delimitation.width) {
                // render left
                assistantStyle += `right:0px;`;
            }
            return (assistantStyle += `width:${ASSISTANT_WIDTH}px;`);
        }
        return `width:${ASSISTANT_WIDTH}px;`;
    }
    setup() {
        onMounted(() => {
            const el = this.composerRef.el;
            this.contentHelper.updateEl(el);
            this.processContent();
        });
        onWillUnmount(() => {
            var _a, _b;
            (_b = (_a = this.props).onComposerUnmounted) === null || _b === void 0 ? void 0 : _b.call(_a);
        });
        onPatched(() => {
            if (!this.isKeyStillDown) {
                this.processContent();
            }
        });
    }
    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------
    processArrowKeys(ev) {
        if (this.env.model.getters.isSelectingForComposer()) {
            this.functionDescriptionState.showDescription = false;
            // Prevent the default content editable behavior which moves the cursor
            // but don't stop the event and let it bubble to the grid which will
            // update the selection accordingly
            ev.preventDefault();
            return;
        }
        // only for arrow up and down
        if (this.props.focus === "cellFocus" && !this.autoCompleteState.showProvider) {
            this.env.model.dispatch("STOP_EDITION");
            return;
        }
        ev.stopPropagation();
        if (["ArrowUp", "ArrowDown"].includes(ev.key) &&
            this.autoCompleteState.showProvider &&
            this.autocompleteAPI) {
            ev.preventDefault();
            if (ev.key === "ArrowUp") {
                this.autocompleteAPI.moveUp();
            }
            else {
                this.autocompleteAPI.moveDown();
            }
        }
    }
    processTabKey(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (this.autoCompleteState.showProvider && this.autocompleteAPI) {
            const autoCompleteValue = this.autocompleteAPI.getValueToFill();
            if (autoCompleteValue) {
                this.autoComplete(autoCompleteValue);
                return;
            }
        }
        else {
            // when completing with tab, if there is no value to complete, the active cell will be moved to the right.
            // we can't let the model think that it is for a ref selection.
            // todo: check if this can be removed someday
            this.env.model.dispatch("STOP_COMPOSER_RANGE_SELECTION");
        }
        const deltaCol = ev.shiftKey ? -1 : 1;
        this.env.model.dispatch("STOP_EDITION");
        this.env.model.selection.moveAnchorCell(deltaCol, 0);
    }
    processEnterKey(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.isKeyStillDown = false;
        if (this.autoCompleteState.showProvider && this.autocompleteAPI) {
            const autoCompleteValue = this.autocompleteAPI.getValueToFill();
            if (autoCompleteValue) {
                this.autoComplete(autoCompleteValue);
                return;
            }
        }
        this.env.model.dispatch("STOP_EDITION");
        this.env.model.selection.moveAnchorCell(0, ev.shiftKey ? -1 : 1);
    }
    processEscapeKey() {
        this.env.model.dispatch("STOP_EDITION", { cancel: true });
    }
    processF4Key() {
        this.env.model.dispatch("CYCLE_EDITION_REFERENCES");
        this.processContent();
    }
    onKeydown(ev) {
        let handler = this.keyMapping[ev.key];
        if (handler) {
            handler.call(this, ev);
        }
        else {
            ev.stopPropagation();
        }
        const { start, end } = this.contentHelper.getCurrentSelection();
        if (!this.env.model.getters.isSelectingForComposer()) {
            this.env.model.dispatch("CHANGE_COMPOSER_CURSOR_SELECTION", { start, end });
            this.isKeyStillDown = true;
        }
    }
    /*
     * Triggered automatically by the content-editable between the keydown and key up
     * */
    onInput() {
        if (this.props.focus === "inactive" || !this.shouldProcessInputEvents) {
            return;
        }
        this.env.model.dispatch("STOP_COMPOSER_RANGE_SELECTION");
        const el = this.composerRef.el;
        this.env.model.dispatch("SET_CURRENT_CONTENT", {
            content: el.childNodes.length ? el.textContent : "",
            selection: this.contentHelper.getCurrentSelection(),
        });
    }
    onKeyup(ev) {
        this.isKeyStillDown = false;
        if (this.props.focus === "inactive" ||
            ["Control", "Shift", "Tab", "Enter", "F4"].includes(ev.key)) {
            return;
        }
        if (this.autoCompleteState.showProvider && ["ArrowUp", "ArrowDown"].includes(ev.key)) {
            return; // already processed in keydown
        }
        if (this.env.model.getters.isSelectingForComposer() &&
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.key)) {
            return; // already processed in keydown
        }
        ev.preventDefault();
        ev.stopPropagation();
        this.autoCompleteState.showProvider = false;
        if (ev.ctrlKey && ev.key === " ") {
            this.autoCompleteState.search = "";
            this.autoCompleteState.showProvider = true;
            this.env.model.dispatch("STOP_COMPOSER_RANGE_SELECTION");
            return;
        }
        const { start: oldStart, end: oldEnd } = this.env.model.getters.getComposerSelection();
        const { start, end } = this.contentHelper.getCurrentSelection();
        if (start !== oldStart || end !== oldEnd) {
            this.env.model.dispatch("CHANGE_COMPOSER_CURSOR_SELECTION", this.contentHelper.getCurrentSelection());
        }
        this.processTokenAtCursor();
        this.processContent();
    }
    onMousedown(ev) {
        if (ev.button > 0) {
            // not main button, probably a context menu
            return;
        }
        this.contentHelper.removeSelection();
    }
    onClick() {
        if (this.env.model.getters.isReadonly()) {
            return;
        }
        const newSelection = this.contentHelper.getCurrentSelection();
        this.env.model.dispatch("STOP_COMPOSER_RANGE_SELECTION");
        if (this.props.focus === "inactive") {
            this.props.onComposerContentFocused(newSelection);
        }
        this.env.model.dispatch("CHANGE_COMPOSER_CURSOR_SELECTION", newSelection);
        this.processTokenAtCursor();
    }
    onBlur() {
        this.isKeyStillDown = false;
    }
    onCompleted(text) {
        text && this.autoComplete(text);
    }
    // ---------------------------------------------------------------------------
    // Private
    // ---------------------------------------------------------------------------
    processContent() {
        this.contentHelper.removeAll(); // removes the content of the composer, to be added just after
        this.shouldProcessInputEvents = false;
        if (this.props.focus !== "inactive") {
            this.contentHelper.selectRange(0, 0); // move the cursor inside the composer at 0 0.
        }
        const content = this.getContent();
        if (content.length !== 0) {
            this.contentHelper.setText(content);
            const { start, end } = this.env.model.getters.getComposerSelection();
            if (this.props.focus !== "inactive") {
                // Put the cursor back where it was before the rendering
                this.contentHelper.selectRange(start, end);
            }
        }
        this.shouldProcessInputEvents = true;
    }
    getContent() {
        let content;
        let value = this.env.model.getters.getCurrentContent();
        if (value === "") {
            content = [];
        }
        else if (value.startsWith("=") && this.props.focus !== "inactive") {
            content = this.getColoredTokens();
        }
        else {
            content = [{ value }];
        }
        return content;
    }
    getColoredTokens() {
        const tokens = this.env.model.getters.getCurrentTokens();
        const tokenAtCursor = this.env.model.getters.getTokenAtCursor();
        const result = [];
        const { end, start } = this.env.model.getters.getComposerSelection();
        for (let token of tokens) {
            switch (token.type) {
                case "OPERATOR":
                case "NUMBER":
                case "FUNCTION":
                case "COMMA":
                case "STRING":
                    result.push({ value: token.value, color: tokenColor[token.type] || "#000" });
                    break;
                case "REFERENCE":
                    const [xc, sheet] = token.value.split("!").reverse();
                    result.push({ value: token.value, color: this.rangeColor(xc, sheet) || "#000" });
                    break;
                case "SYMBOL":
                    let value = token.value;
                    if (["TRUE", "FALSE"].includes(value.toUpperCase())) {
                        result.push({ value: token.value, color: NumberColor });
                    }
                    else {
                        result.push({ value: token.value, color: "#000" });
                    }
                    break;
                case "LEFT_PAREN":
                case "RIGHT_PAREN":
                    // Compute the matching parenthesis
                    if (tokenAtCursor &&
                        ["LEFT_PAREN", "RIGHT_PAREN"].includes(tokenAtCursor.type) &&
                        tokenAtCursor.parenIndex &&
                        tokenAtCursor.parenIndex === token.parenIndex) {
                        result.push({ value: token.value, color: MatchingParenColor || "#000" });
                    }
                    else {
                        result.push({ value: token.value, color: tokenColor[token.type] || "#000" });
                    }
                    break;
                default:
                    result.push({ value: token.value, color: "#000" });
                    break;
            }
            if (this.env.model.getters.showSelectionIndicator() && end === start && end === token.end) {
                result[result.length - 1].class = SelectionIndicatorClass;
            }
        }
        return result;
    }
    rangeColor(xc, sheetName) {
        if (this.props.focus === "inactive") {
            return undefined;
        }
        const highlights = this.env.model.getters.getHighlights();
        const refSheet = sheetName
            ? this.env.model.getters.getSheetIdByName(sheetName)
            : this.env.model.getters.getEditionSheet();
        const highlight = highlights.find((highlight) => highlight.sheet === refSheet &&
            isEqual(this.env.model.getters.expandZone(refSheet, toZone(xc)), highlight.zone));
        return highlight && highlight.color ? highlight.color : undefined;
    }
    /**
     * Compute the state of the composer from the tokenAtCursor.
     * If the token is a function or symbol (that isn't a cell/range reference) we have to initialize
     * the autocomplete engine otherwise we initialize the formula assistant.
     */
    processTokenAtCursor() {
        let content = this.env.model.getters.getCurrentContent();
        this.autoCompleteState.showProvider = false;
        this.functionDescriptionState.showDescription = false;
        if (content.startsWith("=")) {
            const tokenAtCursor = this.env.model.getters.getTokenAtCursor();
            if (tokenAtCursor) {
                const [xc] = tokenAtCursor.value.split("!").reverse();
                if (tokenAtCursor.type === "FUNCTION" ||
                    (tokenAtCursor.type === "SYMBOL" && !rangeReference.test(xc))) {
                    // initialize Autocomplete Dropdown
                    this.autoCompleteState.search = tokenAtCursor.value;
                    this.autoCompleteState.showProvider = true;
                }
                else if (tokenAtCursor.functionContext && tokenAtCursor.type !== "UNKNOWN") {
                    // initialize Formula Assistant
                    const tokenContext = tokenAtCursor.functionContext;
                    const parentFunction = tokenContext.parent.toUpperCase();
                    const description = functions[parentFunction];
                    const argPosition = tokenContext.argPosition;
                    this.functionDescriptionState.functionName = parentFunction;
                    this.functionDescriptionState.functionDescription = description;
                    this.functionDescriptionState.argToFocus = description.getArgToFocus(argPosition + 1) - 1;
                    this.functionDescriptionState.showDescription = true;
                }
            }
        }
    }
    autoComplete(value) {
        if (value) {
            const tokenAtCursor = this.env.model.getters.getTokenAtCursor();
            if (tokenAtCursor) {
                let start = tokenAtCursor.end;
                let end = tokenAtCursor.end;
                // shouldn't it be REFERENCE ?
                if (["SYMBOL", "FUNCTION"].includes(tokenAtCursor.type)) {
                    start = tokenAtCursor.start;
                }
                const tokens = this.env.model.getters.getCurrentTokens();
                if (this.autoCompleteState.provider && tokens.length) {
                    value += "(";
                    const currentTokenIndex = tokens.map((token) => token.start).indexOf(tokenAtCursor.start);
                    if (currentTokenIndex + 1 < tokens.length) {
                        const nextToken = tokens[currentTokenIndex + 1];
                        if (nextToken.type === "LEFT_PAREN") {
                            end++;
                        }
                    }
                }
                this.env.model.dispatch("CHANGE_COMPOSER_CURSOR_SELECTION", {
                    start,
                    end,
                });
            }
            this.env.model.dispatch("REPLACE_COMPOSER_CURSOR_SELECTION", {
                text: value,
            });
        }
        this.processTokenAtCursor();
    }
}
Composer.template = TEMPLATE;
Composer.components = { TextValueProvider, FunctionDescriptionProvider };
Composer.defaultProps = {
    inputStyle: "",
    focus: "inactive",
};
//# sourceMappingURL=composer.js.map