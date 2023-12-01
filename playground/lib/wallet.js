export class ProviderRpcError extends Error {
  constructor({ message, code, data }) {
    super(message || "code " + code);
    this.name = "ProviderRpcError";
    this.code = code;
    this.data = data;
  }
}

export class IFrameProvider {
  constructor(iframeURL, nodeURL) {
    // public variable
    this.nodeURL = nodeURL;
    this.iframe = document.createElement("iframe");

    this.iframe.style.display = "none";
    // this prevent the iframe to connect to the web
    // this.iframe.csp = "default-src 'none'; script-src-elem 'self'"; // 'sha256-s34gQGVGS7By6/uGHrqMjYAL8W9VKKa1lAX3uJY7uMw='
    // this.iframe.csp = "default-src 'none'; script-src-elem 'none'"; // 'sha256-s4eorzlyNQ69ABapkrfmA8iTyx3EeYWzictDxoqWiWI='"; //
    this.iframe.csp =
      "default-src 'none'; script-src-elem 'sha384-tO1emI+gMz36hg9fbXy92lErPeZhtkHY8lWsK4H33jGHnbN8hYvLbHNvx31bwra8'"; //
    this.iframe.src =
      iframeURL +
      (iframeURL.endsWith("/") ? "" : "/") +
      "iframe/index.html" +
      `?nodeURL=${nodeURL}`;
    // TODO support multi-chain ?

    fetch("/iframe/assets/index-zoEffCdw.js")
      .then((r) => r.text())
      .then((text) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        crypto.subtle.digest("SHA-256", data).then((hashBuffer) => {
          const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
          // base64
          let binary = "";
          const bytes = new Uint8Array(hashBuffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const hashBase64 = window.btoa(binary);
          // hex
          const hashHex = hashArray
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(""); // convert bytes to hex string
          console.log({ hashHex, hashBase64 });
        });
      });

    // private variables
    this._counter = 1;
    this._listener = this.onWalletMessage.bind(this);
    this._pendingRequests = {};
    this._eventListeners = {};
    this._connected = false;
  }

  start() {
    window.addEventListener("message", this._listener);
  }

  stop() {
    window.removeEventListener("message", this._listener);
  }

  onWalletMessage(event) {
    if (
      event.source !== this.iframe.contentWindow ||
      !event.data ||
      !event.data.type
    ) {
      return;
    }
    const message = event.data;

    if (message.type === "onboard:response") {
      const pendingRequest = this._pendingRequests[message.id];
      if (!pendingRequest) {
        throw new ProviderRpcError({
          message: `no pending request with id = ${message.id}`,
          code: 5000,
        });
      }
      delete this._pendingRequests[message.id];
      if (message.error) {
        pendingRequest.reject(new ProviderRpcError(message.error));
      } else {
        pendingRequest.resolve(message.result);
      }
    } else if (message.type === "onboard:display") {
      // we use the iframe as display
      // can also provide our own
      if (message.requests.length > 0) {
        iframe.style.display = "block";
      } else {
        iframe.style.display = "none";
      }
    } else if (message.type === "onboard:event") {
      if (message.event === "connect") {
        this._connected = true;
      } else if (message.event === "disconnect") {
        this._connected = false;
      }
      this._emit(message.event, message.args);
    } else if (message.type === "onboard:request") {
      // TODO needed to skip its own message
    } else if (message.type.startsWith("onboard:")) {
      console.error(`unrecognized message type`, event);
    }
  }

  _emit(event, args) {
    console.log(
      `_emit(${event}${
        args ? `,` + args.map((v) => JSON.stringify(v)).join(",") : ""
      })`
    );
    if (this._eventListeners[event]) {
      for (const listener of this._eventListeners[event]) {
        listener(...args);
      }
    }
  }

  request(args) {
    if (!this._connected) {
      throw new ProviderRpcError({ code: 4900, message: "Not connected" });
    }
    const id = ++this._counter;
    const promise = new Promise((resolve, reject) => {
      this._pendingRequests[id] = {
        resolve,
        reject,
      };
      const message = {
        type: "onboard:request",
        request: args,
        id,
      };
      this.iframe.contentWindow.postMessage(message, this.iframe.src);
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
    const list = (this._eventListeners[eventName] =
      this._eventListeners[eventName] || []);
    list.push(listener);
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
    const list = this._eventListeners[eventName];
    if (list) {
      const index = list.indexOf(listener);
      if (index >= 0) {
        list.splice(index, 1);
      }
    }
    return this;
  }
}

export function init(nodeURL, userOptions) {
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
