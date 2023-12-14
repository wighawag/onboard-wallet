import { JSONRPCHTTPProvider } from "eip-1193-jsonrpc-provider";
import {
  EIP1193Provider,
  EIP1193ProviderWithoutEvents,
  EIP1193QUANTITY,
  EIP1193TransactionData,
  EIP1193TransactionDataOfType2,
} from "eip-1193";

const PRIVATE_METHODS: string[] = [
  "eth_signTransaction",
  "eth_accounts",
  "eth_requestAccounts",
  "eth_createAccount",
];
export function isPrivateMethod(method: string) {
  return PRIVATE_METHODS.indexOf(method) > -1;
}

export class ProviderRpcError extends Error {
  public readonly code: number;
  public readonly data?: any;
  constructor({
    message,
    code,
    data,
  }: {
    message: string;
    code: number;
    data?: any;
  }) {
    super(message || "code " + code);
    this.name = "ProviderRpcError";
    this.code = code;
    this.data = data;
  }
}

type PendingRequest<T = any, E = any> = {
  resolve: (v: T) => void;
  reject: (e: E) => void;
};

export class IFrameProvider {
  public readonly iframe: HTMLIFrameElement;
  public readonly externalProvider:
    | EIP1193ProviderWithoutEvents
    | EIP1193Provider;

  private _counter: number;
  private _listener: (event: MessageEvent) => void;
  private _pendingRequests: { [id: string]: PendingRequest };
  private _eventListeners: { [eventName: string]: ((args?: any[]) => void)[] };
  private _connectedChainId: string | undefined;

  constructor(iframeHOST: string, providerOrURL: string | EIP1193Provider) {
    // public variable

    const iframeSRC = `${iframeHOST}${
      iframeHOST.endsWith("/") ? "" : "/"
    }iframe/index.html?parentURL=${location.href}`;
    this.iframe = document.createElement("iframe");
    this.iframe.style.position = "fixed";
    this.iframe.style.right = "0px";
    this.iframe.style.top = "0px";
    this.iframe.style.textAlign = "center";
    this.iframe.style.border = "none";
    this.externalProvider =
      typeof providerOrURL === "string"
        ? new JSONRPCHTTPProvider(providerOrURL)
        : providerOrURL;

    this.iframe.style.display = "none";
    // this prevent the iframe to connect to the web + it forces the use of specific js via `script-src-elem <hash>`
    // we need to inject the integrity resulting from wallet
    // (this.iframe as any).csp =
    //   "default-src 'none'; script-src-elem 'sha384-tO1emI+gMz36hg9fbXy92lErPeZhtkHY8lWsK4H33jGHnbN8hYvLbHNvx31bwra8'"; //

    // disabling for now as we also need header for csp it seems, cannot be served from ipfs :(
    // (this.iframe as any).csp =
    //   "default-src 'none'; script-src-elem *; style-src 'unsafe-inline';"; // TODO style hash too (for popup, same for script)

    // This is not working yet: this.iframe.allow = "publickey-credentials-create *";
    // see: https://github.com/w3c/webauthn/issues/1656
    this.iframe.src = iframeSRC;
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
    this._connectedChainId = undefined;
  }

  start() {
    this.externalProvider
      .request({
        method: "eth_chainId",
        params: [],
      })
      .then((chainId) => {
        if (typeof chainId === "string") {
          this._connectedChainId = chainId;
          this._emit("connect", [
            {
              chainId,
            },
          ]);

          // we pass through the event
          // expect connect and discconect
          // TODO catch them too and handle them
          if ("on" in this.externalProvider) {
            for (const event of [
              "accountsChanged",
              "chainChanged",
              "message" /*'connect', 'disconnect' */,
            ]) {
              this.externalProvider.on(
                event as any,
                this._emit.bind(this, event)
              );
            }
          }

          window.addEventListener("message", this._listener);
        } else {
          console.error(`empty chainId`);
          window.removeEventListener("message", this._listener);
          this._connectedChainId = undefined;
          this._emit("disconnect", [{ code: 4900, message: "empty chainId" }]);
        }
      })
      .catch((err) => {
        console.error(`could not fetch chainId`);
        window.removeEventListener("message", this._listener);
        this._connectedChainId = undefined;
        this._emit("disconnect", [
          {
            code: 4900,
            data: err,
            message: err.message || "could not fetch chainId",
          },
        ]);
      });
  }

