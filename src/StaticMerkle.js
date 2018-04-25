const assert = require("assert");

const buffUtils = require("./buffUtils");


/*

level_depth                   *
level_depth-1             *       *
level_depth-2           *   *   *   *
.
.
level0               ********************

 */

const CLAIM = 0;
const NORMAL_NODE = 1;
const FINAL_NODE = 2;

module.exports = async (hash, db, depth) => {
    const o = new StaticMerkle(hash, db, depth);
    await o.initialize();
    return o;
};


class StaticMerkle {

    constructor(hash, db, depth) {
        this.hash = hash;
        this.db = db;
        this.depth = depth;
        this.tx = {
            inserts: []
        };
    }

    async addClaim(_claim) {
        const claim = buffUtils.toBuffer(_claim);
        if (claim.length == 0) return;
        const claimHash = this.hash(claim);

        const oneElement = this._oneElement(claimHash);

        const newRoot = await this._addClaimHash(this.root, claimHash, this.depth, oneElement);
        this._addClaimDb(claimHash, claim);

        this.root = newRoot;
    }


    async _addClaimHash(rootHash, claimHash, level, oneElement) {
        if (buffUtils.equal(rootHash, this.empty[level])) {
            this._addFinalNode(oneElement[level], claimHash);
            return oneElement[level];
        }
        if (buffUtils.equal(rootHash, oneElement[level])) {
            // Alreay added
            return oneElement[level];
        }
        if (level == 0) {
            assert(false, "Collision");
        }
        const node = await this._readNodeDb(rootHash);
        assert(node);
        let resultHash;
        if (node.type == NORMAL_NODE) {
            resultHash = await this._addClaimToNormalNode(node, claimHash, level, oneElement);
        } else if (node.type == FINAL_NODE) {
            resultHash = this._addClaimToFinalNode(node, claimHash, level, oneElement);
        }

        if (!buffUtils.equal(rootHash, resultHash)) {
            this._removeNodeDb(rootHash);
        }
        return resultHash;
    }

    async _addClaimToNormalNode(node, claimHash, level, oneElement) {
        const bit = buffUtils.getBit(claimHash, level-1);
        const hashes = [];
        if (bit) {
            hashes[0] = node.childH[0];
            hashes[1] = await this._addClaimHash(node.childH[1], claimHash, level-1, oneElement);
            if (buffUtils.equal(hashes[1], node.childH[1])) return node.hash;
        } else {
            hashes[0] = await this._addClaimHash(node.childH[0], claimHash, level-1, oneElement);
            hashes[1] = node.childH[1];
            if (buffUtils.equal(hashes[0], node.childH[0])) return node.hash;
        }
        const h = this._addNormalNode(hashes[0], hashes[1]);
        return h;
    }

    _addClaimToFinalNode(node, claimHash, level, oneElement) {
        let l=level;
        let bit1,bit2;
        const bits = [];
        let h;

        // Go until level is different
        do {
            l--;
            bit1 = buffUtils.getBit(node.claimHash, l);
            bit2 = buffUtils.getBit(claimHash, l);
            bits[l+1] = bit1;
        } while (bit1 == bit2);

        // Calculate oneElements for the already existing element
        const oneElementExisting = this._oneElement(node.claimHash, l);

        //   *                  l+2
        //   |    bits[l+1]
        //  _*_                 l+1
        // |   |
        // *   *                l

        // Create the final nodes at level l
        this._addFinalNode(oneElement[l], claimHash);
        this._addFinalNode(oneElementExisting[l], node.claimHash);

        // Create the spliting nodes level l+1
        if (bit1) {
            h = this._addNormalNode(oneElement[l], oneElementExisting[l]);
        } else {
            h = this._addNormalNode(oneElementExisting[l], oneElement[l]);
        }

        // Go up from l+2 until the root Node
        for (let i=l+2; i<=level; i++) {
            if (bits[i] == 1) {
                h = this._addNormalNode(this.empty[i-1], h);
            } else {
                h = this._addNormalNode(h, this.empty[i-1]);
            }
        }

        return h;
    }


