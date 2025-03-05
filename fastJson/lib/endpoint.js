class JSONBeatifuler {
    constructor(initialData = {}) {
        this.data = JSON.parse(JSON.stringify(initialData));
    }

    get(path) {
        const keys = path.split('.');
        let result = this.data;
        for (const key of keys) {
            if (result[key] === undefined) {
                return null;
            }
            result = result[key];
        }
        return result;
    }

    set(path, value) {
        const keys = path.split('.');
        let obj = this.data;
        while (keys.length > 1) {
            const key = keys.shift();
            if (!obj[key]) {
                obj[key] = {};
            }
            obj = obj[key];
        }
        obj[keys[0]] = value;
    }

    delete(path) {
        const keys = path.split('.');
        let obj = this.data;
        while (keys.length > 1) {
            const key = keys.shift();
            if (!obj[key]) {
                return false;
            }
            obj = obj[key];
        }
        return delete obj[keys[0]];
    }

    toJSON() {
        return JSON.stringify(this.data, null, 2);
    }
}

const fakeDB = new JSONBeatifuler({
    users: {
    }
});