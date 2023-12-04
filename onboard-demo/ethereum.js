// import { createProvider } from "eip-1193-in-memory";
import { init } from "onboard";

function wait(numSeconds) {
  return new Promise((resolve) => setTimeout(resolve, numSeconds * 1000));
}

export function setupEthereum(element) {
  //   const provider = createProvider();
  const provider = init("http://localhost:8545", { windowEthereum: true });
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

  element.addEventListener("click", () => sendTx());
  setInterval(async () => {
    try {
      const blockNumber = await provider.request({ method: "eth_blockNumber" });
      element.innerHTML = Number(blockNumber).toString();
    } catch (err) {
      element.innerHTML = `ERROR: ${err || "empty response"}`;
    }
  }, 1000);
}
