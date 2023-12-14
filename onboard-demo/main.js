import { setupEthereum } from "./ethereum";

const appElement = document.querySelector("#app");
if (appElement) {
  appElement.innerHTML = `
  <div>
    <h1>onboard wallet demo</h1>
    <div class="card">
      <button id="sendTx" type="button">SendTx</button>
      <button id="createAccount" type="button">CreateAccount</button>
      <button id="getCredentials" type="button">GetCredentials</button>
      <button id="savePassword" type="button">SavePassword</button>
    </div>
  </div>
`;
} else {
  console.error(`no #app element`, appElement);
}

setupEthereum(
  document.querySelector("#sendTx"),
  document.querySelector("#createAccount"),
  document.querySelector("#getCredentials"),
  document.querySelector("#savePassword")
);
