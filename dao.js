const CKB = require("@nervosnetwork/ckb-sdk-core").default;

const CKB_URL = process.env.CKB_URL || "http://127.0.0.1:8117";

const Transport = require("@ledgerhq/hw-transport-node-hid").default;

const LedgerCkb = require("hw-app-ckb").default;

const ckbPath = "44'/309'/0'/0/0";

const bootstrap = async () => {
  const ckb = new CKB(CKB_URL)

  let transport = await Transport.open();

  const lckb = new LedgerCkb(transport);

  const keydata = await lckb.getWalletPublicKey(ckbPath, true);
  console.log(keydata);

  const publicKeyHash = "0x" + keydata.lockArg;
  const address = keydata.address;
  const addresses = { testnetAddress: address };
  const loadCells = async () => {
    await ckb.loadDeps();
    const lockHash = ckb.generateLockHash(publicKeyHash);
    return await ckb.loadCells({
      lockHash,
      start: BigInt(0),
      end: BigInt(500000),
      save: true,
    });
  };

  const cells = await loadCells();

  const rawTransaction = ckb.generateDaoDepositTransaction({
    fromAddress: addresses.testnetAddress,
    capacity: BigInt(10400000000),
    fee: BigInt(100000),
    cells,
  });

  console.log(rawTransaction);

  rawTransaction.witnesses = rawTransaction.inputs.map(() => "0x");
  rawTransaction.witnesses[0] = ckb.utils.serializeWitnessArgs({
    lock: "",
    inputType: "",
    outputType: "",
  });

  console.log("rawTransaction:", JSON.stringify(rawTransaction));

  const ctxds = (
    await Promise.all(
      rawTransaction.inputs.map((a) =>
        ckb.rpc.getTransaction(a.previousOutput.txHash)
      )
    )
  ).map((a) => a.transaction);

  const formatted = ckb.rpc.paramsFormatter.toRawTransaction(rawTransaction);
  const formattedCtxd = ctxds.map(ckb.rpc.paramsFormatter.toRawTransaction);

  try {
    const signature = await lckb.signTransaction(
      ckbPath,
      formatted,
      formatted.witnesses,
      formattedCtxd,
      ckbPath
    );
    rawTransaction.witnesses[0] = ckb.utils.serializeWitnessArgs({
      lock: "0x" + signature,
      inputType: "",
      outputType: "",
    });

    const realTxHash = await ckb.rpc
      .sendTransaction(rawTransaction)
      .catch((err) => err);

    /**
     * to see the real transaction hash
     */
    console.log(`The real transaction hash is: ${realTxHash}`);
  } catch (error) {
    console.log(error);
  }
};

try {
  bootstrap();
} catch (error) {
  console.log(error)
}