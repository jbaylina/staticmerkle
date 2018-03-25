const buffUtils = require("./buffUtils.js");

exports.buildClaim = buildClaim;
exports.parseClaim = parseClaim;

function buildClaim(claimSig, claimedId, claimType, claimValue) {
    return Buffer.concat(
        [
            buffUtils.padLeft(claimSig, 32),
            buffUtils.padLeft(claimedId, 32),
            buffUtils.padLeft(claimType, 32),
            buffUtils.padLeft(claimValue, 32),
        ]
    );
}

function parseClaim(claim) {
    const b = buffUtils.toBuffer(claim);
    return {
        random: b.slice(0, 32).toString("hex"),
        claimedId: b.slice(32, 64).toString("hex"),
        type: b.slice(64, 96).toString("hex"),
        data: b.slice(96).toString("hex"),
    };
}
