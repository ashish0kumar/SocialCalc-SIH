/*
 * usage: every string should be translated either with _lt if they are registered with a registry at
 *  the load of the app or with Spreadsheet._t in the templates. Spreadsheet._t is exposed in the
 *  sub-env of Spreadsheet components as _t
 * */
// define a mock translation function, when o-spreadsheet runs in standalone it doesn't translate any string
let _translate = (s) => s;
function sprintf(s, ...values) {
    if (values.length === 1 && typeof values[0] === "object") {
        const valuesDict = values[0];
        s = s.replace(/\%\(?([^\)]+)\)s/g, (match, value) => valuesDict[value]);
    }
    else if (values.length > 0) {
        s = s.replace(/\%s/g, () => values.shift());
    }
    return s;
}
/***
 * Allow to inject a translation function from outside o-spreadsheet.
 * @param tfn the function that will do the translation
 */
export function setTranslationMethod(tfn) {
    _translate = tfn;
}
export const _t = function (s, ...values) {
    return sprintf(_translate(s), ...values);
};
export const _lt = function (str, ...values) {
    // casts the object to unknown then to string to trick typescript into thinking that the object it receives is actually a string
    // this way it will be typed correctly (behaves like a string) but tests like typeof _lt("whatever") will be object and not string !
    return new LazyTranslatedString(str, values);
};
class LazyTranslatedString extends String {
    constructor(str, values) {
        super(str);
        this.values = values;
    }
    valueOf() {
        const str = super.valueOf();
        return sprintf(_translate(str), ...this.values);
    }
    toString() {
        return this.valueOf();
    }
}
//# sourceMappingURL=translation.js.map