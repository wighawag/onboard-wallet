// ------------------------------------------------------------------------------------------------
// INITIALIZATION
// ------------------------------------------------------------------------------------------------
const source = window.opener;
if (!source) {
  throw new Error(`expected to be open as popup`);
}
const url = new URL(location.href);
console.log(`popup ${url}`);
const searchParams = url.searchParams;
const parentURL = searchParams.get("parentURL");
const idStr = searchParams.get("id");
const id = parseInt(idStr);

console.log({ id, parentURL });
window.addEventListener("message", receiveMessage);
source.postMessage({ type: "popup:ready", id }, parentURL);
// ------------------------------------------------------------------------------------------------

function receiveMessage(event) {
  if (
    event.data.target &&
    (event.data.target === "metamask-inpage" ||
      event.data.target === "metamask-contentscript")
  ) {
    // skip to filter out metamask message
    return;
  }
  console.log(`popup`, event);

  if (event.source != source) {
    return;
  }

  const forwarded = event.data.forwarded;

  const request = forwarded.request;

  let groupElement;
  let confirmButton;
  let rejectButton;

  if (request.method === "eth_signTransaction") {
    groupElement = document.getElementById("Transaction");
    confirmButton = document.getElementById("Transaction:confirm");
    rejectButton = document.getElementById("Transaction:reject");

    const tx = request.params[0];
    for (const key of Object.keys(tx)) {
      const value = tx[key];
      const element = document.getElementById(`Transaction:${key}`);
      if (element) {
        element.innerHTML = value;
      }
    }
  }

  groupElement.style.display = "block";
  confirmButton.addEventListener("click", confirm);
  rejectButton.addEventListener("click", reject);

  function close() {
    confirmButton.removeEventListener("click", confirm);
    rejectButton.removeEventListener("click", reject);
    window.close();
  }

  function confirm() {
    source.postMessage(
      {
        type: "popup:confirm",
        id,
        forwarded,
      },
      parentURL
    );
    close();
  }

  function reject() {
    source.postMessage(
      {
        type: "popup:reject",
        id,
      },
      parentURL
    );
    close();
  }
}
