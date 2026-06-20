# BTF-2300 Smart Contract Deployment Guide

## 📋 Overview

El sistema BTF-2300 consiste en 3 smart contracts que trabajan juntos:

| Contrato | Propósito |
|----------|-----------|
| **BTF2300ArtistToken** | Contrato principal ERC-1155 para tokenización de artistas, canciones, catálogos y licencias |
| **BTF2300DEX** | Exchange descentralizado (AMM) para trading de tokens |
| **BTF2300Royalties** | Distribución automática de regalías por streaming y ventas |

## 🔧 Pre-requisitos

### 1. Instalar dependencias de Hardhat

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts dotenv
```

### 2. Configurar variables de entorno

Crea o actualiza el archivo `.env`:

```env
# Wallet del deployer (NUNCA compartir esta clave)
DEPLOYER_PRIVATE_KEY=tu_clave_privada_aqui

# Wallet de la plataforma (recibe el 20% de comisiones)
PLATFORM_WALLET=0xTuWalletDePlataforma

# RPC URLs
POLYGON_RPC_URL=https://polygon-rpc.com/
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/

# Para verificación de contratos
POLYGONSCAN_API_KEY=tu_api_key_de_polygonscan

# Metadata URI base
METADATA_URI=https://api.boostifymusic.com/metadata/
```

### 3. Obtener MATIC para gas

**Testnet (Amoy):**
- Faucet: https://faucet.polygon.technology/

**Mainnet (Polygon):**
- Comprar MATIC en exchanges y transferir a tu wallet

## 🚀 Deployment

### Opción 1: Despliegue completo automático

```bash
# Testnet (recomendado primero)
npx hardhat run scripts/deploy-btf2300.js --network amoy

# Mainnet (producción)
npx hardhat run scripts/deploy-btf2300.js --network polygon
```

### Opción 2: Despliegue local para pruebas

```bash
# Iniciar nodo local
npx hardhat node

# En otra terminal, desplegar
npx hardhat run scripts/deploy-btf2300.js --network localhost
```

## 📍 Después del despliegue

### 1. Guardar direcciones de contratos

El script guarda automáticamente las direcciones en:
- `deployments/latest-{network}.json`
- `deployments/deployment-{network}-{timestamp}.json`

### 2. Actualizar configuración del frontend

Edita `client/src/lib/btf2300-config.ts`:

```typescript
export const BTF2300_ADDRESSES = {
  // Polygon Mainnet (chainId: 137)
  137: {
    artistToken: '0xTU_DIRECCION_ARTIST_TOKEN',
    dex: '0xTU_DIRECCION_DEX',
    royalties: '0xTU_DIRECCION_ROYALTIES',
  },
  // ...
};
```

### 3. Verificar contratos en Polygonscan

El script intenta verificar automáticamente. Si falla, hazlo manualmente:

```bash
# BTF2300ArtistToken
npx hardhat verify --network polygon 0xADDRESS "0xPLATFORM_WALLET" "https://api.boostifymusic.com/metadata/"

# BTF2300DEX
npx hardhat verify --network polygon 0xDEX_ADDRESS "0xARTIST_TOKEN_ADDRESS" "0xPLATFORM_WALLET"

# BTF2300Royalties
npx hardhat verify --network polygon 0xROYALTIES_ADDRESS "0xARTIST_TOKEN_ADDRESS" "0xPLATFORM_WALLET"
```

## 🎵 Uso del Sistema BTF-2300

### Registrar un Artista

```javascript
// Solo MINTER_ROLE puede llamar esto
const tx = await artistToken.registerArtist(
  artistWalletAddress,
  "Nombre del Artista",
  "ipfs://QmMetadataHash"
);
const receipt = await tx.wait();
// Obtener artistId del evento ArtistRegistered
```

### Tokenizar una Canción

```javascript
const tx = await artistToken.tokenizeSong(
  artistId,           // ID del artista
  "Nombre de la Canción",
  "ipfs://QmSongMetadataHash",
  10000,              // Total supply (10,000 tokens)
  ethers.parseEther("0.01") // Precio por token (0.01 MATIC)
);
const receipt = await tx.wait();
// Obtener tokenId del evento SongTokenized
```

### Comprar Tokens (desde el frontend)

```javascript
import { useWriteContract } from 'wagmi';
import { BTF2300_ARTIST_TOKEN_ABI, getBTF2300Addresses } from '@/lib/btf2300-config';

