// ------------------------------------------------------------------------------------------------
// INITIALIZATION
// ------------------------------------------------------------------------------------------------
const source = window.opener;
if (!source) {
  throw new Error(`expected to be open as popup`);
}
const url = new URL(location.href);
const searchParams = url.searchParams;
const parentURL = searchParams.get("parentURL");
// const type = searchParams.get("type");
const id = searchParams.get("id");

window.addEventListener("message", receiveMessage);
// ------------------------------------------------------------------------------------------------

function receiveMessage(event) {
  if (event.source != source) {
    return;
  }

  const data = event.data;

  const request = data.request;

  let groupElement;
  let confirmButton;
  let rejectButton;

  if (method === "eth_signTransaction") {
    groupElement = document.getElementById("Transaction");
    confirmButton = document.getElementById("Transaction:confirm");
    rejectButton = document.getElementById("Transaction:reject");

    const tx = data.request.params[0];
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
        type: "popup:response",
        id,
        response: {
          type: "confirm",
          request,
        },
      },
      parentURL
    );
    close();
  }

  function reject() {
    source.postMessage(
      {
        type: "popup:response",
        id,
        response: {
          type: "reject",
        },
      },
      parentURL
    );
    close();
  }
}