  stop() {
    this._connectedChainId = undefined;
    window.removeEventListener("message", this._listener);
  }

  onWalletMessage(event: MessageEvent) {
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
        this.iframe.style.display = "block";
      } else {
        this.iframe.style.display = "none";
      }
    } else if (message.type === "onboard:event") {
      this._emit(message.event, message.args);
    } else if (message.type === "onboard:request") {
      // TODO needed to skip its own message
    } else if (message.type.startsWith("onboard:")) {
      console.error(`unrecognized message type`, event);
    }
  }

  _emit(event: string, args: any[]) {
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

  async iframeRequest(args: { method: string; params?: any[] }): Promise<any> {
    if (!this._connectedChainId) {
      throw new ProviderRpcError({
        code: 4900,
        message: "Not connected",
      });
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
      (this.iframe as any).contentWindow.postMessage(message, this.iframe.src);
    });
    return promise;
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    if (!this._connectedChainId) {
      throw new Error(`not connected to any chain`);
    }
    const method = args.method;
    if (!isPrivateMethod(method)) {
      if (method === "eth_sendTransaction") {
        if (!args.params || !args.params[0]) {
          throw new Error(`no params provided to eth_sendTransaction`);
        }
        const txDataGiven = args
          .params[0] as Partial<EIP1193TransactionDataOfType2>;
        if (!txDataGiven.from) {
          throw new Error(`you need to specify from`);
        }

        const nonce = "0x0";
        const maxFeePerGas = "0x0";
        const maxPriorityFeePerGas = "0x0";

        const txData: EIP1193TransactionDataOfType2 & {
          nonce: EIP1193QUANTITY;
          maxFeePerGas: EIP1193QUANTITY;
          maxPriorityFeePerGas: EIP1193QUANTITY;
        } = {
          type: "0x2",
          chainId: this._connectedChainId as `0x${string}`,
          from: txDataGiven.from,
          to: txDataGiven.to,
          nonce,
          maxFeePerGas,
          maxPriorityFeePerGas,
          value: txDataGiven.value || "0x0",
        };
        const txHex = await this.iframeRequest({
          method: "eth_signTransaction",
          params: [txData],
        });
        return this.externalProvider.request({
          method: "eth_sendRawTransaction",
          params: [txHex],
        });
      } else {
        return this.externalProvider.request(args);
      }
    }

    return this.iframeRequest(args);
  }

  // on(eventName: "message", listener: Listener<EIP1193Message>): this;
  // on(
  //   eventName: "disconnect",
  //   listener: Listener<EIP1193ProviderRpcError>
  // ): this;
  // on(eventName: "accountsChanged", listener: Listener<EIP1193Account[]>): this;
  // on(eventName: "chainChanged", listener: Listener<EIP1193ChainId>): this;
  // on(eventName: "connect", listener: Listener<EIP1193ConnectInfoMessage>): this;
  on(eventName: string, listener: (arg: any) => void) {
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
  removeListener(eventName: string, listener: (args: any) => void) {
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

export type UserOptions = {
  windowEthereum?: boolean;
};

export function init(
  host: string,
  providerOrURL: string | EIP1193Provider,
  userOptions?: UserOptions
) {
  const options = {
    addToDocument: "append",
    style: { zIndex: "9999" },
    ...(userOptions || {}),
  };

  const provider = new IFrameProvider(host, providerOrURL);

  if (typeof options.addToDocument === "string") {
    if (options.addToDocument === "prepend") {
      document.body.prepend(provider.iframe);
    } else {
      document.body.appendChild(provider.iframe);
    }
  }

  provider.start();

  if (options.windowEthereum) {
    (window as any).ethereum = provider;
  }
  return provider;
}