const { writeContract } = useWriteContract();

const buyTokens = async () => {
  const addresses = getBTF2300Addresses(chainId);
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  
  await writeContract({
    address: addresses.artistToken,
    abi: BTF2300_ARTIST_TOKEN_ABI,
    functionName: 'buyTokens',
    args: [
      tokenId,           // Token ID
      amount,            // Cantidad a comprar
      maxPricePerToken,  // Precio máximo (slippage protection)
      deadline           // Deadline
    ],
    value: totalPrice    // ETH/MATIC a enviar
  });
};
```

## 🔐 Roles y Permisos

| Rol | Permisos | Quién lo tiene |
|-----|----------|----------------|
| `DEFAULT_ADMIN_ROLE` | Admin total, puede asignar roles | Deployer |
| `ADMIN_ROLE` | Pausar/despausar, actualizar precios | Deployer |
| `MINTER_ROLE` | Registrar artistas, tokenizar canciones | Backend/Deployer |
| `ARTIST_ROLE` | Gestionar su propia música | Artistas registrados |
| `DISTRIBUTOR_ROLE` | Distribuir regalías | Backend/Oracle |

### Agregar un nuevo minter (ej: servidor backend)

```javascript
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
await artistToken.grantRole(MINTER_ROLE, backendWalletAddress);
```

## 💰 Distribución de Ingresos

### Ventas de Tokens
- **80%** → Artista
- **20%** → Plataforma

### Regalías de Streaming
- **80%** → Artista
- **15%** → Token Holders (proporcional a sus holdings)
- **5%** → Plataforma

## 🔒 Seguridad

Los contratos incluyen:

1. **ReentrancyGuard** - Protección contra ataques de reentrancia
2. **Pausable** - Pausa de emergencia
3. **Front-running protection** - Deadline y slippage checks
4. **Rate limiting** - 1 bloque entre compras
5. **Volume limits** - Límite de volumen diario por usuario
6. **AccessControl** - Roles granulares

## 📊 Monitoreo

### Eventos importantes a escuchar

```javascript
// Nuevo artista registrado
artistToken.on('ArtistRegistered', (artistId, wallet, name, tokenId) => {
  console.log(`Artista ${name} registrado con ID ${artistId}`);
});

// Canción tokenizada
artistToken.on('SongTokenized', (tokenId, artistId, title, supply, price) => {
  console.log(`Canción ${title} tokenizada: ${supply} tokens a ${price} wei`);
});

// Compra de tokens
artistToken.on('TokensPurchased', (tokenId, buyer, amount, total, artistEarnings, platformEarnings) => {
  console.log(`${buyer} compró ${amount} tokens por ${total} wei`);
});

// Regalías distribuidas
royalties.on('RoyaltyDistributed', (tokenId, roundId, artistAmount, holderAmount, platformAmount) => {
  console.log(`Regalías distribuidas para token ${tokenId}`);
});
```

## ❓ Troubleshooting

### Error: "Gas estimation failed"
- Verifica que tienes suficiente MATIC
- Verifica que los parámetros son correctos
- Intenta aumentar el gas limit manualmente

### Error: "Transaction expired"
- El deadline ya pasó, aumenta el tiempo

### Error: "Price exceeded max"
- El precio del token aumentó, actualiza maxPricePerToken

### Error: "Wait 1 block between purchases"
- Anti-bot: espera al siguiente bloque

## 📞 Soporte

Para issues con los contratos:
1. Revisa los eventos en Polygonscan
2. Verifica los balances y aprobaciones
3. Usa `hardhat console` para debugging

---

**⚠️ IMPORTANTE:** Siempre prueba en testnet (Amoy) antes de desplegar en mainnet. Los contratos desplegados son inmutables.
