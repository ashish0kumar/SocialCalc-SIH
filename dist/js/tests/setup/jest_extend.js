expect.extend({
    toExport(model, expected) {
        const exportData = model.exportData();
        if (!this.equals(exportData, { ...expected, revisionId: expect.any(String) }, [
            this.utils.iterableEquality,
        ])) {
            return {
                pass: this.isNot,
                message: () => `Diff: ${this.utils.printDiffOrStringify(expected, exportData, "Expected", "Received", false)}`,
            };
        }
        return { pass: !this.isNot, message: () => "" };
    },
    toHaveSynchronizedValue(users, callback, expected) {
        for (let user of users) {
            const result = callback(user);
            if (!this.equals(result, expected, [this.utils.iterableEquality])) {
                const userId = user.getters.getClient().name;
                return {
                    pass: this.isNot,
                    message: () => `${userId} does not have the expected value: \nReceived: ${this.utils.printReceived(result)}\nExpected: ${this.utils.printExpected(expected)}`,
                };
            }
        }
        return { pass: !this.isNot, message: () => "" };
    },
    toHaveSynchronizedExportedData(users) {
        for (let a of users) {
            for (let b of users) {
                if (a === b) {
                    continue;
                }
                const exportA = a.exportData();
                const exportB = b.exportData();
                if (!this.equals(exportA, exportB, [this.utils.iterableEquality])) {
                    const clientA = a.getters.getClient().id;
                    const clientB = b.getters.getClient().id;
                    return {
                        pass: this.isNot,
                        message: () => `${clientA} and ${clientB} are not synchronized: \n${this.utils.printDiffOrStringify(exportA, exportB, clientA, clientB, false)}`,
                    };
                }
            }
        }
        return { pass: !this.isNot, message: () => "" };
    },
    toBeCancelledBecause(dispatchResult, ...expectedReasons) {
        const pass = this.equals(dispatchResult.reasons, expectedReasons, [
            this.utils.iterableEquality,
        ]);
        const message = () => {
            if (pass) {
                return `The command should not have been cancelled because of reason ${expectedReasons}`;
            }
            else {
                return `
The command should have been cancelled:
Expected: ${this.utils.printExpected(expectedReasons)}
Received: ${this.utils.printReceived(dispatchResult.reasons)}
`;
            }
        };
        return { pass, message };
    },
    toBeSuccessfullyDispatched(dispatchResult) {
        const pass = dispatchResult.isSuccessful;
        const message = () => {
            if (pass) {
                return "The command should not have been successfully dispatched";
            }
            else {
                return `
The command should have been successfully dispatched:
CancelledReasons: ${this.utils.printReceived(dispatchResult.reasons)}
`;
            }
        };
        return { pass, message };
    },
});
export {};
//# sourceMappingURL=jest_extend.js.map