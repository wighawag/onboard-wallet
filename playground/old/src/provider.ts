import { EIP1193Message } from "eip-1193";
import { EIP1193Account } from "eip-1193";
import { EIP1193ConnectInfoMessage } from "eip-1193";
import { EIP1193ChainId } from "eip-1193";
import { EIP1193ProviderRpcError } from "eip-1193";
import { Listener } from "eip-1193";
import { EIP1193Request, EIP1193Provider } from "eip-1193";

let counter = 0;

type PendingRequest = {
  resolve: (response: any) => void;
  reject: (error: any) => void;
};

type MessageToWallet = {
  type: "ethereum";
  id: number;
  request: EIP1193Request;
};

type MessageFromWallet = {
  id: number;
} & (
  | { type: "ethereum:response"; response: any }
  | { type: "ethereum:error"; error: any }
);

// TODO rename Iframe ?
export class WindowPostMessageProvider implements EIP1193Provider {
  private listener: (message: any) => void;
  private pendingRequests: { [id: number]: PendingRequest } = {};

  constructor(protected walletWindow: Window) {
    this.listener = this.onWalletMessage.bind(this);
  }

  start() {
    this.walletWindow.addEventListener("message", this.listener);
  }

  stop() {
    this.walletWindow.removeEventListener("message", this.listener);
  }

  onWalletMessage(message) {
    const acceptedMessage: MessageFromWallet = message;
    const pendingRequest = this.pendingRequests[acceptedMessage.id];
    if (!pendingRequest) {
      throw new Error(`no pending request with id = ${acceptedMessage.id}`);
    }
    delete this.pendingRequests[acceptedMessage.id];
    if (acceptedMessage.type === "ethereum:response") {
      pendingRequest.resolve(acceptedMessage.response);
    } else {
      pendingRequest.reject(acceptedMessage.error);
    }
  }

  request<T, Request extends EIP1193Request = EIP1193Request>(
    args: Request
  ): Promise<T> {
    const id = ++counter;
    const promise = new Promise((resolve, reject) => {
      this.pendingRequests[id] = {
        resolve,
        reject,
      };
      const message: MessageToWallet = {
        type: "ethereum",
        request: args,
        id,
      };
      this.walletWindow.postMessage(message);
    });
    return promise as Promise<T>;
  }

  on(eventName: "message", listener: Listener<EIP1193Message>): this;
  on(
    eventName: "disconnect",
    listener: Listener<EIP1193ProviderRpcError>
  ): this;
  on(eventName: "accountsChanged", listener: Listener<EIP1193Account[]>): this;
  on(eventName: "chainChanged", listener: Listener<EIP1193ChainId>): this;
  on(eventName: "connect", listener: Listener<EIP1193ConnectInfoMessage>): this;
  on(
    eventName:
      | "message"
      | "disconnect"
      | "accountsChanged"
      | "chainChanged"
      | "connect",
    listener:
      | Listener<EIP1193Message>
      | Listener<EIP1193ProviderRpcError>
      | Listener<EIP1193Account[]>
      | Listener<EIP1193ChainId>
      | Listener<EIP1193ConnectInfoMessage>
  ): WindowPostMessageProvider {
    return this;
  }
  removeListener(
    eventName: "message",
    listener: Listener<EIP1193Message>
  ): this;
  removeListener(
    eventName: "disconnect",
    listener: Listener<EIP1193ProviderRpcError>
  ): this;
  removeListener(
    eventName: "accountsChanged",
    listener: Listener<EIP1193Account[]>
  ): this;
  removeListener(
    eventName: "chainChanged",
    listener: Listener<EIP1193ChainId>
  ): this;
  removeListener(
    eventName: "connect",
    listener: Listener<EIP1193ConnectInfoMessage>
  ): this;
  removeListener(
    eventName:
      | "message"
      | "disconnect"
      | "accountsChanged"
      | "chainChanged"
      | "connect",
    listener:
      | Listener<EIP1193Message>
      | Listener<EIP1193ProviderRpcError>
      | Listener<EIP1193Account[]>
      | Listener<EIP1193ChainId>
      | Listener<EIP1193ConnectInfoMessage>
  ): WindowPostMessageProvider {
    return this;
  }
}

export type Options = {
  style?: Partial<CSSStyleDeclaration>;
  addToDocument?: "prepend" | "append" | HTMLIFrameElement;
  addAsWindowEthereum?: boolean;
  notifyViaEIP_TODO?: boolean;
};

export function init(url: string, userOptions?: Options): EIP1193Provider {
  const options = {
    addToDocument: "append",
    style: { zIndex: "9999" },
    ...userOptions,
  };

  const iframe =
    !options.addToDocument || typeof options.addToDocument === "string"
      ? new HTMLIFrameElement()
      : options.addToDocument;

  iframe.src = url;
  for (const key of Object.keys(options.style)) {
    iframe.style[key] = options.style[key];
  }

  if (typeof options.addToDocument === "string") {
    if (options.addToDocument === "prepend") {
      document.body.prepend(iframe);
    } else {
      document.body.appendChild(iframe);
    }
  }

  const provider = new WindowPostMessageProvider(iframe.contentWindow);
  provider.start();
  return provider;
}
