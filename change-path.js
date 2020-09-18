const path = require('path')
const os = require('os')
const CKB = require('@nervosnetwork/ckb-sdk-core').default
const { Indexer, CellCollector } = require('@ckb-lumos/indexer')

const LUMOS_DB = path.join(os.tmpdir(), 'lumos_db')

// Change the CKB_URL to the CKB PRC URL your machine is running.
const CKB_URL = process.env.CKB_URL || 'http://127.0.0.1:8117'

const Transport = require("@ledgerhq/hw-transport-node-hid").default;

const LedgerCkb = require("hw-app-ckb").default;

const ckbPath = `44'/309'/0'/0/0`

const indexer = new Indexer(CKB_URL, LUMOS_DB)

const startSync = async () => {
  indexer.startForever()
  // 200000ms is a long time, if you're on devnet you may not need that long to synchronize.
  await new Promise((resolve) => setTimeout(resolve, 200000))
}


const bootstrap = async () => {
  const ckb = new CKB(CKB_URL)

  const { secp256k1Dep } = await ckb.loadDeps()

  let transport = await Transport.open();

  const lckb = new LedgerCkb(transport)
  
  const keydata = await lckb.getWalletPublicKey(ckbPath, true)
  const address = keydata.address
  const addresses = { testnetAddress: address }

  const locks = [
    // You can get this information at ckb cli.
    // path: 44'/309'/0'/0/0
    // address: "ckt1qyqgsv9xu8dkqt8c6dl4lkp9c6s3c8xd2w5s2099pz"
    // lockArgs: 0x8830a6e1db602cf8d37f5fd825c6a11c1ccd53a9
    {...secp256k1Dep, args: "0x8830a6e1db602cf8d37f5fd825c6a11c1ccd53a9"},
    // path: 44'/309'/0'/0/1
    // address: "ckt1qyq8ua6h3hjm49mteq6h2pyfrphe97jl6h4qdrp7d0"
    // loackArgs: 0x7e77578de5ba976bc835750489186f92fa5fd5ea
    {...secp256k1Dep, args: "0x7e77578de5ba976bc835750489186f92fa5fd5ea"}
  ]

  const cells = await Promise.all(
    locks.map(lock => ckb.loadCells({ indexer, CellCollector, lock }))
  )

  const unspentCells = cells.flat()

  console.log(addresses.testnetAddress, 'addresses.testnetAddress')

  const rawTransaction = ckb.generateRawTransaction({
    fromAddress: addresses.testnetAddress,
    toAddress: 'ckt1qyqysrp642jfnq90jdet75xsg4nvau3jcxuqrpmukr',
    capacity: BigInt(7200000000),
    fee: BigInt(100000),
    safeMode: true,
    cells: unspentCells,
    deps: ckb.config.secp256k1Dep,
  })

  console.log('rawTransaction', rawTransaction)

  rawTransaction.witnesses = rawTransaction.inputs.map(() => '0x')
  rawTransaction.witnesses[0] = ckb.utils.serializeWitnessArgs({
    lock: '',
    inputType: '',
    outputType: ''
  })
  rawTransaction.witnesses[1] = ckb.utils.serializeWitnessArgs({
    lock: '',
    inputType: '',
    outputType: ''
  })


  ctxds = (await Promise.all(rawTransaction.inputs.map(a=>ckb.rpc.getTransaction(a.previousOutput.txHash)))).map(a=>a.transaction)

  const formatted = ckb.rpc.paramsFormatter.toRawTransaction(rawTransaction)
  const formattedCtxd = ctxds.map(ckb.rpc.paramsFormatter.toRawTransaction)

  const signature1 = await lckb.signTransaction(`44'/309'/0'/0/0`, formatted, [formatted.witnesses[0]], formattedCtxd, "44'/309'/0'/1/0")
  const signature2 = await lckb.signTransaction(`44'/309'/0'/0/1`, formatted, [formatted.witnesses[1]], formattedCtxd, "44'/309'/0'/1/0")

  rawTransaction.witnesses[0] = ckb.utils.serializeWitnessArgs( { lock: "0x"+signature1, inputType: '', outputType: '' });
  rawTransaction.witnesses[1] = ckb.utils.serializeWitnessArgs( { lock: "0x"+signature2, inputType: '', outputType: '' });
  console.log('rawTransaction.witnesses', rawTransaction.witnesses)
  const realTxHash = await ckb.rpc.sendTransaction(rawTransaction).catch(err=>err)

  /**
   * to see the real transaction hash
   */
  console.log(`The real transaction hash is: ${realTxHash}`)
}

(async () => {
  try {
    // This line of code can be commented out after synchronization is complete.
    await startSync()
    await bootstrap()
  } catch (error) {
    console.log(error)
  }
  process.exit(0)
})()