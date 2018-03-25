const buffUtils = require("./buffUtils");
const crypto = require("crypto");

module.exports = (b) => {
    const buff = buffUtils.toBuffer(b);
    return crypto.createHash("sha256").update(buff).digest();
};
