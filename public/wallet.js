class IFrameProvider {
  constructor(iframeURL, nodeURL) {
    this.nodeURL = nodeURL;

    this.iframe = document.createElement("iframe");
    this.iframe.src =
      iframeURL +
      (iframeURL.endsWith("/") ? "" : "/") +
      "wallet-iframe.html" +
      `?nodeURL=${nodeURL}`;
    this.counter = 1;
    this.listener = this.onWalletMessage.bind(this);
    this.pendingRequests = {};
    this.iframe.style.display = "none";
  }

  start() {
    window.addEventListener("message", this.listener);
  }

  stop() {
    window.removeEventListener("message", this.listener);
  }

  onWalletMessage(event) {
    if (event.source !== this.iframe.contentWindow) {
      return;
    }
    const message = event.data;

    if (message.type === "onboard:response") {
      console.log("onboard:response", message);
      const acceptedMessage = message;
      const pendingRequest = this.pendingRequests[acceptedMessage.id];
      if (!pendingRequest) {
        console.error(message);
        throw new Error(`no pending request with id = ${acceptedMessage.id}`);
      }
      delete this.pendingRequests[acceptedMessage.id];

      pendingRequest.resolve(acceptedMessage.result);
    } else if (message.type === "onboard:display") {
      console.log("onboard:display", message);
      // we use the iframe as display
      // can also provide our own
      if (message.requests.length > 0) {
        iframe.style.display = "block";
      } else {
        iframe.style.display = "none";
      }
    }
  }

  request(args) {
    const id = ++this.counter;
    const promise = new Promise((resolve, reject) => {
      this.pendingRequests[id] = {
        resolve,
        reject,
      };
      const message = {
        type: "onboard:request",
        request: args,
        id,
      };
      this.iframe.contentWindow.postMessage(message);
    });
    return promise;
  }

  // on(eventName: "message", listener: Listener<EIP1193Message>): this;
  // on(
  //   eventName: "disconnect",
  //   listener: Listener<EIP1193ProviderRpcError>
  // ): this;
  // on(eventName: "accountsChanged", listener: Listener<EIP1193Account[]>): this;
  // on(eventName: "chainChanged", listener: Listener<EIP1193ChainId>): this;
  // on(eventName: "connect", listener: Listener<EIP1193ConnectInfoMessage>): this;
  on(eventName, listener) {
    return this;
  }
  // removeListener(
  //   eventName: "message",
  //   listener: Listener<EIP1193Message>
  // ): this;
  // removeListener(
  //   eventName: "disconnect",
  //   listener: Listener<EIP1193ProviderRpcError>
  // ): this;
  // removeListener(
  //   eventName: "accountsChanged",
  //   listener: Listener<EIP1193Account[]>
  // ): this;
  // removeListener(
  //   eventName: "chainChanged",
  //   listener: Listener<EIP1193ChainId>
  // ): this;
  // removeListener(
  //   eventName: "connect",
  //   listener: Listener<EIP1193ConnectInfoMessage>
  // ): this;
  removeListener(eventName, listener) {
    return this;
  }
}

function init(nodeURL, userOptions) {
  const options = {
    url: "./",
    addToDocument: "append",
    style: { zIndex: "9999" },
    ...userOptions,
  };

  const provider = new IFrameProvider(options.url, nodeURL);

  if (typeof options.addToDocument === "string") {
    if (options.addToDocument === "prepend") {
      document.body.prepend(provider.iframe);
    } else {
      document.body.appendChild(provider.iframe);
    }
  }

  provider.start();

  if (options.ethereum) {
    window.ethereum = provider;
  }
  return provider;
}
