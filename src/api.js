
const util = require("util");
const fs = require("fs");
const hash = require("./hashSHA256.js");
const StaticMerkle = require("./StaticMerkle.js");
const level = require("level");
const MemDB = require("../src/dbMem.js");

const readFile = util.promisify(fs.readFile);

exports.addClaimsFile = async (dbFile, claimsfile) => {
    const text = await readFile(claimsfile, "utf8");
    const lines = text.split("\n");
    const db = level(dbFile, {keyEncoding: "binary", valueEncoding: "binary"});
    const tree = await StaticMerkle(hash, db, 140);

    for (let i=0; i<lines.length; i++) {
        await tree.addClaim(lines[i]);
    }
    await tree.commit();
};

exports.removeClaimsFile = async (dbFile, claimsfile) => {
    const text = await readFile(claimsfile, "utf8");
    const lines = text.split("\n");
    const db = level(dbFile, {keyEncoding: "binary", valueEncoding: "binary"});
    const tree = await StaticMerkle(hash, db, 140);

    for (let i=0; i<lines.length; i++) {
        await tree.removeClaim(lines[i]);
    }
    await tree.commit();
};

exports.info = async (dbFile) => {
    const db = level(dbFile, {keyEncoding: "binary", valueEncoding: "binary"});
    const tree = await StaticMerkle(hash, db, 140);

    const commits = await tree.getCommits();

    return commits;
};

exports.export = async (dbFile, commit) => {
    const db = level(dbFile, {keyEncoding: "binary", valueEncoding: "binary"});
    const tree = await StaticMerkle(hash, db, 140);

    const claims = await tree.getAllClaims(commit);

    return claims;
};

exports.generateProof = async (dbFile, commit, claim) => {
    const db = level(dbFile, {keyEncoding: "binary", valueEncoding: "binary"});
    const tree = await StaticMerkle(hash, db, 140);

    return await tree.getMerkeProof(claim);
};

exports.checkProof = async (rootHash, claim, proof) => {
    const db = await MemDB();
    const tree = await StaticMerkle(hash, db, 140);

    return tree.checkClaim(rootHash, claim, proof);
};
