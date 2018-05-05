const isBuffer = require('is-buffer')

exports.equal = equal;
exports.toBuffer = toBuffer;
exports.toHex = toHex;
exports.padLeft = padLeft;
exports.getBit = getBit;
exports.setBit = setBit;
exports.isBuffer = isBuffer;

function toBuffer (b)  {
    if (isBuffer(b)) return b;
    if (b.substr(0,2) == "0x") {
        return new Buffer.from(b.substr(2), "hex");
    }
    return Buffer.from(b, "hex");
}

function toHex(b) {
    let bHex;
    if (isBuffer(b)) {
        bHex = "0x" + b.toString("hex");
    } else {
        if (b.substr(0,2) == "0x") {
            bHex = b;
        } else {
            bHex = "0x" + b;
        }
    }
    return bHex;
}

function equal(_b1, _b2) {
    const b1=toBuffer(_b1);
    const b2=toBuffer(_b2);
    return (Buffer.compare(b1,b2) == 0);
}

function padLeft(_b, len) {
    const b = toBuffer(_b);
    if (b.length > len) throw new Error("pad Left a bigger buffer");
    if (b.length == len) return b; // Shorcut
    const pad = Buffer.alloc(len - b.length, 0);
    return Buffer.concat([pad, b]);
}

function getBit(_b, bit) {
    const b = toBuffer(_b);
    const v = b.readUInt8(b.length - Math.floor(bit/8) - 1);
    return (v >> (bit % 8)) & 1;
}

function setBit(b, bit, val) {
    let v = b.readUInt8(b.length - Math.floor(bit/8) - 1);
    if (val == 1) {
        v = v | (1 << (bit %8));
    } else {
        v = v & ( (~(1 << bit % 8)) & 0xFF );
    }
    b.writeUInt8(v, b.length - Math.floor(bit/8) - 1);
}
