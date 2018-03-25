
const util = require("util");
const fs = require("fs");
const hash = require("./hashSHA256.js");
const StaticMerkle = require("./StaticMerkle.js");
const level = require("level");

const readFile = util.promisify(fs.readFile);

exports.addClaimsFile = async (dbFile, claimsfile) => {
    const text = await readFile(claimsfile, "utf8");
    const lines = text.split("\n");
    const db = level(dbFile, {valueEncoding: "binary"});
    const tree = await StaticMerkle(hash, db, 140);

    for (let i=0; i<lines.length; i++) {
        await tree.addClaim(lines[i]);
    }
    await tree.commit();
};

exports.export = async (dbFile, commit) => {
    const db = level(dbFile, {valueEncoding: "binary"});
    const tree = await StaticMerkle(hash, db, 140);

    const claims = await tree.getAllClaims(commit);

    return claims;
};