    async removeClaim(_claim) {
        const claim = buffUtils.toBuffer(_claim);
        if (claim.length == 0) return;
        const claimHash = this.hash(claim);

        const oneElement = this._oneElement(claimHash);

        const newRoot = await this._removeClaimHash(this.root, claimHash, this.depth, oneElement);

        this._removeClaimDb(claimHash);

        this.root = newRoot;
    }


    async _removeClaimHash(rootHash, claimHash, level, oneElement) {
        if ( buffUtils.equal(rootHash, this.empty[level]) ) {
            // Does not exist
            return this.empty[level];
        }
        const node = await this._readNodeDb(rootHash);
        if (node.type == NORMAL_NODE) {
            const bit = buffUtils.getBit(claimHash, level-1);
            const hashes = [];
            if (bit) {
                hashes[0] = node.childH[0];
                hashes[1] = await this._removeClaimHash(node.childH[1], claimHash, level-1, oneElement);
                if (buffUtils.equal(hashes[1], node.childH[1])) return node.hash;
            } else {
                hashes[0] = await this._removeClaimHash(node.childH[0], claimHash, level-1, oneElement);
                hashes[1] = node.childH[1];
                if (buffUtils.equal(hashes[0], node.childH[0])) return node.hash;
            }

            this._removeNodeDb(rootHash);

            let nextNode = null;
            let nextNodeHash = null;
            if ((buffUtils.equal(hashes[0], this.empty[level-1])) &&
                (buffUtils.equal(hashes[1], this.empty[level-1]))) {
                return this.empty[level];
            }
            if (buffUtils.equal(hashes[0], this.empty[level-1]) ) {
                nextNodeHash = hashes[1];
            }
            if (buffUtils.equal(hashes[1], this.empty[level-1]) ) {
                nextNodeHash = hashes[0];
            }
            if (nextNodeHash) {
                nextNode = await this._readNodeDb(nextNodeHash);
            }
            if ((!nextNodeHash) || (nextNode.type == NORMAL_NODE)) {
                return this._addNormalNode(hashes[0], hashes[1]);
            }

            this._removeNodeDb(nextNodeHash);

            const h = this._hash2(hashes[0], hashes[1]);
            this._addFinalNode(h, nextNode.claimHash);
            return h;
        } else if (node.type == FINAL_NODE) {
            this._removeNodeDb(rootHash);
            return this.empty[level];
        }
    }

    async getAllClaims(commit) {
        const c = commit || this.currentCommit;
        if (c > this.currentCommit) throw new Error("Invalid commit");
        let rootHash;
        if (c < this.currentCommit) {
            const keyBuffVersion = new Buffer(32);
            keyBuffVersion.writeIntBE(c, 26, 6);

            rootHash = await this.db.get(keyBuffVersion);
        } else {
            rootHash = this.root;
        }
        const hashes = [];
        await this._getClaimHashes(hashes, rootHash, this.depth);
        const promises = [];
        for (let i=0; i<hashes.length; i++) {
            promises.push(this._readClaimDb(hashes[i]));
        }
        return Promise.all(promises);
    }

    async _getClaimHashes(hashes, rootHash, level) {
        if ( buffUtils.equal(rootHash, this.empty[level]) ) {
            return;
        }
        const node = await this._readNodeDb(rootHash);
        assert(node);
        if (node.type == NORMAL_NODE) {
            await this._getClaimHashes(hashes, node.childH[0], level-1);
            await this._getClaimHashes(hashes, node.childH[1], level-1);
        } else if (node.type == FINAL_NODE) {
            hashes.push(node.claimHash);
        }
    }

    async getMerkeProof(_claim, commit) {
        const c = commit || this.currentCommit;
        if (c > this.currentCommit) throw new Error("Invalid commit");
        let rootHash;
        if (c < this.currentCommit) {
            const keyBuffVersion = new Buffer(32);
            keyBuffVersion.writeIntBE(c, 26, 6);
            rootHash = await this.db.get(keyBuffVersion);
        } else {
            rootHash = this.root;
        }

        const claim = buffUtils.toBuffer(_claim);
        const claimHash = this.hash(claim);

        const map = Buffer.alloc(32);
        const siblings = [];

        const res = await this._getMerkleProofHash(map, siblings, rootHash, claimHash, this.depth);

        if (!res) {
            return null;
        }

        siblings.unshift(map);

        const result = Buffer.concat(siblings);

        return result;
    }

