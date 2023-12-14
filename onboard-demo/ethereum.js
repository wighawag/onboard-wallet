// import { createProvider } from "eip-1193-in-memory";
import { init } from "onboard";
import { decode as cborDecode } from "cbor2";

function wait(numSeconds) {
  return new Promise((resolve) => setTimeout(resolve, numSeconds * 1000));
}

const walletHost = import.meta.env.VITE_WALLET_HOST;
const nodeURL = import.meta.env.VITE_ETH_NODE_URI;

console.log({ nodeURL, walletHost });

export function setupEthereum(
  sendTxElement,
  createAccountElement,
  getCredentialsElement,
  savePasswordElement
) {
  //   const provider = createProvider();
  const provider = init(walletHost, nodeURL, {
    windowEthereum: true,
  });
  window.onboard = provider;

  const sendTx = async () => {
    // await wait(1);
    const accounts = await provider.request({ method: "eth_accounts" });
    const account = accounts[0];

    // console.log(`accounts`, accounts);

    await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: account,
          to: account,
        },
      ],
    });
  };

  function hex2buf(hex) {
    const typedArray = new Uint8Array(
      hex
        .slice(2)
        .match(/[\da-f]{2}/gi)
        .map(function (h) {
          return parseInt(h, 16);
        })
    );
    return typedArray.buffer;
  }
  function buf2hex(buffer) {
    // buffer is an ArrayBuffer
    return (
      `0x` +
      [...new Uint8Array(buffer)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")
    );
  }
  let counter = 1;

  function generateChallenge(v) {
    const challengeBytes = new Uint8Array(16);
    // window.crypto.getRandomValues(challengeBytes);

    for (let i = 0; i < 16; i++) {
      challengeBytes[i] = v;
    }
    return challengeBytes;
  }

  function generateRequest(challengeBytes) {
    return {
      attestation: "direct",
      challenge: challengeBytes,
      rp: {
        name: "Renraku Inkorporated",
        // id: '' // TODO wallet.renraku.eth.limo
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      hints: ["client-device", "security-key"],

      timeout: 60000, // 1 minute

      // User:
      user: {
        id: new Uint8Array([1]),
        name: "Jane Doe",
        displayName: "Jane Doe",
      },

      // residentKey: "required", // added as we do not have server ?
    };
  }

  let lastId;
  const createAccount = async () => {
    // await provider.request({
    //   method: "eth_createAccount",
    // });
    // return;
    navigator.credentials
      .create({ publicKey: generateRequest(generateChallenge(counter++)) })
      .then((v) => {
        console.log(`id`, v.id);
        console.log(`rawId`, buf2hex(v.rawId));
        lastId = v.rawId;
        console.log(`authenticatorAttachment `, v.authenticatorAttachment);
        const response = v.response;
        const jsonRaw = response.clientDataJSON;
        const attestationObject = response.attestationObject;
        console.log(`json`, new TextDecoder().decode(jsonRaw));
        console.log(`attestationObject`, buf2hex(attestationObject));
        const authenticatorData = response.getAuthenticatorData();
        console.log(`authenticatorData`, buf2hex(authenticatorData));
        const publicKey = response.getPublicKey();
        console.log(`publicKey`, buf2hex(publicKey));

        const decodedAttestationObject = cborDecode(
          buf2hex(attestationObject).slice(2)
        );
        console.log(`decodedAttestationObject`, decodedAttestationObject);
        const decodedAuthData = decodedAttestationObject.authData;
        console.log(
          `decodedAuthData`,
          buf2hex(decodedAuthData)
          // cborDecode(buf2hex(decodedAuthData).slice(2))
        );

        const sig = decodedAttestationObject.attStmt.sig;
        if (sig) {
          console.log(`sig`, buf2hex(sig));
        }
        const x5c = decodedAttestationObject.attStmt.x5c[0];
        if (x5c) {
          console.log(`x5c`, buf2hex(x5c));
        }
      })
      .catch((err) => {
        console.error(`error`, err);
      });
  };
  createAccountElement.addEventListener("click", () => createAccount());

  const getCredentials = async () => {
    console.log({ lastId });
    navigator.credentials
      .get({
        publicKey: {
          challenge: generateChallenge(1),
          // rpId: "localhost",
          allowCredentials: lastId
            ? [{ id: lastId, type: "public-key" }]
            : [
                {
                  id: hex2buf(
                    "0xed11a00e64a851b371fe5d43611cf88bbd2da44683304d1ed20430a599ccf669dd0c07cc1063f6e783d3a09d4ef72fd66ced57c6811d086f36f46c9ebabd879580202620d7ca08f05d9ec8ac146f401a"
                  ),
                  type: "public-key",
                },
              ],
        },
      })
      .then((v) => {
        console.log(`v`, v);
        console.log(`id`, v.id);
        console.log(`rawId`, buf2hex(v.rawId));
        console.log(`re - rawId`, buf2hex(hex2buf(buf2hex(v.rawId))));
        console.log(`authenticatorAttachment `, v.authenticatorAttachment);
        const response = v.response;
        const jsonRaw = response.clientDataJSON;
        console.log(`json`, new TextDecoder().decode(jsonRaw));
        const authenticatorData = response.authenticatorData;
        console.log(`authenticatorData`, buf2hex(authenticatorData));
        const signature = response.signature;
        console.log(`signature`, buf2hex(signature));
      })
      .catch((err) => {
        console.error(`error`, err);
      });
  };
  getCredentialsElement.addEventListener("click", () => getCredentials());

  function savePassword() {
    var passwordcred = new window.PasswordCredential({
      type: "password",
      id: "alice",
      password: "VeryRandomPassword123456",
    });

    navigator.credentials.store(passwordcred);
  }
  savePasswordElement.addEventListener("click", () => savePassword());

  sendTxElement.addEventListener("click", () => sendTx());
  setInterval(async () => {
    try {
      const blockNumber = await provider.request({ method: "eth_blockNumber" });
      sendTxElement.innerHTML = Number(blockNumber).toString();
    } catch (err) {
      sendTxElement.innerHTML = `ERROR: ${err || "empty response"}`;
    }
  }, 1000);
}
