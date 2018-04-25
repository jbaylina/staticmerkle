const buffUtils = require("./buffUtils");
const createKeccakHash = require("keccak");

module.exports = (b) => {
    const value = buffUtils.toBuffer(b);
    return createKeccakHash("keccak256").update(value).digest();
};

