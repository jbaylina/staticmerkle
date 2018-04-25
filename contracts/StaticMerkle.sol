pragma solidity ^0.4.18;

contract StaticMerkle {

    function bytes32atPos(bytes memory buff, uint pos) pure  internal returns(bytes32 r) {
        assembly {
            r := mload(add(add(buff, 32), pos))
        }
    }

    function verify(bytes32 root, bytes claim, bytes mp) public pure  returns(bool) {
        if (mp.length < 32) return false;
        if (claim.length == 0) return false;
        bytes32 claimHash = sha256(claim);
        bytes32 map = bytes32atPos(mp, 0);
        bytes32 void = sha256("");
        bytes32 h = claimHash;
        bytes32 hs;
        uint o = 32;
        uint i;
        for(i=0;i<140;i++) {
            if (map & 1 == 0) {
                hs = void;
            } else {
                hs = bytes32atPos(mp, o);
                o+=32;
            }
            if (claimHash & 1 == 0) {
                h = sha256(h, hs);
            } else {
                h = sha256(hs, h);
            }
            map = map >> 1;
            claimHash = claimHash >> 1;
            void = sha256(void, void);
        }
        if (o!=mp.length) return false;
        return (h==root);
    }

}
