# IFRAME

We are building an iframe in [iframe-project](./iframe-project)
This generate files in [public/iframe](./public/iframe)

```bash
pnpm iframe:build
```

We then just need to use relative path in the generated [public/iframe/index.html](./public/iframe/index.html)

Then with vite we launch app that use the iframe

```
pnpm test:dev
```

The use of

```
this.iframe.csp =
      "default-src 'none'; script-src-elem 'sha384-tO1emI+gMz36hg9fbXy92lErPeZhtkHY8lWsK4H33jGHnbN8hYvLbHNvx31bwra8'"; //
```

in [lib/wallet.js](./lib/wallet.js)

Ensure the iframe cannot make request

## Using it in connection with another domain

wallet domain need another domain generating key to produce the private key

then wallet can be a smart contract account
then wallet domain can store a smart contract account address and the existing domain connected to it

then when connection from another domain, the new domain can figure there is an associated account and can ask previous one to let it connect
