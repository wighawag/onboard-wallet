import { init } from "./lib/wallet";

const provider = init("http://localhost:8545");
window.onboard = provider;
