/**
 * Decode the error 0x57f447ce
 */
import { decodeErrorResult, keccak256, toBytes, parseAbiItem } from 'viem';

// The raw error data from the contract
const rawError = '0x57f447ce0000000000000000000000008d39ee33fba624da8666d74428ad5de2dfe8e469';

// Try to decode known OpenZeppelin 5.x errors
const errors = [
  // AccessControl errors
  'error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)',
  'error AccessControlBadConfirmation()',
  // ERC1155 errors
  'error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId)',
  'error ERC1155InvalidApprover(address approver)',
  'error ERC1155InvalidOperator(address operator)',
  'error ERC1155InvalidReceiver(address receiver)',
  'error ERC1155InvalidSender(address sender)',
  'error ERC1155MissingApprovalForAll(address operator, address owner)',
  // Other possible errors
  'error OwnableUnauthorizedAccount(address account)',
  'error InvalidAddress(address addr)',
];

console.log('=== DECODE ERROR 0x57f447ce ===\n');
console.log('Raw error data:', rawError);
console.log('');

// Get selector from known errors
for (const errorSig of errors) {
  try {
    const parsed = parseAbiItem(errorSig);
    if (parsed.type === 'error') {
      const selector = keccak256(toBytes(`${parsed.name}(${parsed.inputs.map(i => i.type).join(',')})`)).slice(0, 10);
      console.log(`${parsed.name}: ${selector}`);
      
      if (selector === '0x57f447ce') {
        console.log('\n✅ FOUND MATCH!');
        console.log('Error:', errorSig);
        
        // Decode the error
        const decoded = decodeErrorResult({
          abi: [parsed],
          data: rawError as `0x${string}`,
        });
        console.log('Decoded args:', decoded.args);
      }
    }
  } catch (e) {
    // Skip invalid
  }
}

// Also manually check what 0x57f447ce could be
console.log('\n--- Manual Analysis ---');
console.log('Selector: 0x57f447ce');
console.log('Data after selector (32 bytes):', rawError.slice(10));

// The address in the error
const addressInError = '0x' + rawError.slice(34, 74);
console.log('Address in error data:', addressInError);
console.log('This is the ArtistToken contract address!');

// This suggests the error might have a different signature
// Let's calculate some error signatures
console.log('\n--- Searching for error signature ---');

const testErrors = [
  'InvalidAddress(address)',
  'NotAuthorized(address)',
  'Unauthorized(address)',
  'InvalidCaller(address)',
  'CallerNotAllowed(address)',
  'OnlyOwner(address)',
  'RestrictedTo(address)',
];

for (const err of testErrors) {
  const selector = keccak256(toBytes(err)).slice(0, 10);
  console.log(`${err}: ${selector}`);
}

// If this is from msg.sender being the contract in some internal call
console.log('\n--- Possible Issue ---');
console.log('The error shows the ArtistToken CONTRACT address as the problematic account.');
console.log('This could mean:');
console.log('1. An internal call is failing');
console.log('2. The _mint function is checking something about the contract');
console.log('3. Some validation is failing with the contract as subject');
