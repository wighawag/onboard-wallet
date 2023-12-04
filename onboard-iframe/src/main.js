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

const methodsRequiringConfirmation = ["eth_signTransaction"];
function doesMethodRequireConfirmation(method) {
  return methodsRequiringConfirmation.includes(method);
}

let popupCounter = 1;
let currentPopup;

function receiveMessage(event) {
  if (
    event.data.target &&
    (event.data.target === "metamask-inpage" ||
      event.data.target === "metamask-contentscript")
  ) {
    // skip to filter out metamask message
    return;
  }
  console.log(`iframe`, event);
  if (event.source === source) {
    console.log(`receiveMessageFromApp`);
    return receiveMessageFromApp(event.data);
  } else if (currentPopup && event.source == currentPopup.window) {
    console.log(`receiveMessageFromPopup`, event.data);
    return receiveMessageFromPopup(event.data);
  }
}

function receiveMessageFromPopup(data) {
  if (data.id === currentPopup.id) {
    if (data.type === "popup:ready") {
      console.log(`currentPopup`, currentPopup);
      currentPopup.window.postMessage(
        { forwarded: currentPopup.data },
        currentPopup.url
      );
    } else if (data.type === "popup:confirm") {
      receiveMessageFromApp(data.forwarded, true);
    } else if (data.type === "popup:reject") {
      source.postMessage(
        {
          type: "onboard:response",
          id: currentPopup.data.id,
          error: {
            code: 1,
            message: "rejected by user",
          },
        },
        parentURL
      );
    }
  }
}

function receiveMessageFromApp(data, confirmed) {
  if (isMethodAllowed(data.request.method)) {
    if (!confirmed && doesMethodRequireConfirmation(data.request.method)) {
      if (currentPopup) {
        console.log("closing current popup", currentPopup.windown);
        // TODO throw error or push to queue ?
        currentPopup.window.close();
      }
      const popupID = ++popupCounter;
      const popupPathname = "/popup/index.html";
      const myLocation = location.href.toString();
      const url = `${location.protocol}//${location.host}${popupPathname}?parentURL=${myLocation}&id=${popupID}`;
      console.log({ url });
      const popup = window.open(
        url,
        "Confirmation",
        "resizable,height=260,width=370"
      );
      currentPopup = { window: popup, id: popupID, data, url };
    } else {
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
    }
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
