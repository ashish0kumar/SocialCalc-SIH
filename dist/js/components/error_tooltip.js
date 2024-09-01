import { Component, xml } from "@odoo/owl";
import { css } from "./helpers/css";
const TEMPLATE = xml /* xml */ `
    <div class="o-error-tooltip"> 
      <t t-esc="props.text"/>
    </div>
`;
css /* scss */ `
  .o-error-tooltip {
    font-size: 13px;
    background-color: white;
    border-left: 3px solid red;
    padding: 10px;
  }
`;
export class ErrorToolTip extends Component {
}
ErrorToolTip.template = TEMPLATE;
//# sourceMappingURL=error_tooltip.js.map