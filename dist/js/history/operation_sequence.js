/**
 * An execution object is a sequence of executionSteps (each execution step is an operation in a branch).
 *
 * You can iterate over the steps of an execution
 * ```js
 * for (const operation of execution) {
 *   // ... do something
 * }
 * ```
 */
export class OperationSequence {
    constructor(operations) {
        this.operations = operations;
    }
    [Symbol.iterator]() {
        return this.operations[Symbol.iterator]();
    }
    /**
     * Stop the operation sequence at a given operation
     * @param operationId included
     */
    stopWith(operationId) {
        function* filter(execution, operationId) {
            for (const step of execution) {
                yield step;
                if (step.operation.id === operationId) {
                    return;
                }
            }
        }
        return new OperationSequence(filter(this.operations, operationId));
    }
    /**
     * Stop the operation sequence before a given operation
     * @param operationId excluded
     */
    stopBefore(operationId) {
        function* filter(execution, operationId) {
            for (const step of execution) {
                if (step.operation.id === operationId) {
                    return;
                }
                yield step;
            }
        }
        return new OperationSequence(filter(this.operations, operationId));
    }
    /**
     * Start the operation sequence at a given operation
     * @param operationId excluded
     */
    startAfter(operationId) {
        function* filter(execution, operationId) {
            let skip = true;
            for (const step of execution) {
                if (!skip) {
                    yield step;
                }
                if (step.operation.id === operationId) {
                    skip = false;
                }
            }
        }
        return new OperationSequence(filter(this.operations, operationId));
    }
}
//# sourceMappingURL=operation_sequence.js.map