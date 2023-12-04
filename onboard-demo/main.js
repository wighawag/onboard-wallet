import { setupEthereum } from "./ethereum";

const appElement = document.querySelector("#app");
if (appElement) {
  appElement.innerHTML = `
  <div>
    <h1>onboard wallet demo</h1>
    <div class="card">
      <button id="ethereum" type="button"></button>
    </div>
  </div>
`;
} else {
  console.error(`no #app element`, appElement);
}

setupEthereum(document.querySelector("#ethereum"));
