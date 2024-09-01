export class ScrollBar {
    constructor(el, direction) {
        this.el = el;
        this.direction = direction;
    }
    get scroll() {
        return this.direction === "horizontal" ? this.el.scrollLeft : this.el.scrollTop;
    }
    set scroll(value) {
        if (this.direction === "horizontal") {
            this.el.scrollLeft = value;
        }
        else {
            this.el.scrollTop = value;
        }
    }
}
//# sourceMappingURL=scrollbar.js.map