/**
 * Return true if the event was triggered from
 * a child element.
 */
export function isChildEvent(parent, ev) {
    return !!ev.target && parent.contains(ev.target);
}
export function getTextDecoration({ strikethrough, underline, }) {
    if (!strikethrough && !underline) {
        return "none";
    }
    return `${strikethrough ? "line-through" : ""} ${underline ? "underline" : ""}`;
}
//# sourceMappingURL=dom_helpers.js.map