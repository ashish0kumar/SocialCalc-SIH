import { Component, useRef, useState, xml } from "@odoo/owl";
import { HEADER_HEIGHT, HEADER_WIDTH, ICON_EDGE_LENGTH, MIN_COL_WIDTH, MIN_ROW_HEIGHT, SELECTION_BORDER_COLOR, UNHIDE_ICON_EDGE_LENGTH, } from "../constants";
import { _lt } from "../translation";
import { css } from "./helpers/css";
import { startDnd } from "./helpers/drag_and_drop";
import * as icons from "./icons";
class AbstractResizer extends Component {
    constructor() {
        super(...arguments);
        this.PADDING = 0;
        this.MAX_SIZE_MARGIN = 0;
        this.MIN_ELEMENT_SIZE = 0;
        this.lastSelectedElementIndex = null;
        this.state = useState({
            resizerIsActive: false,
            isResizing: false,
            isMoving: false,
            isSelecting: false,
            waitingForMove: false,
            activeElement: 0,
            draggerLinePosition: 0,
            draggerShadowPosition: 0,
            draggerShadowThickness: 0,
            delta: 0,
            base: 0,
        });
    }
    _computeHandleDisplay(ev) {
        const position = this._getEvOffset(ev);
        const elementIndex = this._getElementIndex(position);
        if (elementIndex < 0) {
            return;
        }
        const element = this._getElement(elementIndex);
        const offset = this._getStateOffset();
        if (position - (element.start - offset) < this.PADDING &&
            elementIndex !== this._getViewportOffset()) {
            this.state.resizerIsActive = true;
            this.state.draggerLinePosition = element.start - offset - this._getHeaderSize();
            this.state.activeElement = this._getPreviousVisibleElement(elementIndex);
        }
        else if (element.end - offset - position < this.PADDING) {
            this.state.resizerIsActive = true;
            this.state.draggerLinePosition = element.end - offset - this._getHeaderSize();
            this.state.activeElement = elementIndex;
        }
        else {
            this.state.resizerIsActive = false;
        }
    }
    _computeGrabDisplay(ev) {
        const index = this._getElementIndex(this._getEvOffset(ev));
        const activeElements = this._getActiveElements();
        const selectedZoneStart = this._getSelectedZoneStart();
        const selectedZoneEnd = this._getSelectedZoneEnd();
        if (activeElements.has(selectedZoneStart)) {
            if (selectedZoneStart <= index && index <= selectedZoneEnd) {
                this.state.waitingForMove = true;
                return;
            }
        }
        this.state.waitingForMove = false;
    }
    onMouseMove(ev) {
        if (this.state.isResizing || this.state.isMoving || this.state.isSelecting) {
            return;
        }
        this._computeHandleDisplay(ev);
        this._computeGrabDisplay(ev);
    }
    onMouseLeave() {
        this.state.resizerIsActive = this.state.isResizing;
        this.state.waitingForMove = false;
    }
    onDblClick() {
        this._fitElementSize(this.state.activeElement);
        this.state.isResizing = false;
    }
    onMouseDown(ev) {
        this.state.isResizing = true;
        this.state.delta = 0;
        const initialPosition = this._getClientPosition(ev);
        const styleValue = this.state.draggerLinePosition;
        const size = this._getElement(this.state.activeElement).size;
        const minSize = styleValue - size + this.MIN_ELEMENT_SIZE;
        const maxSize = this._getMaxSize();
        const onMouseUp = (ev) => {
            this.state.isResizing = false;
            if (this.state.delta !== 0) {
                this._updateSize();
            }
        };
        const onMouseMove = (ev) => {
            this.state.delta = this._getClientPosition(ev) - initialPosition;
            this.state.draggerLinePosition = styleValue + this.state.delta;
            if (this.state.draggerLinePosition < minSize) {
                this.state.draggerLinePosition = minSize;
                this.state.delta = this.MIN_ELEMENT_SIZE - size;
            }
            if (this.state.draggerLinePosition > maxSize) {
                this.state.draggerLinePosition = maxSize;
                this.state.delta = maxSize - styleValue;
            }
        };
        startDnd(onMouseMove, onMouseUp);
    }
    select(ev) {
        if (ev.button > 0) {
            // not main button, probably a context menu
            return;
        }
        const index = this._getElementIndex(this._getEvOffset(ev));
        if (index < 0) {
            return;
        }
        if (this.state.waitingForMove === true) {
            this.startMovement(ev);
            return;
        }
        this.startSelection(ev, index);
    }
    startMovement(ev) {
        this.state.waitingForMove = false;
        this.state.isMoving = true;
        const startElement = this._getElement(this._getSelectedZoneStart());
        const endElement = this._getElement(this._getSelectedZoneEnd());
        const initialPosition = this._getClientPosition(ev);
        const defaultPosition = startElement.start - this._getStateOffset() - this._getHeaderSize();
        this.state.draggerLinePosition = defaultPosition;
        this.state.base = this._getSelectedZoneStart();
        this.state.draggerShadowPosition = defaultPosition;
        this.state.draggerShadowThickness = endElement.end - startElement.start;
        const mouseMoveMovement = (elementIndex, currentEv) => {
            if (elementIndex >= 0) {
                // define draggerLinePosition
                const element = this._getElement(elementIndex);
                const offset = this._getStateOffset() + this._getHeaderSize();
                if (elementIndex <= this._getSelectedZoneStart()) {
                    this.state.draggerLinePosition = element.start - offset;
                    this.state.base = elementIndex;
                }
                else if (this._getSelectedZoneEnd() < elementIndex) {
                    this.state.draggerLinePosition = element.end - offset;
                    this.state.base = elementIndex + 1;
                }
                else {
                    this.state.draggerLinePosition = startElement.start - offset;
                    this.state.base = this._getSelectedZoneStart();
                }
                // define draggerShadowPosition
                const delta = this._getClientPosition(currentEv) - initialPosition;
                this.state.draggerShadowPosition = Math.max(defaultPosition + delta, 0);
            }
        };
        const mouseUpMovement = (finalEv) => {
            this.state.isMoving = false;
            if (this.state.base !== this._getSelectedZoneStart()) {
                this._moveElements();
            }
            this._computeGrabDisplay(finalEv);
        };
        this.dragOverlayBeyondTheViewport(ev, mouseMoveMovement, mouseUpMovement);
    }
    startSelection(ev, index) {
        this.state.isSelecting = true;
        if (ev.shiftKey) {
            this._increaseSelection(index);
        }
        else {
            this._selectElement(index, ev.ctrlKey);
        }
        this.lastSelectedElementIndex = index;
        const mouseMoveSelect = (elementIndex, currentEv) => {
            if (elementIndex !== this.lastSelectedElementIndex && elementIndex !== -1) {
                this._increaseSelection(elementIndex);
                this.lastSelectedElementIndex = elementIndex;
            }
        };
        const mouseUpSelect = () => {
            this.state.isSelecting = false;
            this.lastSelectedElementIndex = null;
            this.env.model.dispatch(ev.ctrlKey ? "PREPARE_SELECTION_INPUT_EXPANSION" : "STOP_SELECTION_INPUT");
            this._computeGrabDisplay(ev);
        };
        this.dragOverlayBeyondTheViewport(ev, mouseMoveSelect, mouseUpSelect);
    }
    dragOverlayBeyondTheViewport(ev, cbMouseMove, cbMouseUp) {
        let timeOutId = null;
        let currentEv;
        const initialPosition = this._getClientPosition(ev);
        const initialOffset = this._getEvOffset(ev);
        const onMouseMove = (ev) => {
            currentEv = ev;
            if (timeOutId) {
                return;
            }
            const position = this._getClientPosition(currentEv) - initialPosition + initialOffset;
            const EdgeScrollInfo = this._getEdgeScroll(position);
            const { first, last } = this._getBoundaries();
            let elementIndex;
            if (EdgeScrollInfo.canEdgeScroll) {
                elementIndex = EdgeScrollInfo.direction > 0 ? last : first - 1;
            }
            else {
                elementIndex = this._getElementIndex(position);
            }
            cbMouseMove(elementIndex, currentEv);
            // adjust viewport if necessary
            if (EdgeScrollInfo.canEdgeScroll) {
                this._adjustViewport(EdgeScrollInfo.direction);
                timeOutId = setTimeout(() => {
                    timeOutId = null;
                    onMouseMove(currentEv);
                }, Math.round(EdgeScrollInfo.delay));
            }
        };
        const onMouseUp = (finalEv) => {
            clearTimeout(timeOutId);
            cbMouseUp(finalEv);
        };
        startDnd(onMouseMove, onMouseUp);
    }
    onMouseUp(ev) {
        this.lastSelectedElementIndex = null;
    }
    onContextMenu(ev) {
        ev.preventDefault();
        const index = this._getElementIndex(this._getEvOffset(ev));
        if (index < 0)
            return;
        if (!this._getActiveElements().has(index)) {
            this._selectElement(index, false);
        }
        const type = this._getType();
        const { x, y } = this._getXY(ev);
        // todo: define props
        this.props.onOpenContextMenu(type, x, y);
    }
}
css /* scss */ `
  .o-col-resizer {
    position: absolute;
    top: 0;
    left: ${HEADER_WIDTH}px;
    right: 0;
    height: ${HEADER_HEIGHT}px;
    &.o-dragging {
      cursor: grabbing;
    }
    &.o-grab {
      cursor: grab;
    }
    .dragging-col-line {
      top: ${HEADER_HEIGHT}px;
      position: absolute;
      width: 2px;
      height: 10000px;
      background-color: black;
    }
    .dragging-col-shadow {
      top: ${HEADER_HEIGHT}px;
      position: absolute;
      height: 10000px;
      background-color: black;
      opacity: 0.1;
    }
    .o-handle {
      position: absolute;
      height: ${HEADER_HEIGHT}px;
      width: 4px;
      cursor: e-resize;
      background-color: ${SELECTION_BORDER_COLOR};
    }
    .dragging-resizer {
      top: ${HEADER_HEIGHT}px;
      position: absolute;
      margin-left: 2px;
      width: 1px;
      height: 10000px;
      background-color: ${SELECTION_BORDER_COLOR};
    }
    .o-unhide {
      width: ${UNHIDE_ICON_EDGE_LENGTH}px;
      height: ${UNHIDE_ICON_EDGE_LENGTH}px;
      position: absolute;
      overflow: hidden;
      border-radius: 2px;
      top: calc(${HEADER_HEIGHT}px / 2 - ${UNHIDE_ICON_EDGE_LENGTH}px / 2);
    }
    .o-unhide:hover {
      z-index: 1;
      background-color: lightgrey;
    }
    .o-unhide > svg {
      position: relative;
      top: calc(${UNHIDE_ICON_EDGE_LENGTH}px / 2 - ${ICON_EDGE_LENGTH}px / 2);
    }
  }
`;
export class ColResizer extends AbstractResizer {
    setup() {
        super.setup();
        this.colResizerRef = useRef("colResizer");
        this.PADDING = 15;
        this.MAX_SIZE_MARGIN = 90;
        this.MIN_ELEMENT_SIZE = MIN_COL_WIDTH;
    }
    _getEvOffset(ev) {
        return ev.offsetX + HEADER_WIDTH;
    }
    _getStateOffset() {
        return this.env.model.getters.getActiveViewport().offsetX - HEADER_WIDTH;
    }
    _getViewportOffset() {
        return this.env.model.getters.getActiveViewport().left;
    }
    _getClientPosition(ev) {
        return ev.clientX;
    }
    _getElementIndex(index) {
        return this.env.model.getters.getColIndex(index, this.env.model.getters.getActiveViewport().offsetX);
    }
    _getSelectedZoneStart() {
        return this.env.model.getters.getSelectedZone().left;
    }
    _getSelectedZoneEnd() {
        return this.env.model.getters.getSelectedZone().right;
    }
    _getEdgeScroll(position) {
        return this.env.model.getters.getEdgeScrollCol(position);
    }
    _getBoundaries() {
        const { left, right } = this.env.model.getters.getActiveViewport();
        return { first: left, last: right };
    }
    _getElement(index) {
        return this.env.model.getters.getCol(this.env.model.getters.getActiveSheetId(), index);
    }
    _getBottomRightValue(element) {
        return element.end;
    }
    _getHeaderSize() {
        return HEADER_WIDTH;
    }
    _getMaxSize() {
        return this.colResizerRef.el.clientWidth;
    }
    _updateSize() {
        const index = this.state.activeElement;
        const size = this.state.delta + this._getElement(index).size;
        const cols = this.env.model.getters.getActiveCols();
        this.env.model.dispatch("RESIZE_COLUMNS_ROWS", {
            dimension: "COL",
            sheetId: this.env.model.getters.getActiveSheetId(),
            elements: cols.has(index) ? [...cols] : [index],
            size,
        });
    }
    _moveElements() {
        const elements = [];
        const start = this._getSelectedZoneStart();
        const end = this._getSelectedZoneEnd();
        for (let colIndex = start; colIndex <= end; colIndex++) {
            elements.push(colIndex);
        }
        const result = this.env.model.dispatch("MOVE_COLUMNS_ROWS", {
            sheetId: this.env.model.getters.getActiveSheetId(),
            dimension: "COL",
            base: this.state.base,
            elements,
        });
        if (!result.isSuccessful && result.reasons.includes(2 /* WillRemoveExistingMerge */)) {
            this.env.notifyUser(_lt("Merged cells are preventing this operation. Unmerge those cells and try again."));
        }
    }
    _selectElement(index, ctrlKey) {
        this.env.model.selection.selectColumn(index, ctrlKey ? "newAnchor" : "overrideSelection");
    }
    _increaseSelection(index) {
        this.env.model.selection.selectColumn(index, "updateAnchor");
    }
    _adjustViewport(direction) {
        const { left, offsetY } = this.env.model.getters.getActiveViewport();
        const { cols } = this.env.model.getters.getActiveSheet();
        const offsetX = cols[left + direction].start;
        this.props.onSetScrollbarValue(offsetX, offsetY);
    }
    _fitElementSize(index) {
        const cols = this.env.model.getters.getActiveCols();
        this.env.model.dispatch("AUTORESIZE_COLUMNS", {
            sheetId: this.env.model.getters.getActiveSheetId(),
            cols: cols.has(index) ? [...cols] : [index],
        });
    }
    _getType() {
        return "COL";
    }
    _getActiveElements() {
        return this.env.model.getters.getActiveCols();
    }
    _getXY(ev) {
        return {
            x: ev.offsetX + HEADER_WIDTH,
            y: ev.offsetY,
        };
    }
    _getPreviousVisibleElement(index) {
        const cols = this.env.model.getters.getActiveSheet().cols.slice(0, index);
        const step = cols.reverse().findIndex((col) => !col.isHidden);
        return index - 1 - step;
    }
    unhide(hiddenElements) {
        this.env.model.dispatch("UNHIDE_COLUMNS_ROWS", {
            sheetId: this.env.model.getters.getActiveSheetId(),
            elements: hiddenElements,
            dimension: "COL",
        });
    }
    unhideStyleValue(hiddenIndex) {
        const col = this.env.model.getters.getCol(this.env.model.getters.getActiveSheetId(), hiddenIndex);
        const offset = this._getStateOffset();
        return col.start - offset - this._getHeaderSize();
    }
}
ColResizer.template = xml /* xml */ `
    <div class="o-col-resizer" t-on-mousemove.self="onMouseMove" t-on-mouseleave="onMouseLeave" t-on-mousedown.self.prevent="select" t-ref="colResizer"
      t-on-mouseup.self="onMouseUp" t-on-contextmenu.self="onContextMenu" t-att-class="{'o-grab': state.waitingForMove, 'o-dragging': state.isMoving, }">
      <div t-if="state.isMoving" class="dragging-col-line" t-attf-style="left:{{state.draggerLinePosition}}px;"/>
      <div t-if="state.isMoving" class="dragging-col-shadow" t-attf-style="left:{{state.draggerShadowPosition}}px; width:{{state.draggerShadowThickness}}px"/>
      <t t-if="state.resizerIsActive">
        <div class="o-handle" t-on-mousedown="onMouseDown" t-on-dblclick="onDblClick" t-on-contextmenu.prevent=""
        t-attf-style="left:{{state.draggerLinePosition - 2}}px;">
        <div class="dragging-resizer" t-if="state.isResizing"/>
        </div>
      </t>
      <t t-foreach="env.model.getters.getHiddenColsGroups(env.model.getters.getActiveSheetId())" t-as="hiddenItem" t-key="hiddenItem_index">
        <t t-if="!hiddenItem.includes(0)">
          <div class="o-unhide" t-att-data-index="hiddenItem_index" t-attf-style="left:{{unhideStyleValue(hiddenItem[0]) - 17}}px; margin-right:6px;" t-on-click="() => this.unhide(hiddenItem)">
          ${icons.TRIANGLE_LEFT_ICON}
          </div>
        </t>
        <t t-if="!hiddenItem.includes(env.model.getters.getActiveSheet().cols.length-1)">
          <div class="o-unhide" t-att-data-index="hiddenItem_index" t-attf-style="left:{{unhideStyleValue(hiddenItem[0]) + 3}}px;" t-on-click="() => this.unhide(hiddenItem)">
          ${icons.TRIANGLE_RIGHT_ICON}
          </div>
        </t>
      </t>
    </div>`;
