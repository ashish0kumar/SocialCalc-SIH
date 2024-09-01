import { expandZoneOnInsertion, reduceZoneOnDeletion } from "../../helpers";
export function transformZone(zone, executed) {
    if (executed.type === "REMOVE_COLUMNS_ROWS") {
        return reduceZoneOnDeletion(zone, executed.dimension === "COL" ? "left" : "top", executed.elements);
    }
    if (executed.type === "ADD_COLUMNS_ROWS") {
        return expandZoneOnInsertion(zone, executed.dimension === "COL" ? "left" : "top", executed.base, executed.position, executed.quantity);
    }
    return { ...zone };
}
//# sourceMappingURL=ot_helpers.js.map