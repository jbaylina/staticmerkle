#!/usr/bin/env node
/* eslint-disable no-console */
const argv = require("optimist")
    .alias("d", "dbFile")
    .alias("c", "commit")
    .argv;

const api = require("./src/api.js");


function printHelp() {
    console.log("  Commands:");
    console.log("      add <claimsFile>    -> Adds the claims in the input file to the db");
    console.log("      rm <claimsFile>     -> Removes claims in the input file to the db");
    console.log("      info              -> Print the commits of a file and all the versions");
    console.log("      generateProof <claim> -> Print the Merkle proof of a claim");
    console.log("      testProof <claim> -> Print the Merkle proof of a claim");
    console.log("      export -> Print all the claims");
    console.log("");
    console.log("<claimsFile> is a file where each line contains a claim in hexadecimal");
    console.log("<claim> is an hexadecimal string");
}

const run = async () => {
    if (argv._[0] == "add") {
        await api.addClaimsFile(argv.dbFile, argv._[1]);
    } else if (argv._[0] == "export") {
        const claims = await api.export(argv.dbFile, argv.commit);
        for (let i= 0; i<claims.length; i++) {
            console.log(claims[i].toString("hex"));
        }
    } else {
        throw("Invalid command");
    }
};

run().then(() =>  {
    process.exit(0);
}, (err) => {
    console.log(err.stack);
    console.log("ERROR: " +  err);
    printHelp();
    process.exit(1);
});