css /* scss */ `
  .o-row-resizer {
    position: absolute;
    top: ${HEADER_HEIGHT}px;
    left: 0;
    right: 0;
    width: ${HEADER_WIDTH}px;
    height: 100%;
    &.o-dragging {
      cursor: grabbing;
    }
    &.o-grab {
      cursor: grab;
    }
    .dragging-row-line {
      left: ${HEADER_WIDTH}px;
      position: absolute;
      width: 10000px;
      height: 2px;
      background-color: black;
    }
    .dragging-row-shadow {
      left: ${HEADER_WIDTH}px;
      position: absolute;
      width: 10000px;
      background-color: black;
      opacity: 0.1;
    }
    .o-handle {
      position: absolute;
      height: 4px;
      width: ${HEADER_WIDTH}px;
      cursor: n-resize;
      background-color: ${SELECTION_BORDER_COLOR};
    }
    .dragging-resizer {
      left: ${HEADER_WIDTH}px;
      position: absolute;
      margin-top: 2px;
      width: 10000px;
      height: 1px;
      background-color: ${SELECTION_BORDER_COLOR};
    }
    .o-unhide {
      width: ${UNHIDE_ICON_EDGE_LENGTH}px;
      height: ${UNHIDE_ICON_EDGE_LENGTH}px;
      position: absolute;
      overflow: hidden;
      border-radius: 2px;
      left: calc(${HEADER_WIDTH}px - ${UNHIDE_ICON_EDGE_LENGTH}px - 2px);
    }
    .o-unhide > svg {
      position: relative;
      left: calc(${UNHIDE_ICON_EDGE_LENGTH}px / 2 - ${ICON_EDGE_LENGTH}px / 2);
      top: calc(${UNHIDE_ICON_EDGE_LENGTH}px / 2 - ${ICON_EDGE_LENGTH}px / 2);
    }
    .o-unhide:hover {
      z-index: 1;
      background-color: lightgrey;
    }
  }
`;
export class RowResizer extends AbstractResizer {
    setup() {
        super.setup();
        this.rowResizerRef = useRef("rowResizer");
        this.PADDING = 5;
        this.MAX_SIZE_MARGIN = 60;
        this.MIN_ELEMENT_SIZE = MIN_ROW_HEIGHT;
    }
    _getEvOffset(ev) {
        return ev.offsetY + HEADER_HEIGHT;
    }
    _getStateOffset() {
        return this.env.model.getters.getActiveViewport().offsetY - HEADER_HEIGHT;
    }
    _getViewportOffset() {
        return this.env.model.getters.getActiveViewport().top;
    }
    _getClientPosition(ev) {
        return ev.clientY;
    }
    _getElementIndex(index) {
        return this.env.model.getters.getRowIndex(index, this.env.model.getters.getActiveViewport().offsetY);
    }
    _getSelectedZoneStart() {
        return this.env.model.getters.getSelectedZone().top;
    }
    _getSelectedZoneEnd() {
        return this.env.model.getters.getSelectedZone().bottom;
    }
    _getEdgeScroll(position) {
        return this.env.model.getters.getEdgeScrollRow(position);
    }
    _getBoundaries() {
        const { top, bottom } = this.env.model.getters.getActiveViewport();
        return { first: top, last: bottom };
    }
    _getElement(index) {
        return this.env.model.getters.getRow(this.env.model.getters.getActiveSheetId(), index);
    }
    _getHeaderSize() {
        return HEADER_HEIGHT;
    }
    _getMaxSize() {
        return this.rowResizerRef.el.clientHeight;
    }
    _updateSize() {
        const index = this.state.activeElement;
        const size = this.state.delta + this._getElement(index).size;
        const rows = this.env.model.getters.getActiveRows();
        this.env.model.dispatch("RESIZE_COLUMNS_ROWS", {
            dimension: "ROW",
            sheetId: this.env.model.getters.getActiveSheetId(),
            elements: rows.has(index) ? [...rows] : [index],
            size,
        });
    }
    _moveElements() {
        const elements = [];
        const start = this._getSelectedZoneStart();
        const end = this._getSelectedZoneEnd();
        for (let rowIndex = start; rowIndex <= end; rowIndex++) {
            elements.push(rowIndex);
        }
        const result = this.env.model.dispatch("MOVE_COLUMNS_ROWS", {
            sheetId: this.env.model.getters.getActiveSheetId(),
            dimension: "ROW",
            base: this.state.base,
            elements,
        });
        if (!result.isSuccessful && result.reasons.includes(2 /* WillRemoveExistingMerge */)) {
            this.env.notifyUser(_lt("Merged cells are preventing this operation. Unmerge those cells and try again."));
        }
    }
    _selectElement(index, ctrlKey) {
        this.env.model.selection.selectRow(index, ctrlKey ? "newAnchor" : "overrideSelection");
    }
    _increaseSelection(index) {
        this.env.model.selection.selectRow(index, "updateAnchor");
    }
    _adjustViewport(direction) {
        const { top, offsetX } = this.env.model.getters.getActiveViewport();
        const { rows } = this.env.model.getters.getActiveSheet();
        const offsetY = rows[top + direction].start;
        this.props.onSetScrollbarValue(offsetX, offsetY);
    }
    _fitElementSize(index) {
        const rows = this.env.model.getters.getActiveRows();
        this.env.model.dispatch("AUTORESIZE_ROWS", {
            sheetId: this.env.model.getters.getActiveSheetId(),
            rows: rows.has(index) ? [...rows] : [index],
        });
    }
    _getType() {
        return "ROW";
    }
    _getActiveElements() {
        return this.env.model.getters.getActiveRows();
    }
    _getXY(ev) {
        return {
            x: ev.offsetX,
            y: ev.offsetY + HEADER_HEIGHT,
        };
    }
    _getPreviousVisibleElement(index) {
        const rows = this.env.model.getters.getActiveSheet().rows.slice(0, index);
        const step = rows.reverse().findIndex((row) => !row.isHidden);
        return index - 1 - step;
    }
    unhide(hiddenElements) {
        this.env.model.dispatch("UNHIDE_COLUMNS_ROWS", {
            sheetId: this.env.model.getters.getActiveSheetId(),
            dimension: "ROW",
            elements: hiddenElements,
        });
    }
    unhideStyleValue(hiddenIndex) {
        const row = this.env.model.getters.getRow(this.env.model.getters.getActiveSheetId(), hiddenIndex);
        const offset = this._getStateOffset();
        return row.start - offset - this._getHeaderSize();
    }
}
RowResizer.template = xml /* xml */ `
    <div class="o-row-resizer" t-on-mousemove.self="onMouseMove" t-on-mouseleave="onMouseLeave" t-on-mousedown.self.prevent="select" t-ref="rowResizer"
    t-on-mouseup.self="onMouseUp" t-on-contextmenu.self="onContextMenu" t-att-class="{'o-grab': state.waitingForMove, 'o-dragging': state.isMoving}">
      <div t-if="state.isMoving" class="dragging-row-line" t-attf-style="top:{{state.draggerLinePosition}}px;"/>
      <div t-if="state.isMoving" class="dragging-row-shadow" t-attf-style="top:{{state.draggerShadowPosition}}px; height:{{state.draggerShadowThickness}}px;"/>
      <t t-if="state.resizerIsActive">
        <div class="o-handle" t-on-mousedown="onMouseDown" t-on-dblclick="onDblClick" t-on-contextmenu.prevent=""
          t-attf-style="top:{{state.draggerLinePosition - 2}}px;">
          <div class="dragging-resizer" t-if="state.isResizing"/>
        </div>
      </t>
      <t t-foreach="env.model.getters.getHiddenRowsGroups(env.model.getters.getActiveSheetId())" t-as="hiddenItem" t-key="hiddenItem_index">
        <t t-if="!hiddenItem.includes(0)">
          <div class="o-unhide" t-att-data-index="hiddenItem_index" t-attf-style="top:{{unhideStyleValue(hiddenItem[0]) - 17}}px;" t-on-click="() => this.unhide(hiddenItem)">
          ${icons.TRIANGLE_UP_ICON}
          </div>
        </t>
        <t t-if="!hiddenItem.includes(env.model.getters.getActiveSheet().rows.length-1)">
         <div class="o-unhide" t-att-data-index="hiddenItem_index"  t-attf-style="top:{{unhideStyleValue(hiddenItem[0]) + 3}}px;" t-on-click="() => this.unhide(hiddenItem)">
         ${icons.TRIANGLE_DOWN_ICON}
         </div>
        </t>
      </t>
    </div>`;
css /* scss */ `
  .o-overlay {
    .all {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      width: ${HEADER_WIDTH}px;
      height: ${HEADER_HEIGHT}px;
    }
  }
`;
export class Overlay extends Component {
    selectAll() {
        this.env.model.selection.selectAll();
    }
}
Overlay.template = xml /* xml */ `
    <div class="o-overlay">
      <ColResizer onOpenContextMenu="props.onOpenContextMenu" onSetScrollbarValue="props.onSetScrollbarValue"/>
      <RowResizer onOpenContextMenu="props.onOpenContextMenu" onSetScrollbarValue="props.onSetScrollbarValue"/>
      <div class="all" t-on-mousedown.self="selectAll"/>
    </div>`;
Overlay.components = { ColResizer, RowResizer };
//# sourceMappingURL=overlay.js.map