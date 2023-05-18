# onboard-wallet

2 commponents

1.  a web app living on its own domain

        This Goal here is to have that wallet served on ipfs using its hash.
        It act as a provider. It will communicate via window postMessage events.

2.  a npm package / js to import / inject

        The npm package will provide a EIP-1193 provider and will communicate with the wallet web-app mentioned above.
        This package will have no access to keys, It will only be able to invoke the web-app and embed it via an iframe.

Previous work : rocketh-wallet ?

Idea: use a data:uri which will add the iframe itself after checking it matches a specific hash
