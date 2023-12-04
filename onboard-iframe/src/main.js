import { Address, Transaction } from "micro-eth-signer";

// ------------------------------------------------------------------------------------------------
// INITIALIZATION
// ------------------------------------------------------------------------------------------------
window.onboardIFrame = true;
const url = new URL(location.href);
const searchParams = url.searchParams;
const parentURL = searchParams.get("parentURL");

let source;
if (window.opener) {
  throw new Error(`Do not expect to be opened as a window`);
} else if (window.parent != window) {
  source = window.parent;
} else {
  throw new Error(`self parent`);
}

const privateKey =
  "6b911fd37cdf5c81d4c0adb1ab7fa822ed253ab0ad9aa18d77257c88b29b718e";
window.addEventListener("message", receiveMessage);
// ------------------------------------------------------------------------------------------------

const methodsAllowed = [
  "eth_signTransaction",
  "eth_accounts",
  "eth_requestAccounts",
];
function isMethodAllowed(method) {
  return methodsAllowed.includes(method);
}

function receiveMessage(event) {
  if (event.source != source) {
    return;
  }

  const data = event.data;

  if (isMethodAllowed(data.request.method)) {
    request(data.request)
      .then((result) => {
        source.postMessage(
          {
            type: "onboard:response",
            id: data.id,
            result: result,
          },
          parentURL
        );
      })
      .catch((err) => {
        source.postMessage(
          {
            type: "onboard:response",
            id: data.id,
            error: {
              code: err.code || 5000,
              data: err,
              message: err.message || "request failed",
            },
          },
          parentURL
        );
      });
  } else {
    source.postMessage(
      {
        type: "onboard:response",
        id: data.id,
        error: {
          code: 4200,
          message: "method (" + data.request.method + ") not allowed in iframe",
        },
      },
      parentURL
    );
  }
}

const bnList = [
  "maxFeePerGas",
  "maxPriorityFeePerGas",
  "value",
  "gas",
  "gasLimit",
];
const numList = ["nonce", "chainId"];
function convert(obj) {
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (bnList.includes(key)) {
      obj[key] = BigInt(obj[key]);
    } else if (numList.includes(key)) {
      obj[key] = Number(obj[key]);
    }
  }
  return obj;
}

const methods = {
  async eth_signTransaction(params) {
    window.open(
      "/popup/index.html",
      "Transaction",
      "resizable,height=260,width=370"
    );
    const converted = convert(params[0]);
    const tx = new Transaction(converted);
    const signedTx = tx.sign(privateKey);
    const { hash, hex } = signedTx;
    return hex;
  },
  async eth_accounts() {
    return [Address.fromPrivateKey(privateKey)];
  },
  async eth_requestAccounts() {
    // TODO authorization ?
    return [Address.fromPrivateKey(privateKey)];
  },
};

/**
 * @param {Object} args
 * @param {string} args.method
 * @param {any[]} args.params
 * @returns {Promise<any>}
 */
async function request(args) {
  const func = methods[args.method];
  if (func) {
    return func(args.params);
  }
  throw new Error(`method "${args.method}" is not implemented`);
}
