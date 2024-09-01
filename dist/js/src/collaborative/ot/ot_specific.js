import { isDefined, overlap, toZone, zoneToXc } from "../../helpers";
import { otRegistry } from "../../registries";
import { transformZone } from "./ot_helpers";
/*
 * This file contains the specifics transformations
 */
otRegistry.addTransformation("ADD_COLUMNS_ROWS", ["CREATE_CHART", "UPDATE_CHART"], updateChartRangesTransformation);
otRegistry.addTransformation("REMOVE_COLUMNS_ROWS", ["CREATE_CHART", "UPDATE_CHART"], updateChartRangesTransformation);
otRegistry.addTransformation("DELETE_FIGURE", ["UPDATE_FIGURE", "UPDATE_CHART"], updateChartFigure);
otRegistry.addTransformation("ADD_MERGE", ["ADD_MERGE", "REMOVE_MERGE"], mergeTransformation);
otRegistry.addTransformation("ADD_MERGE", ["SORT_CELLS"], sortMergedTransformation);
otRegistry.addTransformation("REMOVE_MERGE", ["SORT_CELLS"], sortUnMergedTransformation);
function updateChartFigure(toTransform, executed) {
    if (toTransform.id === executed.id) {
        return undefined;
    }
    return toTransform;
}
function updateChartRangesTransformation(toTransform, executed) {
    const definition = toTransform.definition;
    let labelZone;
    let dataSets;
    if (definition.labelRange) {
        labelZone = transformZone(toZone(definition.labelRange), executed);
    }
    if (definition.dataSets) {
        dataSets = definition.dataSets
            .map(toZone)
            .map((zone) => transformZone(zone, executed))
            .filter(isDefined)
            .map(zoneToXc);
    }
    return {
        ...toTransform,
        definition: {
            ...definition,
            dataSets,
            labelRange: labelZone ? zoneToXc(labelZone) : undefined,
        },
    };
}
function mergeTransformation(cmd, executed) {
    const target = [];
    for (const zone1 of cmd.target) {
        for (const zone2 of executed.target) {
            if (!overlap(zone1, zone2)) {
                target.push({ ...zone1 });
            }
        }
    }
    if (target.length) {
        return { ...cmd, target };
    }
    return undefined;
}
/**
 * Transforming a sort command with respect to an executed merge command
 * makes no sense. The sorting cannot work! (See the conditions to apply
 * a sort command in the sort plugin)
 * The "canonical" transformation would be to drop the sort command.
 * However, from a functional point of view, we consider the sorting
 * to have more importance than the merge. The transformation is therefore
 * to drop (inverse) the conflicting merged zones.
 */
function sortMergedTransformation(cmd, executed) {
    const overlappingZones = executed.target.filter((mergedZone) => overlap(mergedZone, cmd.zone));
    if (overlappingZones.length) {
        const removeMergeCommand = {
            type: "REMOVE_MERGE",
            target: overlappingZones,
            sheetId: cmd.sheetId,
        };
        return [removeMergeCommand, cmd];
    }
    return cmd;
}
/**
 * Transforming a sort command with respect to an executed merge removed command
 * makes no sense. The sorting cannot work! (See the conditions to apply
 * a sort command in the sort plugin)
 * The "canonical" transformation would be to drop the sort command.
 * However, from a functional point of view, we consider the sorting
 * to have more importance than the merge. The transformation is therefore
 * to drop (inverse) the removed merged zones.
 */
function sortUnMergedTransformation(cmd, executed) {
    const overlappingZones = executed.target.filter((mergedZone) => overlap(mergedZone, cmd.zone));
    if (overlappingZones.length) {
        const addMergeCommand = {
            type: "ADD_MERGE",
            target: overlappingZones,
            sheetId: cmd.sheetId,
        };
        return [addMergeCommand, cmd];
    }
    return cmd;
}
//# sourceMappingURL=ot_specific.js.map