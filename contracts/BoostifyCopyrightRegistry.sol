// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BoostifyCopyrightRegistry
 * @notice On-chain registry for lyrics copyright evidence hashes.
 *         Each record stores a SHA-256 document hash, the author's wallet,
 *         and the block timestamp — creating an immutable proof of existence.
 */
contract BoostifyCopyrightRegistry {
    struct Record {
        bytes32 documentHash;    // SHA-256 of the authorship packet
        address author;          // Wallet that certified
        uint256 timestamp;       // Block timestamp
        string  songTitle;       // Human-readable identifier
        uint16  authorshipScore; // 0-100 percentage of human authorship
    }

    /// @notice All certification records, indexed by sequential ID
    mapping(uint256 => Record) public records;
    
    /// @notice Lookup: documentHash → recordId (0 means not found, IDs start at 1)
    mapping(bytes32 => uint256) public hashToId;
    
    /// @notice Total number of records
    uint256 public totalRecords;

    /// @notice Platform operator (only needed if you want admin functions later)
    address public owner;

    event CopyrightCertified(
        uint256 indexed recordId,
        bytes32 indexed documentHash,
        address indexed author,
        string  songTitle,
        uint16  authorshipScore,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Register a new copyright hash on-chain
     * @param _documentHash SHA-256 hash of the full authorship evidence packet
     * @param _songTitle    Human-readable song title
     * @param _authorshipScore Percentage of human authorship (0-100)
     */
    function certify(
        bytes32 _documentHash,
        string calldata _songTitle,
        uint16 _authorshipScore
    ) external returns (uint256 recordId) {
        require(_documentHash != bytes32(0), "Empty hash");
        require(hashToId[_documentHash] == 0, "Already certified");
        require(_authorshipScore <= 100, "Score exceeds 100");

        totalRecords++;
        recordId = totalRecords;

        records[recordId] = Record({
            documentHash: _documentHash,
            author: msg.sender,
            timestamp: block.timestamp,
            songTitle: _songTitle,
            authorshipScore: _authorshipScore
        });

        hashToId[_documentHash] = recordId;

        emit CopyrightCertified(
            recordId,
            _documentHash,
            msg.sender,
            _songTitle,
            _authorshipScore,
            block.timestamp
        );
    }

    /**
     * @notice Verify a document hash exists and get its record
     * @param _documentHash The hash to verify
     * @return exists Whether the hash is registered
     * @return author The certifying wallet
     * @return timestamp When it was certified
     * @return songTitle The song title
     * @return authorshipScore The human authorship score
     */
    function verify(bytes32 _documentHash) external view returns (
        bool exists,
        address author,
        uint256 timestamp,
        string memory songTitle,
        uint16 authorshipScore
    ) {
        uint256 id = hashToId[_documentHash];
        if (id == 0) return (false, address(0), 0, "", 0);
        Record memory r = records[id];
        return (true, r.author, r.timestamp, r.songTitle, r.authorshipScore);
    }

    /**
     * @notice Get record by ID
     */
    function getRecord(uint256 _id) external view returns (Record memory) {
        require(_id > 0 && _id <= totalRecords, "Invalid ID");
        return records[_id];
    }
}