    async _getMerkleProofHash(map, siblings, rootHash, claimHash, level) {
        if (level == 0) {
            return (buffUtils.equal(rootHash,claimHash));
        }
        const node = await this._readNodeDb(rootHash);
        assert(node);
        if (node.type == NORMAL_NODE) {
            buffUtils.setBit(map, level-1, 1);
            const bit = buffUtils.getBit(claimHash, level-1);
            if (bit) {
                siblings.unshift(node.childH[0]);
                return await this._getMerkleProofHash(map, siblings, node.childH[1], claimHash, level-1);
            } else {
                siblings.unshift(node.childH[1]);
                return await this._getMerkleProofHash(map, siblings, node.childH[0], claimHash, level-1);
            }
        } else if (node.type == FINAL_NODE) {
            return (buffUtils.equal(node.claimHash,claimHash));
        }
    }

    checkClaim(rootHash, _claim, merkleProof) {
        const claim = buffUtils.toBuffer(_claim);
        const claimHash = this.hash(claim);

        const mp = buffUtils.toBuffer(merkleProof);

        if (mp.length < 32) return false;

        const map = mp.slice(0,32);
        let o = 32;
        let h = claimHash;

        for (let l=1; l<=this.depth; l++) {
            let h2;
            if (buffUtils.getBit(map, l-1)) {
                if (mp.length < o+32) return false;
                h2 = mp.slice(o, o+32);
                o += 32;
            } else {
                h2 = this.empty[l-1];
            }
            if (buffUtils.getBit(claimHash, l-1)) {
                h = this._hash2(h2, h);
            } else {
                h = this._hash2(h, h2);
            }
        }

        return buffUtils.equal(rootHash, h);
    }

    async initialize() {
        const emptyBuff = Buffer.from("");
        this.empty = [];
        this.empty[0] = this.hash(emptyBuff);
        for (let i=1; i<=this.depth; i++) {
            this.empty[i] = this._hash2(this.empty[i-1], this.empty[i-1]);
        }

        let currentVersion;
        try {
            const keyBuffRoot = new Buffer(32);
            const b = await this.db.get(keyBuffRoot);
            if (b) {
                currentVersion = b.readUIntBE(2,6);
            } else {
                currentVersion = null;
            }
        } catch (err) {
            if (err.name == "NotFoundError" ) {
                currentVersion = null;
            } else {
                throw(err);
            }
        }
        if (currentVersion) {
            this.currentCommit = currentVersion + 1;
            const keyBuffVersion = new Buffer(32);
            keyBuffVersion.writeIntBE(currentVersion, 26, 6);
            this.root = await this.db.get(keyBuffVersion);
            assert(this.root);
        } else {
            this.currentCommit = 1;
            this.root = this.empty[this.depth];
        }
    }



    async _readNodeDb(hash) {
        const hashHex = buffUtils.toHex(hash);
        const hashBuff = buffUtils.padLeft(hash);
        const n = {
            hash: hashBuff,
        };
        let r;
        if (this.tx.inserts[hashHex]) {
            r = this.tx.inserts[hashHex];
        } else {
            r = await this.db.get(hashBuff);
        }
        assert(r);
        n.commit = r.readUIntBE(2,6);
        n.type = r.readUIntBE(0,1);
        if (n.type == NORMAL_NODE) {
            n.childH = [
                r.slice(8,40),
                r.slice(40,72)
            ];
        } else {
            n.claimHash = r.slice(8,40);
        }
        return n;
    }

    _addFinalNode(hash, claimHash) {
        const hashHex = buffUtils.toHex(hash);
        const claimHashBuff = buffUtils.toBuffer(claimHash);
        const b = Buffer.allocUnsafe(40);
        b.writeIntBE(FINAL_NODE, 0, 1);
        b.writeIntBE(0, 1, 1);
        b.writeIntBE(this.currentCommit, 2, 6);
        claimHashBuff.copy(b, 8);
        this.tx.inserts[hashHex] = b;
    }

