pragma solidity ^0.8.24;

/// @notice Test double with Safe v1.3.0/v1.4.1 hashing and signature encoding.
/// Used only in Anvil tests; production talks to real Safe contracts.
contract MockSafe {
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218;
    bytes32 private constant SAFE_TX_TYPEHASH =
        0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8;

    address[] private ownersArr;
    mapping(address => bool) public isOwner;
    uint256 public threshold;
    uint256 public nonce;
    mapping(address => mapping(bytes32 => uint256)) public approvedHashes;
    string public VERSION;

    receive() external payable {}

    constructor(address[] memory _owners, uint256 _threshold, string memory _version) {
        require(_owners.length > 0, "owners");
        require(_threshold > 0 && _threshold <= _owners.length, "threshold");
        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0) && !isOwner[owner], "dup");
            isOwner[owner] = true;
            ownersArr.push(owner);
        }
        threshold = _threshold;
        VERSION = _version;
    }

    function getOwners() external view returns (address[] memory) {
        return ownersArr;
    }

    function getThreshold() external view returns (uint256) {
        return threshold;
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, block.chainid, this));
    }

    function encodeTransactionData(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) public view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                SAFE_TX_TYPEHASH,
                to,
                value,
                keccak256(data),
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                _nonce
            )
        );
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), structHash);
    }

    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) public view returns (bytes32) {
        return keccak256(
            encodeTransactionData(
                to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, _nonce
            )
        );
    }

    function approveHash(bytes32 hashToApprove) external {
        require(isOwner[msg.sender], "not owner");
        approvedHashes[msg.sender][hashToApprove] = 1;
    }

    function isValidSignature(bytes32 _dataHash, bytes calldata _signature) external view returns (bytes4) {
        checkSignatures(_dataHash, _signature);
        return 0x1626ba7e;
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        bytes memory signatures
    ) public payable returns (bool success) {
        bytes32 txHash = getTransactionHash(
            to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce
        );
        nonce++;
        checkSignatures(txHash, signatures);
        if (operation == 0) {
            (success,) = to.call{value: value}(data);
        } else {
            (success,) = to.delegatecall(data);
        }
        require(success, "call failed");
    }

    function checkSignatures(bytes32 dataHash, bytes memory signatures) public view {
        require(signatures.length >= threshold * 65, "sigs");
        address lastOwner = address(0);
        uint256 required = threshold;
        uint256 i;
        while (i < required) {
            uint256 offset = i * 65;
            address currentOwner;
            uint8 v;
            bytes32 r;
            bytes32 s;
            // solhint-disable-next-line no-inline-assembly
            assembly {
                let sigptr := add(add(signatures, 0x20), offset)
                r := mload(sigptr)
                s := mload(add(sigptr, 32))
                v := byte(0, mload(add(sigptr, 64)))
            }
            if (v == 0) {
                currentOwner = address(uint160(uint256(r)));
                require(uint256(s) + 32 + 32 <= signatures.length, "dyn");
                uint256 contractSigLen;
                bytes memory contractSig;
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let dynptr := add(add(signatures, 0x20), s)
                    contractSigLen := mload(dynptr)
                    contractSig := mload(0x40)
                    mstore(contractSig, contractSigLen)
                    let dest := add(contractSig, 0x20)
                    let src := add(dynptr, 0x20)
                    for { let n := 0 } lt(n, contractSigLen) { n := add(n, 32) } {
                        mstore(add(dest, n), mload(add(src, n)))
                    }
                    mstore(0x40, add(dest, and(add(contractSigLen, 31), not(31))))
                }
                (bool ok, bytes memory ret) = currentOwner.staticcall(
                    abi.encodeWithSignature("isValidSignature(bytes32,bytes)", dataHash, contractSig)
                );
                require(ok && ret.length >= 32 && abi.decode(ret, (bytes4)) == 0x1626ba7e, "1271");
            } else if (v == 1) {
                currentOwner = address(uint160(uint256(r)));
                require(
                    msg.sender == currentOwner || approvedHashes[currentOwner][dataHash] != 0,
                    "approved"
                );
            } else if (v > 30) {
                currentOwner = ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash)), v - 4, r, s);
            } else {
                currentOwner = ecrecover(dataHash, v, r, s);
            }
            require(currentOwner > lastOwner && isOwner[currentOwner], "owner order");
            lastOwner = currentOwner;
            i++;
        }
    }
}
