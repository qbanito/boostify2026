/**
 * Compile BTF2300 contracts using solc
 */
const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Read OpenZeppelin contracts from node_modules
function findImport(importPath) {
  const basePaths = [
    path.join(process.cwd(), 'node_modules'),
    path.join(process.cwd(), 'contracts'),
  ];
  
  for (const basePath of basePaths) {
    const fullPath = path.join(basePath, importPath);
    if (fs.existsSync(fullPath)) {
      return { contents: fs.readFileSync(fullPath, 'utf8') };
    }
  }
  
  return { error: `File not found: ${importPath}` };
}

const contractsDir = path.join(process.cwd(), 'contracts');
const outputDir = path.join(process.cwd(), 'compiled');

// Create output dir
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Contracts to compile
const contracts = [
  'BTF2300_ArtistToken.sol',
  'BTF2300_DEX.sol',
  'BTF2300_Royalties.sol',
];

// Build sources object
const sources = {};
for (const contract of contracts) {
  const content = fs.readFileSync(path.join(contractsDir, contract), 'utf8');
  sources[contract] = { content };
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    viaIR: true,
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
  },
};

console.log('Compiling BTF-2300 contracts...\n');

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));

// Check for errors
if (output.errors) {
  const hasErrors = output.errors.some(e => e.severity === 'error');
  for (const error of output.errors) {
    console.log(`[${error.severity}] ${error.message}`);
  }
  if (hasErrors) {
    process.exit(1);
  }
}

// Extract and save compiled contracts
const compiled = {};
for (const sourceName in output.contracts) {
  for (const contractName in output.contracts[sourceName]) {
    const contract = output.contracts[sourceName][contractName];
    const artifact = {
      contractName,
      abi: contract.abi,
      bytecode: '0x' + contract.evm.bytecode.object,
    };
    
    const outputPath = path.join(outputDir, `${contractName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
    console.log(`✅ ${contractName} -> ${outputPath}`);
    console.log(`   Bytecode size: ${artifact.bytecode.length / 2} bytes`);
  }
}

console.log('\n✅ All contracts compiled successfully!');
console.log(`Output directory: ${outputDir}`);
