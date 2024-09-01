/**
 * Represent a raw XML string
 */
export class XMLString {
    /**
     * @param xmlString should be a well formed, properly escaped XML string
     */
    constructor(xmlString) {
        this.xmlString = xmlString;
    }
    toString() {
        return this.xmlString;
    }
}
//# sourceMappingURL=xlsx.js.map