import { UIPlugin } from "../ui_plugin";
const BORDER_COLOR = "#8B008B";
const BACKGROUND_COLOR = "#8B008B33";
export var Direction;
(function (Direction) {
    Direction[Direction["previous"] = -1] = "previous";
    Direction[Direction["current"] = 0] = "current";
    Direction[Direction["next"] = 1] = "next";
})(Direction || (Direction = {}));
/**
 * Find and Replace Plugin
 *
 * This plugin is used in combination with the find_and_replace sidePanel
 * It is used to 'highlight' cells that match an input string according to
 * the given searchOptions. The second part of this plugin makes it possible
 * (again with the find_and_replace sidePanel), to replace the values that match
 * the search with a new value.
 */
export class FindAndReplacePlugin extends UIPlugin {
    constructor() {
        super(...arguments);
        this.searchMatches = [];
        this.selectedMatchIndex = null;
        this.currentSearchRegex = null;
        this.searchOptions = {
            matchCase: false,
            exactMatch: false,
            searchFormulas: false,
        };
        this.replaceOptions = {
            modifyFormulas: false,
        };
        this.toSearch = "";
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    handle(cmd) {
        switch (cmd.type) {
            case "UPDATE_SEARCH":
                this.updateSearch(cmd.toSearch, cmd.searchOptions);
                break;
            case "CLEAR_SEARCH":
                this.clearSearch();
                break;
            case "SELECT_SEARCH_PREVIOUS_MATCH":
                this.selectNextCell(Direction.previous);
                break;
            case "SELECT_SEARCH_NEXT_MATCH":
                this.selectNextCell(Direction.next);
                break;
            case "REPLACE_SEARCH":
                this.replace(cmd.replaceWith, cmd.replaceOptions);
                break;
            case "REPLACE_ALL_SEARCH":
                this.replaceAll(cmd.replaceWith, cmd.replaceOptions);
                break;
            case "UNDO":
            case "REDO":
            case "REMOVE_COLUMNS_ROWS":
            case "ADD_COLUMNS_ROWS":
                this.clearSearch();
                break;
            case "ACTIVATE_SHEET":
            case "REFRESH_SEARCH":
                this.refreshSearch();
                break;
        }
    }
    // ---------------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------------
    getSearchMatches() {
        return this.searchMatches;
    }
    getCurrentSelectedMatchIndex() {
        return this.selectedMatchIndex;
    }
    // ---------------------------------------------------------------------------
    // Search
    // ---------------------------------------------------------------------------
    /**
     * Will update the current searchOptions and accordingly update the regex.
     * It will then search for matches using the regex and store them.
     */
    updateSearch(toSearch, searchOptions) {
        this.searchOptions = searchOptions;
        if (toSearch !== this.toSearch) {
            this.selectedMatchIndex = 0;
        }
        this.toSearch = toSearch;
        this.updateRegex();
        this.refreshSearch();
    }
    /**
     * refresh the matches according to the current search options
     */
    refreshSearch() {
        const matches = this.findMatches();
        this.searchMatches = matches;
        this.selectNextCell(Direction.current);
    }
    /**
     * Updates the regex based on the current searchOptions and
     * the value toSearch
     */
    updateRegex() {
        let searchValue = this.toSearch;
        const flags = !this.searchOptions.matchCase ? "i" : "";
        if (this.searchOptions.exactMatch) {
            searchValue = `^${searchValue}$`;
        }
        this.currentSearchRegex = RegExp(searchValue, flags);
    }
    /**
     * Find matches using the current regex
     */
    findMatches() {
        const activeSheetId = this.getters.getActiveSheetId();
        const cells = this.getters.getCells(activeSheetId);
        const matches = [];
        if (this.toSearch) {
            for (const cell of Object.values(cells)) {
                if (cell &&
                    this.currentSearchRegex &&
                    this.currentSearchRegex.test(this.searchOptions.searchFormulas
                        ? cell.isFormula()
                            ? cell.content
                            : String(cell.evaluated.value)
                        : String(cell.evaluated.value))) {
                    const position = this.getters.getCellPosition(cell.id);
                    const match = { col: position.col, row: position.row, selected: false };
                    matches.push(match);
                }
            }
        }
        return matches.sort(this.sortByRowThenColumn);
    }
    sortByRowThenColumn(a, b) {
        if (a.row === b.row) {
            return a.col - b.col;
        }
        return a.row > b.row ? 1 : -1;
    }
    /**
     * Changes the selected search cell. Given a direction it will
     * Change the selection to the previous, current or nextCell,
     * if it exists otherwise it will set the selectedMatchIndex to null.
     * It will also reset the index to 0 if the search has changed.
     * It is also used to keep coherence between the selected searchMatch
     * and selectedMatchIndex.
     */
    selectNextCell(indexChange) {
        const matches = this.searchMatches;
        if (!matches.length) {
            this.selectedMatchIndex = null;
            return;
        }
        let nextIndex;
        if (this.selectedMatchIndex === null) {
            nextIndex = 0;
        }
        else {
            nextIndex = this.selectedMatchIndex + indexChange;
        }
        //modulo of negative value to be able to cycle in both directions with previous and next
        nextIndex = ((nextIndex % matches.length) + matches.length) % matches.length;
        if (this.selectedMatchIndex !== nextIndex) {
            this.selectedMatchIndex = nextIndex;
            this.selection.selectCell(matches[nextIndex].col, matches[nextIndex].row);
        }
        for (let index = 0; index < this.searchMatches.length; index++) {
            this.searchMatches[index].selected = index === this.selectedMatchIndex;
        }
    }
    clearSearch() {
        this.toSearch = "";
        this.searchMatches = [];
        this.selectedMatchIndex = null;
        this.currentSearchRegex = null;
        this.searchOptions = {
            matchCase: false,
            exactMatch: false,
            searchFormulas: false,
        };
        this.replaceOptions = {
            modifyFormulas: false,
        };
    }
    // ---------------------------------------------------------------------------
    // Replace
    // ---------------------------------------------------------------------------
    /**
     * Replace the value of the currently selected match if the replaceOptions
     * allow it
     */
    replace(replaceWith, replaceOptions) {
        this.replaceOptions = replaceOptions;
        if (this.selectedMatchIndex === null || !this.currentSearchRegex) {
            return;
        }
        const matches = this.searchMatches;
        const selectedMatch = matches[this.selectedMatchIndex];
        const sheetId = this.getters.getActiveSheetId();
        const cellToReplace = this.getters.getCell(sheetId, selectedMatch.col, selectedMatch.row);
        const toReplace = this.toReplace(cellToReplace, sheetId);
        if (!cellToReplace || !toReplace) {
            this.selectNextCell(Direction.next);
        }
        else {
            const replaceRegex = new RegExp(this.currentSearchRegex.source, this.currentSearchRegex.flags + "g");
            const newContent = toReplace.toString().replace(replaceRegex, replaceWith);
            this.dispatch("UPDATE_CELL", {
                sheetId: this.getters.getActiveSheetId(),
                col: selectedMatch.col,
                row: selectedMatch.row,
                content: newContent,
            });
            this.searchMatches.splice(this.selectedMatchIndex, 1);
            this.selectNextCell(Direction.current);
        }
    }
    /**
     * Apply the replace function to all the matches one time.
     */
    replaceAll(replaceWith, replaceOptions) {
        const matchCount = this.searchMatches.length;
        for (let i = 0; i < matchCount; i++) {
            this.replace(replaceWith, replaceOptions);
        }
    }
    /**
     * Determines if the content, the value or nothing should be replaced,
     * based on the search and replace options
     */
    toReplace(cell, sheetId) {
        if (cell) {
            if (this.searchOptions.searchFormulas && cell.isFormula()) {
                return cell.content;
            }
            else if (this.replaceOptions.modifyFormulas || !cell.isFormula()) {
                return cell.evaluated.value.toString();
            }
        }
        return null;
    }
    // ---------------------------------------------------------------------------
    // Grid rendering
    // ---------------------------------------------------------------------------
    drawGrid(renderingContext) {
        const { ctx, viewport } = renderingContext;
        const sheetId = this.getters.getActiveSheetId();
        for (const match of this.searchMatches) {
            const merge = this.getters.getMerge(sheetId, match.col, match.row);
            const left = merge ? merge.left : match.col;
            const right = merge ? merge.right : match.col;
            const top = merge ? merge.top : match.row;
            const bottom = merge ? merge.bottom : match.row;
            const [x, y, width, height] = this.getters.getRect({ top, left, right, bottom }, viewport);
            if (width > 0 && height > 0) {
                ctx.fillStyle = BACKGROUND_COLOR;
                ctx.fillRect(x, y, width, height);
                if (match.selected) {
                    ctx.strokeStyle = BORDER_COLOR;
                    ctx.strokeRect(x, y, width, height);
                }
            }
        }
    }
}
FindAndReplacePlugin.layers = [3 /* Search */];
FindAndReplacePlugin.getters = ["getSearchMatches", "getCurrentSelectedMatchIndex"];
//# sourceMappingURL=find_and_replace.js.map