window.onboardIFrame = true;
let counter = 1;
let connected = false;
const url = new URL(location.href);
const searchParams = url.searchParams;
const nodeURL = searchParams.get("nodeURL");
const parentURL = searchParams.get("parentURL");

let source;
if (window.opener) {
  throw new Error(`Do not expect to be opened as a window`);
} else if (window.parent != window) {
  source = window.parent;
} else {
  throw new Error(`self parent`);
}

connect();

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
          message: "method (" + data.payload.method + ") not allowed in iframe",
        },
      },
      parentURL
    );
  }
}

// ------------------------------------------------------------------------------------------
// UTILITIES
// ------------------------------------------------------------------------------------------

function isMethodAllowed(method) {
  // TODO
  return true;
}

function request({ method, params }) {
  return fetch(nodeURL, {
    method: "POST",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++counter,
      method,
      params: params || [],
    }),
    headers: {
      "content-type": "application/json",
    },
  })
    .then(async (response) => response.json())
    .then((v) => {
      if (v.error) {
        throw v.error;
      } else {
        return v.result;
      }
    });
}

function connect() {
  if (connected) {
    return;
  }
  request({
    method: "eth_chainId",
    params: [],
  })
    .then((chainId) => {
      if (chainId) {
        connected = true;
        window.addEventListener("message", receiveMessage);
        source.postMessage(
          {
            type: "onboard:event",
            event: "connect",
            args: [
              {
                chainId,
              },
            ], // TODO
          },
          parentURL
        );
      } else {
        connected = false;
        window.removeEventListener("message", receiveMessage);
        source.postMessage(
          {
            type: "onboard:event",
            event: "disconnect",
            args: [{ code: 4900, message: "empty chainId" }], // TODO 4901 // multichain
          },
          parentURL
        );
      }
    })
    .catch((err) => {
      connected = false;
      window.removeEventListener("message", receiveMessage);
      source.postMessage(
        {
          type: "onboard:event",
          event: "disconnect",
          args: [
            {
              code: 4900,
              data: err,
              message: err.message || "could not fetch chainId",
            },
          ], // TODO 4901 // multichain
        },
        parentURL
      );
    });
}
