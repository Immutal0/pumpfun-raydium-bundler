// Date:    03/01/2025 
// Authour: Immutal0

import dotenv from "dotenv";
import fs, { openAsBlob } from "fs";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { PumpFunSDK } from "./src";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  printSOLBalance,
  printSPLBalance,
} from "./utils";
import metadata from "./metadata";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

const SLIPPAGE_BASIS_POINTS = 100n;

const main = async () => {
  dotenv.config();

  if (!process.env.HELIUS_RPC_URL) {
    console.error("Need HELIUS_RPC_URL in .env file");
    console.error(
      "Example: HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<your api key>"
    );
    console.error("Get one from Helius Offical Website : https://www.helius.dev");
    return;
  }

  let connection = new Connection(process.env.HELIUS_RPC_URL || "");

  let wallet = new NodeWallet(new Keypair()); //note this is not used
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "finalized",
  });

  if (!process.env.PRIVATE_KEY) {
    console.error("Need your private key in .env file");
    return;
  }

  const private_key = process.env.PRIVATE_KEY;

  const buyer = Keypair.fromSecretKey(bs58.decode(private_key));
  const mint = Keypair.generate();

  await printSOLBalance(
    connection,
    buyer.publicKey,
    "Your Account Pubkey :"
  );

  let sdk = new PumpFunSDK(provider);

  let currentSolBalance = await connection.getBalance(buyer.publicKey);
  if (currentSolBalance == 0) {
    console.log(
      "Need some SOL to the your account:",
      buyer.publicKey.toBase58()
    );
    return;
  }

  //Check if mint already exists
  let boundingCurveAccount = await sdk.getBondingCurveAccount(mint.publicKey);
  if (!boundingCurveAccount) {
    let tokenMetadata = {
      name: metadata.name,
      symbol: metadata.symbol,
      description: metadata.description,
      showName: metadata.showName,
      createOn: metadata.createdOn,
      twitter: metadata.twitter,
      telegram: metadata.telegram,
      website: metadata.website,
      file: await openAsBlob(metadata.image),
    };

    let createResults = await sdk.createAndBuy(
      buyer,
      mint,
      [buyer], // buyers
      tokenMetadata,
      BigInt(0.0001 * LAMPORTS_PER_SOL),
      SLIPPAGE_BASIS_POINTS,
      {
        unitLimit: 5_000_000,
        unitPrice: 200_000,
      }
    );

    if (createResults.confirmed) {
      console.log("Congratelation:", `https://pump.fun/${mint.publicKey.toBase58()}`);
      console.log(createResults.jitoTxsignature);
      boundingCurveAccount = await sdk.getBondingCurveAccount(mint.publicKey);
      console.log("Bonding curve after create and buy", boundingCurveAccount);
      printSPLBalance(connection, mint.publicKey, buyer.publicKey);
    }
  } else {
    console.log("boundingCurveAccount", boundingCurveAccount);
    console.log("Success:", `https://pump.fun/${mint.publicKey.toBase58()}`);
    printSPLBalance(connection, mint.publicKey, buyer.publicKey);
  }
};

main();
