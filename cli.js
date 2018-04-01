#!/usr/bin/env node
/* eslint-disable no-console */

const argv = require("optimist")
    .alias("d", "dbFile")
    .alias("c", "commit")
    .string("_")
    .argv;

const buffUtils = require("./src/buffUtils");
const api = require("./src/api.js");


function printHelp() {
    console.log("  Commands:");
    console.log("      add <claimsFile>    -> Adds the claims in the input file to the db");
    console.log("      remove <claimsFile>     -> Removes claims in the input file to the db");
    console.log("      info              -> Print the commits of a file and all the versions");
    console.log("      generateProof <claim> -> Print the Merkle proof of a claim");
    console.log("      checkProof <rootHash> <claim> <merkleProof> -> Check if a proof is valid");
    console.log("      export -> Print all the claims");
    console.log("");
    console.log("<claimsFile> is a file where each line contains a claim in hexadecimal");
    console.log("<claim> is an hexadecimal string");
}

const run = async () => {
    if (argv._[0] == "add") {
        await api.addClaimsFile(argv.dbFile, argv._[1]);
    } else if (argv._[0] == "remove") {
        await api.removeClaimsFile(argv.dbFile, argv._[1]);
    } else if (argv._[0] == "info") {
        const commits = await api.info(argv.dbFile);
        for (let i=1; i<commits.length; i++) {
            console.log(i+ " -> " +buffUtils.toHex(commits[i]));
        }
    } else if (argv._[0] == "generateProof") {
        const mp = await api.generateProof(argv.dbFile, argv.commit, argv._[1]);
        if (!mp) throw new Error("Claim not in the Database");
        console.log(buffUtils.toHex(mp));
    } else if (argv._[0] == "checkProof") {
        const valid = await api.checkProof(argv._[1], argv._[2], argv._[3]);
        if (valid) {
            console.log("VALID");
        } else {
            console.log("INVALID");
        }
    } else if (argv._[0] == "export") {
        const claims = await api.export(argv.dbFile, argv.commit);
        for (let i= 0; i<claims.length; i++) {
            console.log(claims[i].toString("hex"));
        }
    } else {
        console.log("Invalid command");
        printHelp();
    }
};

run().then(() =>  {
//    process.exit(0);
}, (err) => {
//    console.log(err.stack);
    console.log("ERROR: " +  err);
    process.exit(1);
});
