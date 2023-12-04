// import { createProvider } from "eip-1193-in-memory";
import { init } from "onboard";

export function setupEthereum(element) {
  //   const provider = createProvider();
  const provider = init("http://localhost:8545", { windowEthereum: true });
  window.onboard = provider;

  const sendTx = async () => {
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