    _addNormalNode(childH1, childH2) {
        const childH1Buff = buffUtils.toBuffer(childH1);
        const childH2Buff = buffUtils.toBuffer(childH2);
        const hash = this._hash2(childH1Buff, childH2Buff);
        const hashHex = buffUtils.toHex(hash);
        const b = Buffer.allocUnsafe(72);
        b.writeIntBE(NORMAL_NODE, 0, 1);
        b.writeIntBE(0, 1, 1);
        b.writeIntBE(this.currentCommit, 2, 6);
        childH1Buff.copy(b, 8);
        childH2Buff.copy(b, 40);
        this.tx.inserts[hashHex] = b;
        return hash;
    }

    _removeNodeDb(hash) {
        const hashHex = buffUtils.toHex(hash);

        if (this.tx.inserts[hashHex]) {
            delete this.tx.inserts[hashHex];
            return;
        }
    }

    async _readClaimDb(claimHash) {
        const claimHashHex = buffUtils.toHex(claimHash);
        const claimHashBuff = buffUtils.padLeft(claimHashHex,32);
        let b;
        if (this.tx.inserts[claimHashHex]) {
            b = this.tx.inserts[claimHashHex];
        } else {
            b = await this.db.get(claimHashBuff);
        }

        return b.slice(8);
    }

    _addClaimDb(claimHash, claim) {
        const claimHashHex = buffUtils.toHex(claimHash);
        const b = Buffer.allocUnsafe(8+claim.length);
        b.writeIntBE(CLAIM, 0, 1);
        b.writeIntBE(0, 1, 1);
        b.writeIntBE(this.currentCommit, 2, 6);
        claim.copy(b, 8);

        this.tx.inserts[claimHashHex] = b;

    }

    async _removeClaimDb(claimHash) {
        const claimHashHex = buffUtils.toHex(claimHash);
        if (this.tx.inserts[claimHashHex]) {
            delete this.tx.inserts[claimHashHex];
        }
    }

    async commit() {
        const _this = this;
        const ops = [];
        Object.keys(this.tx.inserts).map(function(key) {
            const keyBuffNode = buffUtils.padLeft(key,32);
            ops.push({
                key: keyBuffNode,
                value: _this.tx.inserts[key]
            });
        });
        const keyBuffVersion = new Buffer(32);
        keyBuffVersion.writeIntBE(this.currentCommit, 26, 6);
        ops.push({
            key: keyBuffVersion,
            value: this.root
        });
        const keyBuffRoot = new Buffer(32);
        const b = new Buffer(8);
        b.writeIntBE(this.currentCommit, 2, 6);
        ops.push({
            key: keyBuffRoot,
            value: b
        });
        this.currentCommit ++;
        this.tx.inserts = [];
        await this.db.batch(ops);
    }

    async getCommits() {
        const commits = [];
        let r;
        for (let i=1; i<this.currentCommit; i++) {
            const keyBuffVersion = new Buffer(32);
            keyBuffVersion.writeIntBE(i, 26, 6);

            r = await this.db.get(keyBuffVersion);
            commits[i] = r;
        }
        if (!buffUtils.equal(r, this.root)) {
            commits[this.currentCommit] = this.root;
        }
        return commits;
    }

    _hash2(_h1, _h2) {
        const h1 = buffUtils.padLeft(_h1, 32);
        const h2 = buffUtils.padLeft(_h2, 32);

        return this.hash(Buffer.concat([h1, h2]));
    }

    _oneElement(claimHash) {
        const r = [];
        r.push(claimHash);
        for (let i=1; i<= this.depth; i++) {
            const bit = buffUtils.getBit(claimHash, i-1);
            if (bit) {
                r.push(this._hash2(this.empty[i-1], r[i-1]));
            } else {
                r.push(this._hash2(r[i-1], this.empty[i-1]));
            }
        }
        return r;
    }
}

