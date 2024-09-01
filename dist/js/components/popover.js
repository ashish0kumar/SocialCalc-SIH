import { Component, xml } from "@odoo/owl";
import { BOTTOMBAR_HEIGHT, SCROLLBAR_WIDTH, TOPBAR_HEIGHT } from "../constants";
const TEMPLATE = xml /* xml */ `
  <t t-portal="'.o-spreadsheet'">
    <div t-att-style="style">
      <t t-slot="default"/>
    </div>
  </t>
`;
export class Popover extends Component {
    get style() {
        const horizontalPosition = `left:${this.horizontalPosition()}`;
        const verticalPosition = `top:${this.verticalPosition()}`;
        const height = `max-height:${this.viewportDimension.height - BOTTOMBAR_HEIGHT - SCROLLBAR_WIDTH}`;
        return `
      position: absolute;
      z-index: 5;
      ${verticalPosition}px;
      ${horizontalPosition}px;
      ${height}px;
      width:${this.props.childWidth}px;
      overflow-y: auto;
      overflow-x: hidden;
      box-shadow: 1px 2px 5px 2px rgb(51 51 51 / 15%);
    `;
    }
    get viewportDimension() {
        return this.env.model.getters.getViewportDimensionWithHeaders();
    }
    get shouldRenderRight() {
        const { x } = this.props.position;
        return x + this.props.childWidth < this.viewportDimension.width;
    }
    get shouldRenderBottom() {
        const { y } = this.props.position;
        return y + this.props.childHeight < this.viewportDimension.height + TOPBAR_HEIGHT;
    }
    horizontalPosition() {
        const { x } = this.props.position;
        if (this.shouldRenderRight) {
            return x;
        }
        return x - this.props.childWidth - this.props.flipHorizontalOffset;
    }
    verticalPosition() {
        const { y } = this.props.position;
        if (this.shouldRenderBottom) {
            return y;
        }
        return Math.max(y - this.props.childHeight + this.props.flipVerticalOffset, this.props.marginTop);
    }
}
Popover.template = TEMPLATE;
Popover.defaultProps = {
    flipHorizontalOffset: 0,
    flipVerticalOffset: 0,
    verticalOffset: 0,
    marginTop: 0,
};
//# sourceMappingURL=popover.js.map