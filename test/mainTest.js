const assert = require("assert");

const StaticMerkle = require("../src/StaticMerkle.js");
const MemDB = require("../src/dbMem.js");
const hash = require("../src/hashKeccak.js");
const buffUtils = require("../src/buffUtils.js");
const claimUtils = require("../src/claimUtils.js");

describe("static merkle", () => {
    before(async () => {

    });

    it("Create an empty tring of 0 levels", async () => {
        const dbPrv0 = await MemDB();
        const SM0 = await StaticMerkle(hash, dbPrv0, 0);
        const empty = SM0.root;
        assert.equal(buffUtils.toHex(empty), "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
    });

    it("create an empty", async () => {
        const dbPrv = await MemDB();
        const SM140 = await StaticMerkle(hash, dbPrv, 140);
        const empty = SM140.root;
        assert.equal(buffUtils.toHex(empty), "0x3bd4272c1c556e016a8f7111b04005319fbd1e546875f354b5dd230f4d8ab1c1");
    });

    it("should add and remove a claim", async() => {
        const dbPrv = await MemDB();
        const SM140 = await StaticMerkle(hash, dbPrv, 140);
        const empty = SM140.root;
        const claim = claimUtils.buildClaim("0x01", "0x02", "0x03", "0x04");
        await SM140.addClaim(claim);
        assert.equal(buffUtils.toHex(SM140.root), "0x062e6d2209d26ca9affe0721ee3c38fcb4e22ff6a09bced50f38026d974cfca7");
        await SM140.removeClaim(claim);
        assert.equal(buffUtils.toHex(SM140.root), buffUtils.toHex(empty));

        assert.equal(SM140.tx.inserts.length, 0);

    });

    it("should add two claims in different order and should be the same", async () => {
        const dbPrv_1 = await MemDB();
        const SM140_1 = await StaticMerkle(hash, dbPrv_1, 140);
        const dbPrv_2 = await MemDB();
        const SM140_2 = await StaticMerkle(hash, dbPrv_2, 140);
        const empty = SM140_1.root;
        const claim1 = claimUtils.buildClaim("0x01", "0x02", "0x03", "0x04");
        const claim2 = claimUtils.buildClaim("0x01", "0x02", "0x03", "0x05");

        await SM140_1.addClaim(claim1);
        await SM140_1.addClaim(claim2);

        await SM140_2.addClaim(claim2);
        await SM140_2.addClaim(claim1);

        assert.equal(buffUtils.toHex(SM140_1.root), buffUtils.toHex(SM140_2.root));

        await SM140_1.removeClaim(claim1);
        await SM140_1.removeClaim(claim2);
        assert.equal(buffUtils.toHex(SM140_1.root), buffUtils.toHex(empty));

        await SM140_2.removeClaim(claim2);
        await SM140_2.removeClaim(claim1);
        assert.equal(buffUtils.toHex(SM140_2.root), buffUtils.toHex(empty));

    });

    it("should add 10 claims and remove them in different order", async () => {
        const dbPrv = await MemDB();
        const SM140 = await StaticMerkle(hash, dbPrv, 140);
        const empty = SM140.root;
        const claims = [];
        let i;
        for (i=0; i<10; i++) {
            const b = Buffer.from([ i / 256, i % 256 ]);
            claims[i] = claimUtils.buildClaim("0x01", "0x02", "0x03", b);
        }

        for (i=0;i<claims.length; i++) {
            await SM140.addClaim(claims[i]);
        }

        assert.equal(buffUtils.toHex(SM140.root), "0x7e9cf308435593267d01f065ca3593666462452f2999ac38e7a0a382db99fb9e");

        for (i=0;i<claims.length; i++) {
            await SM140.removeClaim(claims[i]);
        }

        assert.equal(buffUtils.toHex(SM140.root), buffUtils.toHex(empty));
        assert.equal(SM140.tx.inserts.length, 0);
    });

    it("Should give the same root when added a repeated claim", async () => {
        const dbPrv = await MemDB();
        const SM140 = await StaticMerkle(hash, dbPrv, 140);
        const empty = SM140.root;
        const claims = [];
        let i;
        for (i=0; i<100; i++) {
            const b = Buffer.from([ i % 10 ]);
            claims[i] = claimUtils.buildClaim("0x01", "0x02", "0x03", b);
        }

        for (i=0;i<claims.length; i++) {
            await SM140.addClaim(claims[i]);
        }

        assert.equal(buffUtils.toHex(SM140.root), "0x7e9cf308435593267d01f065ca3593666462452f2999ac38e7a0a382db99fb9e");

        for (i=0;i<claims.length; i++) {
            await SM140.removeClaim(claims[i]);
        }

        assert.equal(buffUtils.toHex(SM140.root), buffUtils.toHex(empty));
        assert.equal(SM140.tx.inserts.length, 0);
    }).timeout(20000);

    it("Should create a merkle proof and verify it ok", async () => {
        const dbPrv = await MemDB();
        const SM140 = await StaticMerkle(hash, dbPrv, 140);
        const empty = SM140.root;
        const claim1 = claimUtils.buildClaim("0x01", "0x02", "0x03", "0x04");
        const claim2 = claimUtils.buildClaim("0x01", "0x02", "0x03", "0x05");

        await SM140.addClaim(claim1);
        await SM140.addClaim(claim2);

        const mp = await SM140.getMerkeProof(claim1);

        assert.equal(SM140.checkClaim(SM140.root, claim1, mp), true);
        assert.equal(SM140.checkClaim(empty, claim1, mp), false);
        assert.equal(SM140.checkClaim(empty, claim2, mp), false);

        const mp1 = await SM140.getMerkeProof(claim1);
        assert.equal(SM140.checkClaim(SM140.root, claim1, mp1), true);
        const mp2 = await SM140.getMerkeProof(claim2);
        assert.equal(SM140.checkClaim(SM140.root, claim2, mp2), true);
    });

});
