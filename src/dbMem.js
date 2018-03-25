const buffUtils = require("./buffUtils.js");

module.exports = async function init() {
    return new DbMem();
};


class DbMem {

    constructor () {
        this.db={};
    }

    async put(key, value) {
        this.db[key] = value;
        return key;
    }

    async remove(key) {
        delete this.db[key];
    }

    async get(key) {
        const keyH = buffUtils.toHex(key);
        if (!this.db[keyH]) return null;
        return buffUtils.toBuffer(this.db[keyH]);
    }

    async batch(ops) {
        for (let i=0; i<ops; i++) {
            if (ops.type == "del") {
                this.remove(ops.key);
            } else {
                this.put(ops.key, ops.value);
            }
        }
    }

}
