export class ScrollBar {
    constructor(el, direction) {
        this.el = el;
        this.scrollValue = 0;
    }
    get scroll() {
        return this.scrollValue;
    }
    set scroll(value) {
        this.scrollValue = value;
        this.el.dispatchEvent(new MouseEvent("scroll", { bubbles: true }));
    }
}
//# sourceMappingURL=scrollbar.js.map